import { useMemo, useEffect, useState, useCallback } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import AmtCell from '../components/ui/AmtCell';
import SectionLabel from '../components/ui/SectionLabel';
import CapeUpButton from '../components/ui/CapeUpButton';
import { useJobs, useBusiness, useClients } from '../data/useData';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { usePostJobSheet } from '../context/PostJobSheetContext';
import { useNewClientSheet } from '../context/NewClientSheetContext';
import { useAuth } from '../context/AuthContext';
import { updateDailyRoutes } from '../lib/maps';
import { useGeofence } from '../context/GeofenceContext';
import { generateCommandBrief, generatePrepNote, speakBrief, stopSpeaking } from '../data/ai';

const NOW = () => new Date();
const DOW_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function fmtTime12(d) {
  const h = d.getHours(), m = d.getMinutes();
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return { time: m === 0 ? `${hh}:00` : `${hh}:${m.toString().padStart(2,'0')}`, period: ap };
}

function dateBrief(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function LiveTimer({ startTime, T }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const start = new Date(startTime);
    const update = () => {
      const diff = new Date() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const inv = setInterval(update, 1000);
    return () => clearInterval(inv);
  }, [startTime]);

  return (
    <div style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 600, color: 'white', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
      {elapsed}
    </div>
  );
}

function getGreeting(name) {
  const hour = new Date().getHours();
  let g = 'Good morning';
  if (hour >= 12 && hour < 17) g = 'Good afternoon';
  else if (hour >= 17) g = 'Good evening';
  return <>{g},<br />{name}.</>;
}

