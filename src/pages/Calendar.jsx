import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { useJobs } from '../data/useData';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { EmptySchedule } from '../components/ui/Illustrations';
import OfflineMessage from '../components/ui/OfflineMessage';
import WeekStrip from '../components/ui/WeekStrip';
import { getNavigationUrl } from '../lib/maps';

// Real "now" — was previously a hard-coded prototype anchor.
const NOW = () => new Date();

// Reactive hook that re-renders once per minute so the current-time indicator stays accurate.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// const VIEWS = ['Week', 'Agenda']; // PARKED: week view hidden per Sandra's request — restore toggle to re-enable

// Extract the Toronto calendar date as "YYYY-MM-DD" — used for day comparisons and grouping.
function torontoDateKey(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(d);
}
function startOfWeek(d) {
  // Anchor at 17:00 UTC (= noon EDT / 1 PM EST) of the Toronto Monday so torontoDateKey
  // always resolves to the correct calendar date regardless of the browser's local timezone.
  const key = torontoDateKey(d);
  const [y, mo, dy] = key.split('-').map(Number);
  const noon = new Date(Date.UTC(y, mo - 1, dy, 17));
  const dow = (noon.getUTCDay() + 6) % 7; // Mon=0
  noon.setUTCDate(noon.getUTCDate() - dow);
  return noon;
}
function sameDay(a, b) {
  return torontoDateKey(a) === torontoDateKey(b);
}
function addDays(d, n) {
  const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x;
}
function fmtTime(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${hh}:00 ${ap}` : `${hh}:${m.toString().padStart(2,'0')} ${ap}`;
}

function fmtTimeRange(start, end) {
  const s = fmtTime(start);
  const e = fmtTime(end);
  // Remove period from start if same as end to save space
  const sParts = s.split(' ');
  const eParts = e.split(' ');
  if (sParts[1] === eParts[1]) {
    return `${sParts[0]} – ${e}`;
  }
  return `${s} – ${e}`;
}
function fmtDateHead(d) {
  const opts = { weekday: 'long', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

// Returns "Jun 8 – 14" or "Jun 29 – Jul 5" for the week range label.
function weekRangeLabel(weekStart) {
  const endDay = addDays(weekStart, 6);
  const startMon = weekStart.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Toronto' });
  const endMon   = endDay.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Toronto' });
  const startD   = parseInt(new Intl.DateTimeFormat('en-CA', { day: 'numeric', timeZone: 'America/Toronto' }).format(weekStart), 10);
  const endD     = parseInt(new Intl.DateTimeFormat('en-CA', { day: 'numeric', timeZone: 'America/Toronto' }).format(endDay), 10);
  if (startMon === endMon) return `${startMon} ${startD} – ${endD}`;
  return `${startMon} ${startD} – ${endMon} ${endD}`;
}

function fmtMoney(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

// Adapt display jobs (from useJobs) into the shape the views expect:
// { ...job, client: { name, init, color, address }, service: { label }, start, end, color, paid }
function enrichDisplayJobs(displayJobs, clientLookup) {
  return displayJobs
    .filter(j => j.status !== 'Deleted')
    .map(j => {
      const c = clientLookup[j.client_id];
      const start = new Date(j.scheduled_at);
      const end = new Date(start.getTime() + (j.duration_est || 0) * 60000);
      const paid = j.payment_status === 'Paid';
      const isUnpaidCompleted = j.status === 'Completed' && !paid;
      const isCancelled = j.status === 'Cancelled';

      // High-glance coloring: Grey for Cancelled, Amber for Unpaid, Green for Paid, Pink for Scheduled
      const color = isCancelled
        ? '#9CA3AF'
        : isUnpaidCompleted ? '#F59E0B' : paid ? '#22C55E' : '#FC4693';

      return {
        ...j,
        client: c ? { name: c.name, init: c.init, color: c.color, address: c.address } : null,
        service: { label: j.service_name || '—' },
        start, end, color, paid, isUnpaidCompleted, isCancelled
      };
    })
    .filter(j => !Number.isNaN(j.start.getTime()))
    .sort((a, b) => a.start - b.start);
}

// Returns [{a, b, minutes, driveMin}] for consecutive-same-day jobs where free
// time (gap minus known drive) is < 15 min, or gap < 60 when drive is unknown.
function findSameDayConflicts(jobsOnDay) {
  const out = [];
  for (let i = 0; i < jobsOnDay.length - 1; i++) {
    const a = jobsOnDay[i], b = jobsOnDay[i + 1];
    const gapMin = Math.round((b.start - a.end) / 60000);
    if (gapMin < 0) continue;
    const driveMin = Math.round((b.raw?.ai_context?.drive_to?.durationValue ?? 0) / 60);
    const threshold = driveMin > 0 ? driveMin + 15 : 60;
    if (gapMin < threshold) out.push({ a, b, minutes: gapMin, driveMin });
  }
  return out;
}

export default function Calendar() {
  const { T, mode, privacyOn } = useAppTheme();
  useNow(); // subscription only — re-renders once/minute so NOW() reads stay fresh
  const [view, setView] = useState('Agenda');
  const [selectedDay, setSelectedDay] = useState(() => NOW());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(NOW()));
  const [agendaDayFilter, setAgendaDayFilter] = useState(null);
  const { openJob } = useJobDetailSheet();
  const handleJobPress = useCallback((id) => openJob(id), [openJob]);

  const { jobs: displayJobs, clients: clientLookup, loading, error, refresh: refetchJobs } = useJobs();
  const allJobs = useMemo(() => enrichDisplayJobs(displayJobs, clientLookup), [displayJobs, clientLookup]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const nextUpcoming = useMemo(
    () => allJobs.find(j => j.start >= NOW() && j.status === 'Scheduled'),
    [allJobs]
  );

  const monthYear = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePickDay = (d) => {
    setSelectedDay(new Date(d));
    setAgendaDayFilter(new Date(d));
    setView('Agenda');
  };

  const handlePrevWeek = () => setWeekStart(addDays(weekStart, -7));
  const handleNextWeek = () => setWeekStart(addDays(weekStart, 7));
  const handleToday = () => {
    const today = NOW();
    setWeekStart(startOfWeek(today));
    setSelectedDay(today);
  };
  // Jump-to-date: routes through startOfWeek + handlePickDay so weekStart and
  // selectedDay/agendaDayFilter stay in sync with WeekStrip's swipe state.
  const handleJumpToDate = (dateStr) => {
    if (!dateStr) return;
    const [y, mo, dy] = dateStr.split('-').map(Number);
    // Anchor at 17:00 UTC to match startOfWeek/torontoDateKey's Toronto-noon convention.
    const picked = new Date(Date.UTC(y, mo - 1, dy, 17));
    setWeekStart(startOfWeek(picked));
    handlePickDay(picked);
  };

  // Shared nav button style — 44×44px hit area, 22×22px visual
  const navBtnStyle = {
    background: 'transparent',
    border: 'none',
    padding: 11,
    margin: -11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  };
  const navBtnInner = {
    background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)',
    borderRadius: 4,
    width: 22,
    height: 22,
    color: mode === 'dark' ? 'white' : T.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    lineHeight: 1,
    userSelect: 'none',
  };

  if (error && !displayJobs?.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
        <OfflineMessage onRetry={refetchJobs} />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}
    >
      {/* Dark hero */}
      <div style={{
        background: T.hero,
        borderBottom: '3px solid #FC4693',
        padding: '11px 13px 13px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="Previous week"
              style={navBtnStyle}
            >
              <span style={navBtnInner}>‹</span>
            </button>
            <div>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : T.inkMuted, opacity: 0.75 }}>
                Schedule
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, letterSpacing: '-0.4px', color: mode === 'dark' ? 'white' : T.ink }}>{monthYear}</div>
              <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: mode === 'dark' ? 'rgba(255,255,255,0.75)' : T.inkMuted, marginTop: 1 }}>
                {weekRangeLabel(weekStart)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Next week"
              style={navBtnStyle}
            >
              <span style={navBtnInner}>›</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleToday}
              style={{
                background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'}`,
                borderRadius: 6,
                padding: '10px 10px',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                color: mode === 'dark' ? 'white' : T.ink,
                fontFamily: T.font,
                fontSize: 9,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >Today</button>
            <label
              aria-label="Jump to date"
              style={{
                background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'}`,
                borderRadius: 6,
                minHeight: 44,
                minWidth: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: mode === 'dark' ? 'white' : T.ink,
                cursor: 'pointer',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <input
                type="date"
                onChange={(e) => handleJumpToDate(e.target.value)}
                aria-label="Jump to date"
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  padding: 0,
                }}
              />
            </label>
            <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 20, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.4px' }}>Synced</span>
            </div>
          </div>
        </div>

        {/* 7-day strip — swipeable week carousel */}
        <WeekStrip
          weekStart={weekStart}
          selectedDate={view !== 'Week' ? selectedDay : null}
          today={NOW()}
          allJobs={allJobs}
          onWeekChange={(delta) => setWeekStart(prev => addDays(prev, delta * 7))}
          onDaySelect={(d) => { if (d) handlePickDay(d); }}
          T={T}
          mode={mode}
          variant="calendar"
        />
      </div>


      {error && (
        <div style={{ margin: '6px 13px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
          {error.message || 'Could not load calendar.'}
        </div>
      )}

      {view === 'Agenda' && (
        <AgendaView
          T={T}
          mode={mode}
          privacyOn={privacyOn}
          allJobs={allJobs}
          nextUpcoming={nextUpcoming}
          onJobPress={handleJobPress}
          dayFilter={agendaDayFilter}
          onClearFilter={() => setAgendaDayFilter(null)}
          onSetFilter={(d) => setAgendaDayFilter(d)}
          weekStart={weekStart}
          loading={loading}
        />
      )}
    </div>
  );
}

/* ------------------------------ AGENDA VIEW ------------------------------ */

function AgendaView({ T, mode, privacyOn, allJobs, nextUpcoming, onJobPress, dayFilter, onClearFilter, onSetFilter, weekStart, loading }) {
  const grouped = useMemo(() => {
    const weekStartKey = torontoDateKey(weekStart);
    const weekEndKey   = torontoDateKey(addDays(weekStart, 6));
    const map = new Map();
    for (const j of allJobs) {
      if (dayFilter) {
        if (!sameDay(j.start, dayFilter)) continue;
      } else {
        const k = torontoDateKey(j.start);
        if (k < weekStartKey || k > weekEndKey) continue;
      }
      const key = torontoDateKey(j.start);
      if (!map.has(key)) map.set(key, { date: j.start, jobs: [] });
      map.get(key).jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) => a.date - b.date);
  }, [allJobs, dayFilter, weekStart]);

  const summary = useMemo(() => {
    let collected = 0, owed = 0, booked = 0;
    for (const group of grouped) {
      for (const j of group.jobs) {
        if (j.isCancelled) continue;
        const amt = parseFloat(j.total) || 0;
        const amtPaid = parseFloat(j.amount_paid) || 0;
        if (j.paid) collected += amt;
        else if (j.isUnpaidCompleted) owed += Math.max(0, amt - amtPaid);
        else booked += amt;
      }
    }
    return { collected, owed, booked };
  }, [grouped]);

  const allWeekConflicts = useMemo(() => {
    const out = [];
    for (const group of grouped) {
      out.push(...findSameDayConflicts(group.jobs));
    }
    return out;
  }, [grouped]);

  const chipLabel = dayFilter
    ? dayFilter.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Toronto' })
    : 'Whole week';

  if (loading) {
    return (
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 80px' }}>
        <style>{`@keyframes sm-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
        {[0, 1].map(g => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ height: 13, width: 130, borderRadius: 6, background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : T.cardBorder, animation: 'sm-pulse 1.5s ease-in-out infinite', marginBottom: 10 }} />
            {[0, 1].map(c => (
              <div key={c} style={{ height: 72, borderRadius: 14, background: T.card, border: `1.5px solid ${T.cardBorder}`, animation: `sm-pulse 1.5s ease-in-out infinite ${0.1 + c * 0.1}s`, marginBottom: 6 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 80px', contain: 'layout style paint' }}>
      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          onClick={dayFilter ? onClearFilter : undefined}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: dayFilter ? T.pink : (mode === 'dark' ? '#2C2C2E' : T.cardBorder),
            color: dayFilter ? 'white' : (mode === 'dark' ? 'rgba(255,255,255,0.55)' : T.inkMuted),
            border: 'none',
            borderRadius: 100,
            padding: '4px 10px',
            fontFamily: T.font, fontSize: 10.5, fontWeight: 600,
            cursor: dayFilter ? 'pointer' : 'default',
            userSelect: 'none',
            minHeight: 32,
          }}
        >
          {chipLabel}
          {dayFilter && (
            <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.85, marginLeft: 2 }}>×</span>
          )}
        </button>
      </div>

      {/* Conflict banner — only show when viewing the whole week */}
      {allWeekConflicts.length > 0 && !dayFilter && (
        <button
          type="button"
          onClick={() => onSetFilter(allWeekConflicts[0].a.start)}
          style={{
            width: '100%',
            textAlign: 'left',
            marginBottom: 10,
            padding: '9px 12px',
            borderRadius: 10,
            background: mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
            border: `1.5px solid #F59E0B`,
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#B45309' }}>
              {allWeekConflicts.length} job {allWeekConflicts.length === 1 ? 'overlap' : 'overlaps'} this week
            </span>
            <span style={{ fontFamily: T.font, fontSize: 10, color: '#92400E', marginLeft: 4, opacity: 0.8 }}>
              · tap to review
            </span>
          </div>
          <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>›</span>
        </button>
      )}

      {(summary.collected > 0 || summary.owed > 0 || summary.booked > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, paddingBottom: 8, borderBottom: mode === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #FFE8F2' }}>
          {!dayFilter && <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>This week</span>}
          {summary.collected > 0 && (
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: '#16A34A' }}>
              Collected <span style={{ fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>{privacyOn ? '•••' : `$${summary.collected.toFixed(2)}`}</span>
            </span>
          )}
          {summary.owed > 0 && (
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 700, color: '#B45309' }}>
              Owed <span style={{ fontFamily: T.serif, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{privacyOn ? '•••' : `$${summary.owed.toFixed(2)}`}</span>
            </span>
          )}
          {summary.booked > 0 && (
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: T.inkMuted }}>
              Booked <span style={{ fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>{privacyOn ? '•••' : `$${summary.booked.toFixed(2)}`}</span>
            </span>
          )}
        </div>
      )}

      {grouped.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <EmptySchedule size={100} />
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
            {dayFilter ? `Nothing scheduled for ${fmtDateHead(dayFilter)}.` : 'No jobs this week.'}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 11, color: T.pink, fontWeight: 600 }}>
            Tap + to book a job
          </div>
        </div>
      )}

      {grouped.map(group => {
        const isToday = sameDay(group.date, NOW());
        const conflicts = findSameDayConflicts(group.jobs);
        const dateLabel = isToday
          ? `Today, ${group.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })}`
          : fmtDateHead(group.date);
        return (
          <div key={group.date.toISOString()} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink }}>
                {dateLabel}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted }}>
                {group.jobs.length} job{group.jobs.length > 1 ? 's' : ''}
              </div>
            </div>

            {group.jobs.map(j => {
              const conflict = conflicts.find(c => c.a.id === j.id || c.b.id === j.id);
              const isNext = nextUpcoming && j.id === nextUpcoming.id;
              return (
                <AgendaCard
                  key={j.id}
                  T={T} mode={mode} privacyOn={privacyOn}
                  job={j}
                  isNext={isNext}
                  conflict={conflict}
                  onPress={onJobPress}
                />
              );
            })}

          </div>
        );
      })}
    </div>
  );
}

