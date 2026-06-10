import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { useJobs } from '../data/useData';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { EmptySchedule } from '../components/ui/Illustrations';
import Swipeable from '../components/ui/Swipeable';
import WeekStrip from '../components/ui/WeekStrip';
import { softDeleteJob } from '../data/jobsRepo';
import { notifyDataChanged } from '../data/useData';
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
// Extract Toronto decimal hour (h + min/60) for block layout calculations.
function torontoDecimalHour(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return h + m / 60;
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
        : isUnpaidCompleted ? '#F59E0B' : paid ? '#22C55E' : '#E91E6A';

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
  const now = useNow();
  const [view, setView] = useState('Agenda');
  const [selectedDay, setSelectedDay] = useState(() => NOW());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(NOW()));
  const [agendaDayFilter, setAgendaDayFilter] = useState(null);
  const { openJob } = useJobDetailSheet();
  const handleJobPress = useCallback((id) => openJob(id), [openJob]);

  const { jobs: displayJobs, clients: clientLookup, loading, error } = useJobs();
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

  // PARKED: swipe-to-change-view removed (week view hidden) — restore with VIEWS + toggle to re-enable
  // const swipeRef = useRef({ x: 0, y: 0 });
  // const handleSwipeStart = useCallback((e) => { ... }, []);
  // const handleSwipeEnd = useCallback((e) => { ... }, []);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}
    >
      {/* Dark hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none',
        padding: '11px 13px 13px', 
        position: 'relative', 
        overflow: 'hidden', 
        flexShrink: 0 
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button 
              onClick={handlePrevWeek}
              style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 4, width: 22, height: 22, color: mode === 'dark' ? 'white' : T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >‹</button>
            <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, letterSpacing: '-0.4px', color: mode === 'dark' ? 'white' : T.ink }}>{monthYear}</div>
            <button 
              onClick={handleNextWeek}
              style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 4, width: 22, height: 22, color: mode === 'dark' ? 'white' : T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >›</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={handleToday}
              style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'}`, borderRadius: 6, padding: '3px 7px', color: mode === 'dark' ? 'white' : T.ink, fontFamily: T.font, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}
            >TODAY</button>
            <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 20, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.4px' }}>GCAL</span>
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

        {/* PARKED: view toggle (Week/Agenda) — restore VIEWS + swipe handler + WeekView render to re-enable */}
      </div>


      {loading && (
        <div style={{ padding: '10px 13px', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>
      )}
      {error && (
        <div style={{ margin: '6px 13px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
          {error.message || 'Could not load calendar.'}
        </div>
      )}

      {/* PARKED WeekView render — restore: view === 'Week' && WeekView with weekDays/allJobs/onPickDay/onJobPress/now */}
      {view === 'Agenda' && <AgendaView T={T} mode={mode} privacyOn={privacyOn} allJobs={allJobs} nextUpcoming={nextUpcoming} onJobPress={handleJobPress} dayFilter={agendaDayFilter} onClearFilter={() => setAgendaDayFilter(null)} />}
    </div>
  );
}

/* ------------------------------ WEEK VIEW (PARKED) ------------------------------ */
// Restore: rename _WeekView_PARKED → WeekView + re-add VIEWS const + swipe handlers + view toggle UI + WeekView render line
// eslint-disable-next-line no-unused-vars
function _WeekView_PARKED({ T, mode, weekDays, allJobs, onJobPress, now }) {
  const slotH = 46, startH = 6, endH = 22;
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  const jobsByDay = useMemo(() => {
    return weekDays.map(d => allJobs.filter(j => sameDay(j.start, d)));
  }, [weekDays, allJobs]);

  const nowDec = torontoDecimalHour(now);
  const weekContainsToday = weekDays.some(d => sameDay(d, now));
  const nowLineTop = weekContainsToday && nowDec >= startH && nowDec <= endH
    ? (nowDec - startH) * slotH
    : null;

  return (
    <div className="sm-scroll" style={{ flex: 1, overflow: 'auto', padding: '0 10px 80px', contain: 'strict' }}>

      {/* Day column headers — Mon 30, Tue 31, etc. */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 2, marginBottom: 4, position: 'sticky', top: 0, background: T.bg, zIndex: 5, paddingTop: 4 }}>
        <div />
        {weekDays.map((d, i) => {
          const isToday = sameDay(d, NOW());
          return (
            <div key={i} style={{ textAlign: 'center', paddingBottom: 4 }}>
              <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 700, color: isToday ? T.pink : T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
              </div>
              <div style={{
                fontFamily: T.font, fontSize: 13, fontWeight: 600,
                color: isToday ? 'white' : T.ink,
                background: isToday ? T.pink : 'transparent',
                borderRadius: '50%', width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '2px auto 0',
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div style={{ position: 'relative' }}>
        {hours.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 2, height: slotH, alignItems: 'stretch', position: 'relative' }}>
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 600, color: T.inkMuted, textAlign: 'right', paddingTop: 1 }}>
              {h === 12 ? '12P' : h < 12 ? `${h}A` : `${h - 12}P`}
            </div>
            {weekDays.map((_, i) => (
              <div key={i} style={{ borderTop: mode === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid #EDD5E4', borderLeft: i === 0 ? 'none' : mode === 'dark' ? '1px solid rgba(255,255,255,0.03)' : '1px solid #F9EDF5', position: 'relative' }}>
                {/* Half-hour dashed subdivision */}
                <div style={{ position: 'absolute', top: slotH / 2, left: 0, right: 0, borderTop: `1px dashed ${mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`, pointerEvents: 'none' }} />
              </div>
            ))}
          </div>
        ))}

        {/* Job cells overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 2, pointerEvents: 'none' }}>
          <div />
          {weekDays.map((d, i) => {
            const dayJobs = jobsByDay[i];
            return (
              <div key={i} style={{ position: 'relative' }}>
                {dayJobs.map(j => {
                  const startDec = torontoDecimalHour(j.start);
                  const endDec   = torontoDecimalHour(j.end);
                  const top = (startDec - startH) * slotH + 1;
                  const h   = Math.max((endDec - startDec) * slotH - 2, 18);
                  // Full 4-state color matching DayView
                  const bg = j.isCancelled
                    ? (mode === 'dark' ? 'rgba(156,163,175,0.12)' : '#F3F4F6')
                    : j.isUnpaidCompleted
                      ? (mode === 'dark' ? 'rgba(245,158,11,0.18)' : '#FEF3C7')
                      : j.paid
                        ? (mode === 'dark' ? 'rgba(34,197,94,0.18)' : '#DCFCE7')
                        : (mode === 'dark' ? 'rgba(233,30,106,0.2)' : '#FFE0EC');
                  const bd = j.color;
                  return (
                    <div key={j.id} onClick={() => onJobPress(j.id)} style={{
                      position: 'absolute', top, left: 1, right: 1, height: h,
                      background: bg, borderLeft: `2px solid ${bd}`, borderRadius: 4,
                      padding: '2px 3px', overflow: 'hidden',
                      pointerEvents: 'auto', cursor: 'pointer',
                    }}>
                      <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, color: bd, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {j.client?.name?.split(' ')[0] ?? '?'}
                      </div>
                      {h > 28 && (
                        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 500, color: T.inkMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {j.service?.label.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Current-time indicator */}
        {nowLineTop !== null && (
          <div style={{ position: 'absolute', top: nowLineTop, left: 28, right: 0, height: 2, background: '#E91E6A', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E91E6A', position: 'absolute', left: -5, top: -4 }} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, padding: '6px 10px', background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10 }}>
        <_LegendDot_PARKED T={T} color="#E91E6A" label="Scheduled" />
        <_LegendDot_PARKED T={T} color="#22C55E" label="Paid" />
        <_LegendDot_PARKED T={T} color="#F59E0B" label="Unpaid" />
        <_LegendDot_PARKED T={T} color="#9CA3AF" label="Cancelled" />
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function _LegendDot_PARKED({ T, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 600, color: T.inkSub }}>{label}</span>
    </div>
  );
}

/* ------------------------------ AGENDA VIEW ------------------------------ */

function AgendaView({ T, mode, privacyOn, allJobs, nextUpcoming, onJobPress, dayFilter, onClearFilter }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const j of allJobs) {
      if (dayFilter) {
        if (!sameDay(j.start, dayFilter)) continue;
      } else {
        if (j.end < NOW()) continue;
      }
      const key = torontoDateKey(j.start);
      if (!map.has(key)) map.set(key, { date: j.start, jobs: [] });
      map.get(key).jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) => a.date - b.date);
  }, [allJobs, dayFilter]);

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

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await softDeleteJob(jobId);
      notifyDataChanged();
    } catch (e) {
      console.error('Failed to delete job:', e);
      alert('Could not delete job.');
    }
  };

  return (
    <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 80px', contain: 'layout style paint' }}>
      {dayFilter && (
        <div onClick={onClearFilter} style={{ padding: '2px 0 10px', fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.pink, cursor: 'pointer' }}>
          ← All upcoming
        </div>
      )}

      {(summary.collected > 0 || summary.owed > 0 || summary.booked > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, paddingBottom: 8, borderBottom: mode === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #FFE8F2' }}>
          {!dayFilter && <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Upcoming</span>}
          {summary.collected > 0 && (
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: '#16A34A' }}>
              Collected <span style={{ fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>{privacyOn ? '•••' : `$${summary.collected.toFixed(2)}`}</span>
            </span>
          )}
          {summary.owed > 0 && (
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: '#B45309' }}>
              Owed <span style={{ fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>{privacyOn ? '•••' : `$${summary.owed.toFixed(2)}`}</span>
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
        <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <EmptySchedule size={100} />
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
            {dayFilter ? `Nothing scheduled for ${fmtDateHead(dayFilter)}.` : 'No upcoming jobs on your schedule.'}
          </div>
        </div>
      )}

      {grouped.map(group => {
        const isToday = sameDay(group.date, NOW());
        const conflicts = findSameDayConflicts(group.jobs);
        return (
          <div key={group.date.toISOString()} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink }}>
                {isToday ? 'Today · ' : ''}{fmtDateHead(group.date)}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted }}>
                {group.jobs.length} job{group.jobs.length > 1 ? 's' : ''}
              </div>
            </div>

            {group.jobs.map(j => {
              const conflict = conflicts.find(c => c.a.id === j.id || c.b.id === j.id);
              const isNext = nextUpcoming && j.id === nextUpcoming.id;
              return (
                <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                  <AgendaCard
                    T={T} mode={mode} privacyOn={privacyOn}
                    job={j}
                    isNext={isNext}
                    conflict={conflict}
                    onPress={onJobPress}
                  />
                </Swipeable>
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
        : (isNext ? '#E91E6A' : (paid ? '#86EFAC' : T.cardBorder));

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
    badges.push({ text: 'CANCELLED', bg: '#F3F4F6', fg: '#6B7280' });
  } else if (isNext) {
    badges.push({ text: 'NEXT UP', bg: '#E91E6A', fg: 'white' });
  }
  if (!isCancelled) {
    if (paid)   badges.push({ text: 'PAID ✓', bg: '#DCFCE7', fg: '#14532D' });
    else if (isUnpaidCompleted) badges.push({ text: 'UNPAID', bg: '#F59E0B', fg: 'white' });
  }
  
  if (job.status === 'Completed' && !job.actual_duration) {
    badges.push({ text: '⚠ HOURS NEEDED', bg: '#FEF3C7', fg: '#B45309' });
  }

  if (job.recurrence_rule) {
    const rMap = {
      weekly:   { text: '↻ WEEKLY',   bg: '#F5F3FF', fg: '#5B21B6' },
      biweekly: { text: '↻ BIWEEKLY', bg: '#EEF2FF', fg: '#3730A3' },
      monthly:  { text: '↻ MONTHLY',  bg: '#FEF3C7', fg: '#78350F' },
    };
    if (rMap[job.recurrence_rule]) badges.push(rMap[job.recurrence_rule]);
  }
  if (conflict) badges.push({ text: '⚠ <1HR GAP', bg: '#FECDD3', fg: '#881337' });

  return (
    <div onClick={() => onPress(job.id)} style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 14,
      padding: '10px 12px',
      marginBottom: 6,
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: job.client?.color ?? '#E91E6A',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.serif, fontSize: 15, fontWeight: 500, flexShrink: 0,
        }}>
          {job.client?.init ?? '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink }}>
            {job.service?.label} · {job.client?.name}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 11.5, fontWeight: 600, color: T.ink, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {fmtTimeRange(job.start, job.end)}
          </div>
          {job.client?.address && (
            <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 500, color: T.inkMuted, marginTop: 1, paddingLeft: 14 }}>
              {job.client.address.split(',')[0]}
            </div>
          )}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: T.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {privacyOn ? '•••' : `$${job.total}`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
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
            onClick={(e) => { e.stopPropagation(); window.open(getNavigationUrl(job.client.address), '_blank'); }}
            style={{
              marginLeft: 'auto', fontFamily: T.font, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.4px', textTransform: 'uppercase',
              padding: '2px 9px', borderRadius: 5, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${border}`, color: job.color,
            }}
          >↗ DIRECTIONS</button>
        )}
      </div>
      {isCancelled && job.ai_context?.cancellation_reason && (
        <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 4, fontStyle: 'italic' }}>
          Reason: {job.ai_context.cancellation_reason}
        </div>
      )}
    </div>
  );
});
