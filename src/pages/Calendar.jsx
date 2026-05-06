import { useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { useJobs, useBusiness } from '../data/useData';
import CapeUpButton from '../components/ui/CapeUpButton';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { useAuth } from '../context/AuthContext';
import { EmptySchedule, NoResults } from '../components/ui/Illustrations';
import Swipeable from '../components/ui/Swipeable';
import { softDeleteJob } from '../data/jobsRepo';
import { notifyDataChanged } from '../data/useData';

// Real "now" — was previously a hard-coded prototype anchor.
const NOW = () => new Date();

const VIEWS = ['Day', 'Week', 'Agenda'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function fmtTime(d) {
  const h = d.getHours(), m = d.getMinutes();
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
    .filter(j => j.status !== 'Cancelled')
    .map(j => {
      const c = clientLookup[j.client_id];
      const start = new Date(j.scheduled_at);
      const end = new Date(start.getTime() + (j.duration_est || 0) * 60000);
      const paid = j.payment_status === 'Paid';
      const isUnpaidCompleted = j.status === 'Completed' && !paid;
      
      // High-glance coloring: Amber for Unpaid, Green for Paid, Pink for Scheduled
      const color = isUnpaidCompleted ? '#F59E0B' : paid ? '#22C55E' : '#E91E6A';
      
      return {
        ...j,
        client: c ? { name: c.name, init: c.init, color: c.color, address: c.address } : null,
        service: { label: j.service_name || '—' },
        start, end, color, paid, isUnpaidCompleted
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
  const [view, setView] = useState('Day');
  const [selectedDay, setSelectedDay] = useState(() => NOW());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(NOW()));
  const { openJob } = useJobDetailSheet();
  const { profile } = useAuth();
  const { business } = useBusiness();
  const firstName = profile?.first_name || business?.owner_name?.split(' ')[0] || 'there';

  const { jobs: displayJobs, clients: clientLookup, loading, error } = useJobs();
  const allJobs = useMemo(() => enrichDisplayJobs(displayJobs, clientLookup), [displayJobs, clientLookup]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  
  const selectedDayJobs = useMemo(
    () => allJobs.filter(j => sameDay(j.start, selectedDay)),
    [allJobs, selectedDay]
  );
  const conflicts = useMemo(() => findSameDayConflicts(selectedDayJobs), [selectedDayJobs]);
  const nextUpcoming = useMemo(
    () => allJobs.find(j => j.start >= NOW() && j.status === 'Scheduled'),
    [allJobs]
  );

  const monthYear = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePickDay = (d) => {
    setSelectedDay(new Date(d));
    setView('Day');
  };

  const handlePrevWeek = () => setWeekStart(addDays(weekStart, -7));
  const handleNextWeek = () => setWeekStart(addDays(weekStart, 7));
  const handleToday = () => {
    const today = NOW();
    setWeekStart(startOfWeek(today));
    setSelectedDay(today);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
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

        {/* 7-day strip navigation (Hidden in Week view to avoid redundancy) */}
        {view !== 'Week' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 9 }}>
            {weekDays.map((d, i) => {
              const isToday = sameDay(d, NOW());
              const isSelected = sameDay(d, selectedDay);
              const jobsHere = allJobs.filter(j => sameDay(j.start, d));
              const dots = Math.min(jobsHere.length, 3);
              return (
                <div key={i}
                  onClick={() => handlePickDay(d)}
                  style={{ textAlign: 'center', padding: '4px 2px 5px', borderRadius: 8,
                    background: isSelected ? '#E91E6A' : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)'),
                    border: isSelected ? 'none' : `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
                    cursor: 'pointer' }}>
                  <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.8)' : (isToday ? T.pink : T.inkMuted) }}>{DOW[i]}</div>
                  <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: isSelected ? 'white' : (mode === 'dark' ? 'white' : T.ink), lineHeight: 1.2, marginTop: 2 }}>{d.getDate()}</div>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2, minHeight: 3 }}>
                    {Array.from({ length: dots }).map((_, k) => (
                      <span key={k} style={{ width: 3, height: 3, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.7)' : T.pink, display: 'block' }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderRadius: 9, padding: 3 }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} style={{
              flex: 1, padding: '6px 0', borderRadius: 7, textAlign: 'center',
              background: view === v ? '#E91E6A' : 'transparent',
              fontFamily: T.font, fontSize: 11, fontWeight: 600,
              color: view === v ? 'white' : (mode === 'dark' ? 'rgba(255,255,255,0.55)' : T.inkMuted),
              cursor: 'pointer', border: 'none',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Conflict banner (Day only, when relevant) */}
      {view === 'Day' && conflicts.length > 0 && (
        <div style={{ background: mode === 'dark' ? 'rgba(245,158,11,0.09)' : '#FEF3C7', borderBottom: '1px solid rgba(245,158,11,0.18)', padding: '6px 13px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ fontSize: 11 }}>⚠</span>
          <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: '#B45309', flex: 1 }}>
            Schedule conflict on {selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button 
            onClick={() => conflicts[0] && openJob(conflicts[0].a.id)}
            style={{ background: '#1C1C1E', color: 'white', border: 'none', borderRadius: 6, padding: '4px 9px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Fix
          </button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '10px 13px', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>
      )}
      {error && (
        <div style={{ margin: '6px 13px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
          {error.message || 'Could not load calendar.'}
        </div>
      )}

      {view === 'Day'    && <DayView    T={T} mode={mode} privacyOn={privacyOn} selectedDay={selectedDay} todayJobs={selectedDayJobs} nextUpcoming={nextUpcoming} onJobPress={openJob} firstName={firstName} />}
      {view === 'Week'   && <WeekView   T={T} mode={mode} weekDays={weekDays} allJobs={allJobs} onPickDay={handlePickDay} onJobPress={openJob} />}
      {view === 'Agenda' && <AgendaView T={T} mode={mode} privacyOn={privacyOn} allJobs={allJobs} nextUpcoming={nextUpcoming} onJobPress={openJob} firstName={firstName} />}
    </div>
  );
}

/* ------------------------------ DAY VIEW ------------------------------ */

function DayView({ T, mode, privacyOn, selectedDay, todayJobs, nextUpcoming, onJobPress, firstName }) {
  const slotH = 50, startH = 8, endH = 18;
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  const isToday = sameDay(selectedDay, NOW());

  // Drive gap decorations (between sequential same-day jobs)
  const gaps = [];
  for (let i = 0; i < todayJobs.length - 1; i++) {
    const a = todayJobs[i], b = todayJobs[i + 1];
    const gapMin = Math.round((b.start - a.end) / 60000);
    if (gapMin > 0) gaps.push({ from: a.end, to: b.start, minutes: gapMin, conflict: gapMin < 60 });
  }

  return (
    <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', position: 'relative' }}>
      {!isToday && (
        <div style={{ marginBottom: 12, padding: '4px 0', borderBottom: mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #FFE8F2' }}>
          <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.pink, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {fmtDateHead(selectedDay)}
          </div>
        </div>
      )}
      <div style={{ position: 'relative', minHeight: hours.length * slotH }}>
        {hours.map(h => (
          <div key={h} style={{ display: 'flex', height: slotH, alignItems: 'flex-start', gap: 7 }}>
            <div style={{ width: 36, fontFamily: T.font, fontSize: 9, fontWeight: 600, color: T.inkMuted, paddingTop: 2, textAlign: 'right', flexShrink: 0 }}>
              {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </div>
            <div style={{ flex: 1, borderTop: mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #FFE8F2' }} />
          </div>
        ))}

        {todayJobs.length === 0 && (
          <div style={{ 
            position: 'absolute', top: 60, left: 43, right: 0, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '40px 20px', textAlign: 'center', opacity: 0.8
          }}>
            <EmptySchedule size={80} />
            <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted }}>
              Nothing scheduled for this day.
            </div>
          </div>
        )}

        {todayJobs.map(j => {
          const startDec = j.start.getHours() + j.start.getMinutes() / 60;
          const endDec   = j.end.getHours()   + j.end.getMinutes() / 60;
          const top = (startDec - startH) * slotH + 2;
          const h   = (endDec - startDec) * slotH - 4;
          const bg = j.isUnpaidCompleted
            ? (mode === 'dark' ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
            : j.paid
              ? (mode === 'dark' ? 'rgba(34,197,94,0.1)'  : '#F0FFF5')
              : (mode === 'dark' ? 'rgba(233,30,106,0.12)' : '#FFF0F7');
          return (
            <div key={j.id} onClick={() => onJobPress(j.id)} style={{ position: 'absolute', top, left: 43, right: 0, height: h, background: bg, border: `1.5px solid ${j.color}35`, borderLeft: `3px solid ${j.color}`, borderRadius: 9, padding: '6px 9px', overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ fontFamily: T.serif, fontSize: 12, fontWeight: 500, color: j.color, letterSpacing: '-0.2px' }}>{j.service?.label}</div>
              <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkSub, marginTop: 1 }}>{j.client?.name}</div>
              {h > 55 && (
                <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, marginTop: 2 }}>
                  {fmtTimeRange(j.start, j.end)}
                </div>
              )}
              {j.status === 'Completed' && !j.actual_duration && (
                <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#B45309', marginTop: 1 }}>⚠ MANUAL HOURS NEEDED</div>
              )}
              {h > 80 && j.notes && (
                <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, marginTop: 3, lineHeight: 1.35, fontStyle: 'italic' }}>
                  {j.notes}
                </div>
              )}
              {h > 50 && (
                <div style={{ position: 'absolute', bottom: 5, right: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {!privacyOn && <span style={{ fontFamily: T.serif, fontSize: 11, fontWeight: 500, color: j.color }}>${j.total}</span>}
                  {privacyOn && <span style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, letterSpacing: '2px' }}>•••</span>}
                  <span style={{ color: T.inkMuted, fontSize: 9 }}>·</span>
                  <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: j.color, letterSpacing: '0.3px', cursor: 'pointer' }}>↗ Directions</span>
                </div>
              )}
            </div>
          );
        })}

        {gaps.map((d, i) => {
          const fromDec = d.from.getHours() + d.from.getMinutes() / 60;
          const toDec   = d.to.getHours()   + d.to.getMinutes() / 60;
          const top = (fromDec - startH) * slotH + 4;
          const h   = (toDec - fromDec) * slotH - 8;
          if (h <= 0) return null;
          return (
            <div key={i} style={{ position: 'absolute', top, left: 43, right: 0, height: h, borderLeft: `2px dashed ${d.conflict ? '#F59E0B' : 'rgba(255,255,255,0.12)'}`, marginLeft: 4, display: 'flex', alignItems: 'center' }}>
              <span style={{ marginLeft: 7, fontFamily: T.font, fontSize: 8.5, fontWeight: 600, color: d.conflict ? '#F59E0B' : T.inkMuted }}>
                {d.minutes} min{d.conflict ? ' ⚠' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* GO button on next upcoming today */}
      {nextUpcoming && sameDay(nextUpcoming.start, NOW()) && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          <CapeUpButton
            job={nextUpcoming}
            name={firstName}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ WEEK VIEW ------------------------------ */

function WeekView({ T, mode, weekDays, allJobs, onPickDay, onJobPress }) {
  const slotH = 46, startH = 8, endH = 18;
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  const jobsByDay = useMemo(() => {
    return weekDays.map(d => allJobs.filter(j => sameDay(j.start, d)));
  }, [weekDays, allJobs]);

  return (
    <div className="sm-scroll" style={{ flex: 1, overflow: 'auto', padding: '6px 10px 14px' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 2, marginBottom: 4, position: 'sticky', top: 0, background: T.bg, zIndex: 2, paddingBottom: 3 }}>
        <div />
        {weekDays.map((d, i) => {
          const isToday = sameDay(d, NOW());
          const dayJobs = jobsByDay[i];
          const count = dayJobs.length;
          return (
            <div key={i} onClick={() => onPickDay(d)} style={{ textAlign: 'center', cursor: 'pointer', padding: '3px 0', borderRadius: 6, background: isToday ? 'rgba(233,30,106,0.12)' : 'transparent' }}>
              <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.3px' }}>{DOW[i]}</div>
              <div style={{ fontFamily: T.serif, fontSize: 12, fontWeight: 500, color: isToday ? '#E91E6A' : T.ink, marginTop: 1 }}>{d.getDate()}</div>
              {count > 0 && <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 600, color: T.inkMuted, marginTop: 1 }}>{count} job{count > 1 ? 's' : ''}</div>}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ position: 'relative' }}>
        {hours.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 2, height: slotH, alignItems: 'stretch' }}>
            <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 600, color: T.inkMuted, textAlign: 'right', paddingTop: 1 }}>
              {h === 12 ? '12P' : h < 12 ? `${h}A` : `${h - 12}P`}
            </div>
            {weekDays.map((_, i) => (
              <div key={i} style={{ borderTop: mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #FFE8F2', borderLeft: i === 0 ? 'none' : mode === 'dark' ? '1px solid rgba(255,255,255,0.03)' : '1px solid #FFF0F7' }} />
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
                  const startDec = j.start.getHours() + j.start.getMinutes() / 60;
                  const endDec   = j.end.getHours()   + j.end.getMinutes() / 60;
                  const top = (startDec - startH) * slotH + 1;
                  const h   = Math.max((endDec - startDec) * slotH - 2, 18);
                  const paid = j.paid;
                  const bg  = paid ? (mode === 'dark' ? 'rgba(34,197,94,0.18)' : '#DCFCE7')
                                   : (mode === 'dark' ? 'rgba(233,30,106,0.2)' : '#FFE0EC');
                  const bd  = paid ? '#22C55E' : '#E91E6A';
                  return (
                    <div key={j.id} onClick={() => onJobPress(j.id)} style={{
                      position: 'absolute', top, left: 1, right: 1, height: h,
                      background: bg, borderLeft: `2px solid ${bd}`, borderRadius: 4,
                      padding: '2px 3px', overflow: 'hidden',
                      pointerEvents: 'auto', cursor: 'pointer',
                    }}>
                      <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 700, color: bd, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {j.client?.init}·{j.service?.label.split(' ')[0]}
                      </div>
                      {h > 26 && (
                        <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 500, color: T.inkMuted, marginTop: 1, whiteSpace: 'nowrap' }}>
                          {fmtTime(j.start)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, padding: '6px 10px', background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10 }}>
        <LegendDot T={T} color="#E91E6A" label="Unpaid" />
        <LegendDot T={T} color="#22C55E" label="Paid" />
        <LegendDot T={T} color="#F59E0B" label="Conflict" />
      </div>
    </div>
  );
}

function LegendDot({ T, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 600, color: T.inkSub }}>{label}</span>
    </div>
  );
}

/* ------------------------------ AGENDA VIEW ------------------------------ */

function AgendaView({ T, mode, privacyOn, allJobs, nextUpcoming, onJobPress, firstName }) {
  // Group jobs by date; only show upcoming + today.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const j of allJobs) {
      if (j.end < NOW()) continue;
      const key = j.start.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { date: j.start, jobs: [] });
      map.get(key).jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) => a.date - b.date);
  }, [allJobs]);

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
    <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 14px' }}>
      {grouped.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <EmptySchedule size={100} />
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
            No upcoming jobs on your schedule.
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

            {isToday && nextUpcoming && sameDay(nextUpcoming.start, NOW()) && (
              <div style={{ marginTop: 8 }}>
                <CapeUpButton
                  job={nextUpcoming}
                  name={firstName}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgendaCard({ T, mode, privacyOn, job, isNext, conflict, onPress }) {
  const paid = job.paid;
  const isUnpaidCompleted = job.isUnpaidCompleted;
  
  const border = conflict 
    ? '#F59E0B' 
    : isUnpaidCompleted 
      ? '#F59E0B' 
      : (isNext ? '#E91E6A' : (paid ? '#86EFAC' : T.cardBorder));
  
  const bg = isUnpaidCompleted
    ? (mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FEF3C7')
    : paid
      ? (mode === 'dark' ? 'rgba(34,197,94,0.08)' : '#F0FFF5')
      : (isNext
          ? (mode === 'dark' ? 'rgba(233,30,106,0.1)' : '#FFF0F7')
          : T.card);

  const badges = [];
  if (isNext) badges.push({ text: 'NEXT UP', bg: '#E91E6A', fg: 'white' });
  if (paid)   badges.push({ text: 'PAID ✓', bg: '#DCFCE7', fg: '#14532D' });
  else if (isUnpaidCompleted) badges.push({ text: 'UNPAID', bg: '#F59E0B', fg: 'white' });
  else        badges.push({ text: 'UNPAID', bg: '#FFE0EC', fg: '#9B0D3A' });
  
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
  badges.push({ text: '📅 GCAL', bg: '#DCFCE7', fg: '#14532D' });
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
          <div style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {fmtTimeRange(job.start, job.end)} · {job.client?.address?.split(',')[0]}
          </div>
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: T.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {privacyOn ? '•••' : `$${job.total}`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
        {badges.map((b, i) => (
          <span key={i} style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.4px', textTransform: 'uppercase',
            padding: '2px 7px', borderRadius: 5,
            background: b.bg, color: b.fg,
          }}>{b.text}</span>
        ))}
      </div>
    </div>
  );
}
