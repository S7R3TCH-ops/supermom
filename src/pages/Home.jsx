import { useMemo, useEffect, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import AmtCell from '../components/ui/AmtCell';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import CapeUpButton from '../components/ui/CapeUpButton';
import { useJobs, useBusiness, useClients } from '../data/useData';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { usePostJobSheet } from '../context/PostJobSheetContext';
import { useNewClientSheet } from '../context/NewClientSheetContext';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { useAuth } from '../context/AuthContext';
import { updateDailyRoutes } from '../lib/maps';
import { useGeofence } from '../context/GeofenceContext';
import { generateCommandBrief, generatePrepNote, speakBrief, stopSpeaking } from '../data/ai';
import { getPersistentDailyMessage, getTimeBasedGreeting } from '../lib/greetings';

const NOW = () => new Date();
const DOW_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function fmtTime12(d) {
  const h = d.getHours(), m = d.getMinutes();
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return { time: m === 0 ? `${hh}:00` : `${hh}:${m.toString().padStart(2,'0')}`, period: ap };
}

function fmtTimeRange(start, end) {
  const s = fmtTime12(start);
  const e = fmtTime12(end);
  return `${s.time} – ${e.time} ${e.period}`;
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
    <Title style={{ fontSize: 32, color: 'white', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
      {elapsed}
    </Title>
  );
}

const EmptyState = ({ persona, allDone, T }) => {
  const msg = allDone 
    ? {
        casual: "All missions accomplished! Your cape is in the wash. Time for a glass of wine? 🍷",
        coach: "You crushed it today! Take a moment to breathe and celebrate your wins. 🌟",
        professional: "Daily objectives secured. Systems transitioning to standby. Excellent work. ✅"
      }
    : {
        casual: "The world is safe for now! Tactical nap? I won't tell. ☕",
        coach: "A clear board is a clear mind. What's one thing you'll do for YOU today? ✨",
        professional: "Zero pending operations. Strategic window open for administrative refinement. 📊"
      };
  
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, marginBottom: 12 }}>
      <Subheading style={{ fontSize: 16, color: T.ink, lineHeight: 1.5 }}>
        {msg[persona] || msg.professional}
      </Subheading>
    </div>
  );
};