const AgendaCard = memo(function AgendaCard({ T, mode, privacyOn, job, isNext, conflict, onPress }) {
  const paid = job.paid;
  const isUnpaidCompleted = job.isUnpaidCompleted;
  const isCancelled = job.isCancelled;

  const border = conflict
    ? '#F59E0B'
    : isCancelled
      ? '#D1D5DB'
      : isUnpaidCompleted
        ? '#F59E0B'
        : (isNext ? '#FC4693' : (paid ? '#86EFAC' : T.cardBorder));

  const bg = isCancelled
    ? (mode === 'dark' ? 'rgba(156,163,175,0.08)' : '#F9FAFB')
    : isUnpaidCompleted
      ? (mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FEF3C7')
      : paid
        ? (mode === 'dark' ? 'rgba(34,197,94,0.08)' : '#F0FFF5')
        : (isNext
            ? (mode === 'dark' ? 'rgba(233,30,106,0.1)' : '#FFF0F7')
            : T.card);

  const badges = [];
  if (isCancelled) {
    badges.push({ text: 'Cancelled', bg: mode === 'dark' ? 'rgba(156,163,175,0.15)' : '#F3F4F6', fg: '#6B7280' });
  } else if (isNext) {
    badges.push({ text: 'Next up', bg: '#FC4693', fg: 'white' });
  }
  if (!isCancelled) {
    if (paid)   badges.push({ text: 'Paid ✓', bg: T.greenBg, fg: T.greenFg });
    else if (isUnpaidCompleted) badges.push({ text: 'Unpaid', bg: '#F59E0B', fg: 'white' });
  }

  if (job.status === 'Completed' && !job.actual_duration) {
    badges.push({ text: 'Log hours', bg: T.amberBg, fg: T.amberFg });
  }

  if (job.recurrence_rule) {
    const rMap = {
      weekly:   { text: '↻ Weekly',   bg: mode === 'dark' ? 'rgba(139,92,246,0.12)' : '#F5F3FF', fg: mode === 'dark' ? '#A78BFA' : '#5B21B6' },
      biweekly: { text: '↻ Biweekly', bg: mode === 'dark' ? 'rgba(99,102,241,0.12)'  : '#EEF2FF', fg: mode === 'dark' ? '#818CF8' : '#3730A3' },
      monthly:  { text: '↻ Monthly',  bg: T.amberBg, fg: T.amberFg },
    };
    if (rMap[job.recurrence_rule]) badges.push(rMap[job.recurrence_rule]);
  }
  if (conflict) badges.push({ text: '⚠ Tight gap', bg: T.redBg, fg: T.errorFg });

  return (
    <button
      type="button"
      onClick={() => onPress(job.id)}
      aria-label={`View details for ${job.service?.label} with ${job.client?.name}`}
      style={{
        width: '100%',
        textAlign: 'left',
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'block',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: job.client?.color ?? '#FC4693',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.serif, fontSize: 16, fontWeight: 500, flexShrink: 0,
        }}>
          {job.client?.init ?? '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px', color: T.ink, lineHeight: 1.2 }}>
            {job.service?.label} · {job.client?.name}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.ink, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {fmtTimeRange(job.start, job.end)}
          </div>
          {job.client?.address && (
            <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 500, color: T.inkMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {job.client.address.split(',')[0]}
            </div>
          )}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>
          {privacyOn ? '•••' : fmtMoney(job.total)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        {badges.map((b, i) => (
          <span key={i} style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.4px', textTransform: 'uppercase',
            padding: '2px 7px', borderRadius: 5,
            background: b.bg, color: b.fg,
          }}>{b.text}</span>
        ))}
        {job.client?.address && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.open(getNavigationUrl(job.client.address), '_blank'); }}
            aria-label={`Get directions to ${job.client.address}`}
            style={{
              marginLeft: badges.length > 0 ? 4 : 0, fontFamily: T.font, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.4px', textTransform: 'uppercase',
              padding: '2px 9px', borderRadius: 5, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${border}`, color: job.color,
              minHeight: 24, display: 'flex', alignItems: 'center'
            }}
          >↗ Directions</button>
        )}
      </div>

      {isCancelled && job.ai_context?.cancellation_reason && (
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginTop: 6, fontStyle: 'italic', paddingLeft: 4, borderLeft: `2px solid ${T.cardBorder}` }}>
          Reason: {job.ai_context.cancellation_reason}
        </div>
      )}
    </button>
  );
});