export default function Home() {
  const { T, mode, privacyOn } = useAppTheme();
  const { jobs: allJobs, loading, error } = useJobs();
  const { clients, loading: clientsLoading } = useClients();
  const { openJob } = useJobDetailSheet();
  const { openPostJob } = usePostJobSheet();
  const { open: openNewClient } = useNewClientSheet();
  const { profile } = useAuth();
  const { handleClockOut } = useGeofence();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { business } = useBusiness();
  const today = NOW();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i));

  const firstName = profile?.first_name || business?.owner_name?.split(' ')[0] || 'there';

  const todayJobs = useMemo(() => {
    return allJobs
      .map(j => {
        const start = new Date(j.scheduled_at);
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j => sameDay(j.start, today) && j.status !== 'Cancelled')
      .sort((a, b) => a.start - b.start);
  }, [allJobs, today]);

  const overdueJobs = useMemo(() => {
    return allJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid' && Number(j.total) > 0)
      .map(j => ({ ...j, start: new Date(j.scheduled_at) }))
      .filter(j => (today - j.start) / 86400000 >= 1);
  }, [allJobs, today]);

  // Next up should be the first job that is NOT completed AND NOT paid, or the current active job
  const activeJob = todayJobs.find(j => j.status === 'Scheduled' && j.ai_context?.clock_in_time != null);
  const next = todayJobs.find(j => j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.end >= today);
  
  // A mission is only "done" if it's Completed AND Paid. 
  // We are "All Done" only when no jobs for today are Scheduled OR Unpaid.
  const allDone = todayJobs.length > 0 && !todayJobs.some(j => j.status === 'Scheduled' || j.payment_status !== 'Paid');

  const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);

  const todayJobsWithConflicts = useMemo(() => {
    return todayJobs.map((j, i) => {
      const conflict = (i < todayJobs.length - 1)
        && Math.round((todayJobs[i + 1].start - j.end) / 60000) < 60;
      return { ...j, conflict };
    });
  }, [todayJobs]);

  const heroJobId = activeJob?.id || next?.id;
  // Later jobs include anything Scheduled OR anything Completed but Unpaid (excluding the hero)
  const laterJobs = todayJobsWithConflicts.filter(j => j.id !== heroJobId && (j.status === 'Scheduled' || j.payment_status !== 'Paid'));

  const commandBrief = useMemo(() => next ? generateCommandBrief(next, business) : null, [next, business]);

  const handleToggleSpeak = (e) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speakBrief(commandBrief?.speechText, () => setIsSpeaking(false));
    }
  };

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Tight-gap detection: any consecutive pair where free time (gap minus known drive) < 15 min,
  // or gap < 60 min when drive time is unknown.
  const tightGap = useMemo(() => {
    for (let i = 0; i < todayJobs.length - 1; i++) {
      const a = todayJobs[i], b = todayJobs[i + 1];
      const gapMin = Math.round((b.start - a.end) / 60000);
      if (gapMin < 0) continue;
      const driveMin = Math.round((b.raw?.ai_context?.drive_to?.durationValue ?? 0) / 60);
      const threshold = driveMin > 0 ? driveMin + 15 : 60;
      if (gapMin < threshold) return { a, b, gapMin, driveMin };
    }
    return null;
  }, [todayJobs]);

  useEffect(() => {
    if (!loading && todayJobs.length > 0) {
      const needsUpdate = todayJobs.some(j => !j.ai_context?.drive_to);
      if (needsUpdate) {
        // Pass raw rows to updateDailyRoutes to ensure we have IDs for patching
        updateDailyRoutes(todayJobs.map(j => j.raw));
      }
    }
  }, [todayJobs, loading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* HERO */}
        <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '13px 15px 15px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -15, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,60,200,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 5 }}>
            ✦ Command Brief · {dateBrief(today)}
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: 'white', lineHeight: 1.15, marginBottom: 4 }}>
            {getGreeting(firstName)}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 12 }}>
            {todayJobs.length === 0
              ? 'No jobs scheduled for today.'
              : allDone 
                ? 'All done for today! 🦸‍♀️'
                : <>{todayJobs.length} {todayJobs.length === 1 ? 'house' : 'houses'} today{tightGap ? <> · <span style={{ color: T.pinkLabel }}>1 flag needs you</span></> : ''}</>
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: tightGap ? 12 : 0 }}>
            {[
              { n: String(todayJobs.length), l: 'Jobs' },
              { n: privacyOn ? '•••' : `$${revenueToday.toFixed(0)}`, l: 'Today' },
              { n: next?.ai_context?.drive_to?.duration || '—', l: 'Drive' },
            ].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '7px 6px', textAlign: 'center' }}>
                <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: 'white', letterSpacing: '-0.3px' }}>{s.n}</div>
                <div style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {tightGap && (
            <div style={{ background: 'rgba(245,158,11,0.11)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#FCD34D', marginBottom: 1 }}>Tight gap today</div>
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                  {tightGap.a.client_name} → {tightGap.b.client_name} = {tightGap.gapMin} min gap
                  {tightGap.driveMin > 0 && ` (incl. ~${tightGap.driveMin} min drive)`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 13px 0' }}>
          {loading && (
            <div style={{ padding: '12px 0', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>
          )}

          {error && (
            <div style={{ margin: '4px 0 10px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
              {error.message || 'Could not load today\'s jobs.'}
            </div>
          )}

          {!loading && !error && !clientsLoading && clients.length === 0 && (
            <div style={{ 
              background: 'linear-gradient(135deg, #1A0B2E 0%, #0D0517 100%)', 
              border: '2px solid #E91E6A', borderRadius: 16, padding: '24px 20px', 
              textAlign: 'center', marginBottom: 16, position: 'relative', overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(233,30,106,0.25)'
            }}>
              <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.25) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--grad-action)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(233,30,106,0.4)', border: '2px solid rgba(255,255,255,0.2)' }}>
                <span style={{ fontSize: 28 }}>✦</span>
              </div>
              <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 6 }}>Mission #1</div>
              <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: 'white', marginBottom: 10, letterSpacing: '-0.3px' }}>Initialize your first VIP</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 20, maxWidth: 260, margin: '0 auto 20px' }}>
                Your Executive Assistant is ready to learn. Add a client to see your first aligned Prep Note.
              </div>
              <button 
                onClick={() => openNewClient()}
                style={{ 
                  background: 'var(--grad-pink)', color: 'white', border: 'none', borderRadius: 12, 
                  padding: '12px 24px', fontFamily: T.font, fontSize: 13, fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(233,30,106,0.4)', cursor: 'pointer'
                }}
              >
                Add first client
              </button>
            </div>
          )}

          {!loading && !error && todayJobs.length === 0 && (
            <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '18px 16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginBottom: 4 }}>Nothing scheduled today.</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted }}>Tap the pink + button to book a job.</div>
            </div>
          )}

          {activeJob && (
            <>
              <SectionLabel>Active Job · {activeJob.client_name}</SectionLabel>
              <div style={{ 
                background: 'linear-gradient(135deg, #1A0B2E 0%, #0D0517 100%)', 
                border: '1.5px solid rgba(233,30,106,0.5)', 
                borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden', marginBottom: 12 
              }}>
                <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#FF78B0' }}>{activeJob.service_name}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: 'white', marginTop: 2 }}>{activeJob.client_name}</div>
                  </div>
                  <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '3px 8px', color: '#4ADE80', fontFamily: T.font, fontSize: 9, fontWeight: 700 }}>WORKING</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <LiveTimer startTime={activeJob.ai_context.clock_in_time} T={T} />
                  <button 
                    onClick={async (e) => { e.stopPropagation(); await handleClockOut(activeJob.id); openPostJob(activeJob.id); }}
                    style={{ 
                      background: '#E91E6A', color: 'white', border: 'none', borderRadius: 10, 
                      padding: '10px 20px', fontFamily: T.font, fontSize: 13, fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(233,30,106,0.3)', cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>

                <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="sm-pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
                  Auto-started on arrival
                </div>
              </div>
            </>
          )}

          {!activeJob && allDone && (
            <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, padding: '24px 16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🦸‍♀️</div>
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, marginBottom: 4 }}>All done for today!</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted }}>You've crushed your mission.</div>
            </div>
          )}

          {!activeJob && next && (
            <>
              <SectionLabel>Opening Act · {next.client_name}</SectionLabel>

              <div onClick={() => openJob(next.id)} style={{ background: T.hero, border: '1.5px solid rgba(233,30,106,0.32)', borderRadius: 14, padding: '11px 12px 12px', position: 'relative', overflow: 'hidden', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: -20, right: -15, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: T.pinkLabel }}>{next.service_name}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', color: 'white', marginTop: 2 }}>{next.client_name}</div>
                  </div>
                  <span style={{ background: '#E91E6A', color: 'white', borderRadius: 5, padding: '2px 7px', fontFamily: T.font, fontSize: 8.5, fontWeight: 700 }}>NEXT UP</span>
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 9 }}>
                  {fmtTime12(next.start).time} – {fmtTime12(next.end).time} {fmtTime12(next.end).period}
                </div>

                {commandBrief && (
                  <div style={{ 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 12, padding: '12px', marginBottom: 12,
                    position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ 
                      position: 'absolute', top: -20, right: -20, width: 60, height: 60, 
                      borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.1) 0%,transparent 70%)', 
                      pointerEvents: 'none' 
                    }} />
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T.pinkLabel }}>
                        ✦ Command Brief
                      </div>
                      <button 
                        onClick={handleToggleSpeak}
                        style={{ 
                          background: isSpeaking ? '#E91E6A' : 'rgba(255,255,255,0.1)', 
                          border: 'none', borderRadius: 20, padding: '4px 10px',
                          display: 'flex', alignItems: 'center', gap: 6,
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ fontSize: 10 }}>{isSpeaking ? '⏹' : '▶'}</span>
                        <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: 'white' }}>
                          {isSpeaking ? 'STOP' : 'LISTEN'}
                        </span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {commandBrief.bullets.map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12 }}>{b.icon}</span>
                          <span style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <CapeUpButton job={next} name={firstName} />

                <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 600, color: T.pinkLabel, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="sm-pulse" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.pinkLabel }} />
                  📍 Auto-timer ON · Starts when you arrive
                </div>
              </div>
            </>
          )}

          {laterJobs.length > 0 && (
            <>
              <SectionLabel>Later Today</SectionLabel>

              {laterJobs.map((j) => {
                const conflict = j.conflict;
                const isNext = next && j.id === next.id;
                const isUnpaid = j.status === 'Completed' && j.payment_status !== 'Paid';
                const border = isUnpaid ? 'rgba(233,30,106,0.5)' : conflict ? 'rgba(245,158,11,0.35)' : isNext ? 'rgba(233,30,106,0.38)' : T.cardBorder;
                const bg = isUnpaid ? (mode === 'dark' ? 'rgba(233,30,106,0.08)' : '#FFF0F7') : conflict ? (mode === 'dark' ? 'rgba(245,158,11,0.05)' : '#FFFBEB') : T.card;
                const t = fmtTime12(j.start);
                const e = fmtTime12(j.end);
                const amt = `$${Number(j.total || 0).toFixed(0)}`;
                const prepNote = generatePrepNote(j);

                return (
                  <div key={j.id} onClick={() => openJob(j.id)} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '9px 11px', marginBottom: 7, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: prepNote ? 7 : 0 }}>
                      <div style={{ width: 44, height: 46, borderRadius: 10, flexShrink: 0, background: conflict ? (mode === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF3C7') : T.pinkTint, border: `1px solid ${conflict ? 'rgba(245,158,11,0.22)' : T.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: conflict ? '#F59E0B' : T.pink, lineHeight: 1 }}>{t.time}</div>
                        <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.3px', marginTop: 2 }}>–{e.time}</div>
                        <div style={{ fontFamily: T.font, fontSize: 7, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.2px' }}>{e.period}</div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.client_name}</div>
                        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{j.service_name}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        {isUnpaid && <span style={{ background: '#FFE0EC', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#9B0D3A' }}>UNPAID</span>}
                        {conflict && <span style={{ background: '#FEF3C7', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>⚠ GAP</span>}
                        {isNext && <span style={{ background: '#E91E6A', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: 'white' }}>UP NEXT</span>}
                        <AmtCell amount={amt} size={13} />
                      </div>
                    </div>

                    {prepNote && (
                      <div style={{ borderTop: `1px dashed ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#FFE8F2'}`, paddingTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: conflict ? '#F59E0B' : T.pinkLabel, flexShrink: 0, marginTop: 1 }}>✦ PREP NOTE</span>
                        <span style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkSub, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{prepNote}</span>
                      </div>
                    )}
                  </div>
                );

              })}
            </>
          )}

          {/* 7-day week strip */}
          <SectionLabel>This Week</SectionLabel>
          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {weekDays.map((d, i) => {
                const isToday = sameDay(d, today);
                const dayJobs = allJobs.filter(j => j.status !== 'Cancelled' && sameDay(new Date(j.scheduled_at), d));
                const dots = Math.min(dayJobs.length, 3);
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '5px 2px 6px', borderRadius: 8, background: isToday ? '#1A0A12' : 'transparent' }}>
                    <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: isToday ? 'rgba(255,255,255,0.7)' : T.inkMuted }}>{DOW_SHORT[i]}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: isToday ? 'white' : T.ink, marginTop: 2, lineHeight: 1.2 }}>{d.getDate()}</div>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3, minHeight: 5 }}>
                      {Array.from({ length: dots }).map((_, k) => (
                        <span key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: isToday ? 'rgba(255,255,255,0.5)' : '#E91E6A', display: 'block' }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {overdueJobs.length > 0 && (
            <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, marginTop: 4 }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C' }}>
                  {overdueJobs.length} unpaid completed job{overdueJobs.length === 1 ? '' : 's'}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>
                  {overdueJobs.slice(0, 2).map(j => j.client_name).join(', ')}{overdueJobs.length > 2 ? '…' : ''}
                </div>
              </div>
              <AmtCell
                amount={`$${overdueJobs.reduce((s, j) => s + Number(j.total || 0), 0).toFixed(0)}`}
                size={12}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