export default function Home() {
  const [runtimeError, setRuntimeError] = useState(null);
  
  useEffect(() => {
    const handleError = (e) => {
      setRuntimeError(e.message || "Unknown Runtime Error");
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (runtimeError) {
    return (
      <div style={{ padding: 24, color: '#E91E6A', background: '#0A0A0A', height: '100svh' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>✦ Critical Error</div>
        <div style={{ fontSize: 13, fontFamily: 'monospace', opacity: 0.8 }}>{runtimeError}</div>
      </div>
    );
  }

  const themeCtx = useAppTheme();
  const jobsCtx = useJobs();
  const clientsCtx = useClients();
  const detailSheet = useJobDetailSheet();
  const postJobSheet = usePostJobSheet();
  const newClientSheet = useNewClientSheet();
  const financeSheet = useFinanceDetailSheet();
  const authCtx = useAuth();
  const { handleClockOut } = useGeofence();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bizCtx = useBusiness();

  // Safety check for context
  if (!themeCtx || !jobsCtx || !authCtx) {
    return <div style={{ padding: 20, color: 'white' }}>Initializing context...</div>;
  }

  const { T, mode, privacyOn } = themeCtx;
  const { jobs: allJobs, loading, error } = jobsCtx;
  const { clients, loading: clientsLoading } = clientsCtx;
  const { profile } = authCtx;
  const { business } = bizCtx;
  
  // Use a stable reference for "today"
  const [today] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [missionDismissed, setMissionDismissed] = useState(() => {
    try {
      return localStorage.getItem('sm_mission_dismissed') === 'true';
    } catch (e) {
      return false;
    }
  });
  
  const persona = business?.ai_profile?.style || 'professional';
  
  const briefingMsg = useMemo(() => {
    try {
      return getPersistentDailyMessage('briefing', persona);
    } catch (e) {
      console.error("Briefing Error:", e);
      return "Ready for the day.";
    }
  }, [persona]);

  const scheduleMsg = useMemo(() => {
    try {
      return getPersistentDailyMessage('schedule', persona);
    } catch (e) {
      console.error("Schedule Error:", e);
      return "Schedule clear.";
    }
  }, [persona]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  const firstName = useMemo(() => {
    try {
      if (business?.owner_name) return business.owner_name.split(' ')[0];
      if (profile?.first_name) return profile.first_name;
    } catch (e) {}
    return 'there';
  }, [business, profile]);

  const todayJobs = useMemo(() => {
    if (!allJobs) return [];
    return allJobs
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j => j && sameDay(j.start, today) && j.status !== 'Cancelled')
      .sort((a, b) => a.start - b.start);
  }, [allJobs, today]);

  const allDone = todayJobs.length > 0 && !todayJobs.some(j => j.status === 'Scheduled' || j.payment_status !== 'Paid');

  const timeBasedGreeting = useMemo(() => {
    try {
      return getTimeBasedGreeting(firstName, persona, !allDone);
    } catch (e) {
      return `Hello, ${firstName}!`;
    }
  }, [firstName, persona, allDone]);

  const filteredSelectedJobs = useMemo(() => {
    if (!allJobs) return [];
    return allJobs
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j => j && sameDay(j.start, selectedDate) && j.status !== 'Cancelled')
      .sort((a, b) => a.start - b.start);
  }, [allJobs, selectedDate]);

  const overdueJobs = useMemo(() => {
    if (!allJobs) return [];
    return allJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid' && Number(j.total) > 0)
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        return isNaN(start.getTime()) ? null : { ...j, start };
      })
      .filter(j => j && (today - j.start) / 86400000 >= 1);
  }, [allJobs, today]);

  const activeJob = todayJobs.find(j => j.status === 'Scheduled' && j.ai_context?.clock_in_time != null);
  const next = todayJobs.find(j => j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.start >= today);
  
  const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);
  const completedJobsCount = todayJobs.filter(j => j.status === 'Completed').length;
  const progressPercent = todayJobs.length > 0 ? (completedJobsCount / todayJobs.length) * 100 : 0;

  const isSelectedToday = sameDay(selectedDate, today);

  const categorizedJobs = useMemo(() => {
    const now = new Date();
    const incomplete = [];
    const upcoming = [];
    const done = [];

    filteredSelectedJobs.forEach(j => {
      if (j.id === activeJob?.id) return; 

      const isCompleted = j.status === 'Completed';
      const isPast = j.end < now;

      if (isCompleted) {
        done.push(j);
      } else if (isSelectedToday && isPast) {
        incomplete.push(j);
      } else {
        upcoming.push(j);
      }
    });

    return { incomplete, upcoming, done };
  }, [filteredSelectedJobs, activeJob, isSelectedToday]);

  const commandBrief = useMemo(() => {
    if (!next) return null;
    try {
      return generateCommandBrief(next, business);
    } catch (e) {
      console.error("Error generating command brief:", e);
      return null;
    }
  }, [next, business]);

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
        updateDailyRoutes(todayJobs.map(j => j.raw));
      }
    }
  }, [todayJobs, loading]);

  const openJob = detailSheet.openJob;
  const openPostJob = postJobSheet.openPostJob;
  const openNewClient = newClientSheet.open;
  const openDetail = financeSheet.open;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* HERO */}
        <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '13px 15px 18px', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative Pattern Overlay */}
          <div style={{ position: 'absolute', inset: 0, opacity: mode === 'dark' ? 0.04 : 0.1, pointerEvents: 'none' }}>
            <svg width="100%" height="100%">
              <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill={mode === 'dark' ? 'white' : T.pink} />
              </pattern>
              <rect width="100%" height="100%" fill="url(#hero-dots)" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div style={{ flex: 1 }}>
              <Caption style={{ fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 5 }}>
                ✦ Command Brief · {dateBrief(today)}
              </Caption>
              <Title style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: mode === 'dark' ? 'white' : T.ink, lineHeight: 1.15, marginBottom: 4 }}>
                {timeBasedGreeting}
              </Title>
            </div>
            {todayJobs.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 14, fontWeight: 800, color: mode === 'dark' ? 'white' : T.pink }}>{Math.round(progressPercent)}%</Text>
                <Caption style={{ fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase' }}>Done</Caption>
              </div>
            )}
          </div>

          <Text style={{ fontSize: 11.5, color: mode === 'dark' ? 'rgba(255,255,255,0.6)' : T.inkSub, lineHeight: 1.5, marginBottom: 14, position: 'relative' }}>
            {todayJobs.length === 0
              ? briefingMsg
              : allDone 
                ? briefingMsg
                : <>{todayJobs.length} {todayJobs.length === 1 ? 'house' : 'houses'} today{tightGap ? <> · <span style={{ color: T.pink }}>1 flag needs you</span></> : ''}</>
            }
          </Text>

          {/* Mission Progress Bar */}
          {todayJobs.length > 0 && (
            <div style={{ position: 'relative', height: 4, background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 2, marginBottom: 18, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressPercent}%`, background: T.pink, borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: tightGap ? 12 : 0, position: 'relative' }}>
            {[
              { n: String(todayJobs.length), l: 'Jobs', onClick: () => openDetail("Today's Schedule", todayJobs, 'jobs') },
              { n: privacyOn ? '•••' : `$${revenueToday.toFixed(0)}`, l: 'Today', onClick: () => openDetail("Today's Revenue", todayJobs, 'jobs') },
              { n: next?.ai_context?.drive_to?.duration || '—', l: 'Drive' },
            ].map(s => (
              <div key={s.l} onClick={s.onClick} style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.4)', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)'}`, borderRadius: 10, padding: '7px 6px', textAlign: 'center', cursor: s.onClick ? 'pointer' : 'default' }}>
                <Subheading style={{ fontSize: 15, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-0.3px' }}>{s.n}</Subheading>
                <Caption style={{ fontWeight: 600, color: mode === 'dark' ? 'rgba(255,255,255,0.38)' : T.inkMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</Caption>
              </div>
            ))}
          </div>

          {tightGap && (
            <div style={{ background: 'rgba(245,158,11,0.11)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9, position: 'relative', marginTop: 12 }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#FCD34D', marginBottom: 1 }}>Tight gap today</Text>
                <Caption style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                  {tightGap.a.client_name} → {tightGap.b.client_name} = {tightGap.gapMin} min gap
                </Caption>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 13px 0' }}>
          {loading && <div style={{ padding: '12px 0', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>}
          {error && (
            <div style={{ margin: '4px 0 10px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
              {error.message || 'Could not load today\'s jobs.'}
            </div>
          )}

          {!loading && !error && !clientsLoading && clients.length === 0 && !missionDismissed && (
            <div style={{ background: mode === 'dark' ? 'linear-gradient(135deg, #1A0B2E 0%, #0D0517 100%)' : 'linear-gradient(135deg, #FFF5F7 0%, #FFE9F0 100%)', border: `2px solid ${T.pink}`, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              <button onClick={() => { setMissionDismissed(true); localStorage.setItem('sm_mission_dismissed', 'true'); }} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: mode === 'dark' ? 'rgba(255,255,255,0.3)' : T.inkMuted, cursor: 'pointer' }}>×</button>
              <Subheading style={{ fontSize: 20, color: mode === 'dark' ? 'white' : T.ink, marginBottom: 10 }}>Initialize your first VIP</Subheading>
              <button onClick={() => openNewClient()} style={{ background: T.pink, color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add first client</button>
            </div>
          )}

          <SectionLabel>This Week</SectionLabel>
          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {weekDays.map((d, i) => {
                const isSelected = sameDay(d, selectedDate);
                const isActuallyToday = sameDay(d, today);
                const dayJobsCount = (allJobs || []).filter(j => j.status !== 'Cancelled' && sameDay(new Date(j.scheduled_at), d)).length;
                return (
                  <div key={i} onClick={() => setSelectedDate(d)} style={{ textAlign: 'center', padding: '5px 2px 6px', borderRadius: 8, background: isSelected ? (mode === 'dark' ? '#1A0B2E' : T.pinkTint) : 'transparent', border: `1.5px solid ${isSelected ? T.pink : 'transparent'}`, cursor: 'pointer' }}>
                    <Caption style={{ fontSize: 7.5, fontWeight: 700, color: isActuallyToday ? T.pink : (isSelected ? T.ink : T.inkMuted) }}>{DOW_SHORT[i]}</Caption>
                    <Text style={{ fontSize: 13, fontWeight: 500, color: isSelected ? T.pink : T.ink, fontFamily: T.serif }}>{d.getDate()}</Text>
                    {dayJobsCount > 0 && <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}><span style={{ width: 4, height: 4, borderRadius: '50%', background: T.pink }} /></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {activeJob && isSelectedToday && (
            <>
              <SectionLabel>Active Mission · {activeJob.client_name}</SectionLabel>
              <div style={{ background: mode === 'dark' ? 'linear-gradient(135deg, #1A0B2E 0%, #0D0517 100%)' : T.hero, border: `1.5px solid ${mode === 'dark' ? 'rgba(233,30,106,0.5)' : T.cardBorder}`, borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Subheading style={{ fontSize: 20, color: mode === 'dark' ? 'white' : T.ink }}>{activeJob.client_name}</Subheading>
                  <Caption style={{ fontSize: 10, color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : T.inkSub, fontWeight: 600 }}>Scheduled: {fmtTime12(activeJob.start).time} – {fmtTime12(activeJob.end).time}</Caption>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
                  <LiveTimer startTime={activeJob.ai_context.clock_in_time} T={T} mode={mode} />
                  <button onClick={async (e) => { e.stopPropagation(); await handleClockOut(activeJob.id); openPostJob(activeJob.id); }} style={{ background: T.pink, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>Done</button>
                </div>
              </div>
            </>
          )}

          {!activeJob && next && isSelectedToday && (
            <>
              <SectionLabel>Opening Act · {next.client_name}</SectionLabel>
              <div onClick={() => openJob(next.id)} style={{ background: T.hero, border: `1.5px solid ${mode === 'dark' ? 'rgba(233,30,106,0.32)' : T.cardBorder}`, borderRadius: 14, padding: '12px', marginBottom: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: mode === 'dark' ? 'radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)' : `radial-gradient(circle, ${T.pink}08 1px, transparent 1px)`, backgroundSize: '15px 15px', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <Subheading style={{ fontSize: 18, color: mode === 'dark' ? 'white' : T.ink }}>{next.client_name}</Subheading>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={mode === 'dark' ? 'rgba(255,255,255,0.6)' : T.inkSub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <span style={{ fontFamily: T.font, fontSize: 11, color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : T.inkSub, fontWeight: 600 }}>{fmtTime12(next.start).time} – {fmtTime12(next.end).time} {fmtTime12(next.end).period}</span>
                    </div>
                    {!sameDay(next.start, today) && (
                      <>
                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: mode === 'dark' ? 'rgba(255,255,255,0.3)' : T.cardBorder }} />
                        <span style={{ fontFamily: T.font, fontSize: 11, color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : T.inkSub, fontWeight: 600 }}>{dateBrief(next.start)}</span>
                      </>
                    )}
                  </div>
                  {commandBrief && (
                    <div style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)', borderRadius: 12, padding: '12px', marginBottom: 12, border: mode === 'dark' ? 'none' : `1px solid ${T.cardBorder}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink }}>✦ Command Brief</div>
                        <button onClick={handleToggleSpeak} style={{ background: isSpeaking ? T.pink : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : T.pinkTint), border: 'none', borderRadius: 20, padding: '4px 10px', color: isSpeaking ? 'white' : T.pink, fontSize: 9, cursor: 'pointer' }}>{isSpeaking ? 'STOP' : 'LISTEN'}</button>
                      </div>
                      {commandBrief.bullets.map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, color: mode === 'dark' ? 'rgba(255,255,255,0.8)' : T.inkSub, marginBottom: 4 }}><span>{b.icon}</span><span>{b.text}</span></div>
                      ))}
                    </div>
                  )}
                  <CapeUpButton job={next} name={firstName} />
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 12 }}>
            {categorizedJobs.incomplete.length > 0 && (
              <>
                {categorizedJobs.incomplete.length > 3 && <SectionLabel color="#F59E0B">✦ Incomplete Missions · Needs Update</SectionLabel>}
                {categorizedJobs.incomplete.map(j => <JobCard key={j.id} j={j} T={T} mode={mode} openJob={openJob} variant="incomplete" today={today} />)}
              </>
            )}

            {categorizedJobs.upcoming.length > 0 && (
              <>
                {(categorizedJobs.upcoming.length > 3 || !isSelectedToday) && <SectionLabel>{isSelectedToday ? 'Upcoming Missions' : `Schedule: ${dateBrief(selectedDate)}`}</SectionLabel>}
                {categorizedJobs.upcoming.map(j => <JobCard key={j.id} j={j} T={T} mode={mode} openJob={openJob} next={next} today={today} />)}
              </>
            )}

            {isSelectedToday && categorizedJobs.upcoming.length === 0 && categorizedJobs.incomplete.length === 0 && !activeJob && (
              <EmptyState persona={persona} allDone={allDone} T={T} />
            )}

            {isSelectedToday && categorizedJobs.done.length > 0 && (
              <>
                {categorizedJobs.done.length > 3 && <SectionLabel>Missions Accomplished · Today</SectionLabel>}
                {categorizedJobs.done.map(j => <JobCard key={j.id} j={j} T={T} mode={mode} openJob={openJob} variant="done" today={today} />)}
              </>
            )}
          </div>

          {overdueJobs.length > 0 && isSelectedToday && (
            <div onClick={() => openDetail("Unpaid Jobs", overdueJobs, 'jobs')} style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, cursor: 'pointer' }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C' }}>{overdueJobs.length} unpaid completed jobs</div>
                <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>{overdueJobs.slice(0, 2).map(j => j.client_name).join(', ')}</div>
              </div>
              <AmtCell amount={`$${overdueJobs.reduce((s, j) => s + Number(j.total || 0), 0).toFixed(0)}`} size={12} />
            </div>
          )}

          {/* Motivation Footer Card */}
          <div style={{
            marginTop: 32, padding: '20px 16px', borderRadius: 16,
            background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(233,30,106,0.04)',
            border: `1px dashed ${T.cardBorder}`, textAlign: 'center',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -20, left: -20, width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${T.pinkGlow} 0%, transparent 70%)`, opacity: 0.5 }} />
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 800, color: T.pink, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>✦ Power Up</div>
            <div style={{ fontFamily: T.serif, fontSize: 15, color: T.ink, lineHeight: 1.5, fontStyle: 'italic' }}>
              {allDone 
                ? "You've earned this rest. Recharge for the next adventure!"
                : "One house at a time. You've got the magic touch!"
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobCard({ j, T, mode, openJob, next, variant, today }) {
  const isNext = next && j.id === next.id;
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isIncomplete = variant === 'incomplete';
  const isToday = sameDay(j.start, today);
  
  const needsDuration = isCompleted && !j.actual_duration;

  let border = T.cardBorder, bg = T.card, accentColor = T.pink, label = null;

  if (isIncomplete) {
    border = '#F59E0B'; // Deep Amber
    bg = mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FFFBEB';
    accentColor = '#D97706';
    label = { text: 'PAST DUE', color: '#F59E0B' };
  } else if (isCompleted && !isPaid) {
    border = mode === 'dark' ? '#FBBF24' : '#F59E0B'; // Gold/Amber
    bg = mode === 'dark' ? 'rgba(251,191,36,0.08)' : '#FEFDF0';
    accentColor = '#B45309';
    label = { text: 'UNPAID', color: '#F59E0B' };
  } else if (isCompleted && isPaid) {
    border = mode === 'dark' ? 'rgba(34,197,94,0.3)' : '#22C55E';
    bg = mode === 'dark' ? 'rgba(34,197,94,0.05)' : '#F0FFF4';
    accentColor = '#22C55E';
    label = { text: 'PAID ✓', color: '#22C55E' };
  } else if (isNext) {
    border = 'rgba(233,30,106,0.38)';
    accentColor = '#E91E6A';
    label = { text: 'UP NEXT', color: '#E91E6A' };
  }

  const prepNote = generatePrepNote(j);
  const startTime = fmtTime12(j.start);
  const endTime = fmtTime12(j.end);

  return (
    <div onClick={() => openJob(j.id)} style={{ 
      background: bg, 
      border: `1.5px solid ${border}`, 
      borderLeft: `5px solid ${accentColor}`,
      borderRadius: 12, 
      padding: '10px 12px', 
      marginBottom: 8, 
      cursor: 'pointer', 
      transition: 'transform 0.1s',
      boxShadow: !isPaid && isCompleted ? '0 2px 8px rgba(245,158,11,0.15)' : 'none',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Subtle geometric pattern for completed cards */}
      {isCompleted && (
        <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}10 0%, transparent 70%)`, pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
        {/* TIME/DATE STAND-OUT BLOCK */}
        <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isIncomplete ? 'rgba(245,158,11,0.2)' : isCompleted ? (isPaid ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.15)') : T.pinkTint, border: `1px solid ${border}`, borderRadius: 10, padding: '4px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 2 }}>
            <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 900, color: accentColor, textTransform: 'uppercase', lineHeight: 1 }}>{isToday ? 'TODAY' : dateBrief(j.start).split(',')[0]}</div>
            <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 700, color: accentColor }}>{j.start.getDate()}</div>
          </div>
          <div style={{ height: 1, width: 20, background: `${accentColor}40`, margin: '2px 0' }} />
          <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>{startTime.time}</div>
          <div style={{ fontFamily: T.font, fontSize: 7, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', marginTop: 1 }}>{startTime.period}</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Subheading style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 1 }}>{j.client_name}</Subheading>
          <Text variant="secondary" style={{ fontSize: 10.5, fontWeight: 500 }}>{j.service_name}</Text>
          
          {needsDuration && (
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 800, color: '#D97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚠</span> MANUAL HOURS NEEDED
            </div>
          )}
          
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Ends {endTime.time} {endTime.period}
            {!isToday && <> · {dateBrief(j.start)}</>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
          {label && <span style={{ background: label.color, borderRadius: 4, padding: '2px 6px', fontSize: 8.5, fontWeight: 900, color: 'white' }}>{label.text}</span>}
          <AmtCell amount={`$${Number(j.total || 0).toFixed(0)}`} size={14} />
        </div>
      </div>
      
      {prepNote && !isCompleted && (
        <div style={{ borderTop: `1px dashed ${T.cardBorder}`, paddingTop: 8, marginTop: 8, display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: accentColor, flexShrink: 0 }}>✦ PREP</span>
          <span style={{ fontSize: 10.5, color: T.inkMuted, lineHeight: 1.4 }}>{prepNote}</span>
        </div>
      )}
    </div>
  );
}
