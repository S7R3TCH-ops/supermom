import { useMemo, useEffect, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import AmtCell from '../components/ui/AmtCell';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import CapeUpButton from '../components/ui/CapeUpButton';
import { useJobs, useBusiness, useClients, notifyDataChanged } from '../data/useData';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { usePostJobSheet } from '../context/PostJobSheetContext';
import { useNewClientSheet } from '../context/NewClientSheetContext';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { useAuth } from '../context/AuthContext';
import { updateDailyRoutes } from '../lib/maps';
import { useGeofence } from '../context/GeofenceContext';
import { generateCommandBrief, generatePrepNote, speakBrief, stopSpeaking } from '../data/ai';
import { getPersistentDailyMessage, getTimeBasedGreeting } from '../lib/greetings';
import { softDeleteJob } from '../data/jobsRepo';

import { EmptySchedule, AllDone } from '../components/ui/Illustrations';
import Swipeable from '../components/ui/Swipeable';

const NOW = () => new Date();
const DOW_BY_DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

function LiveTimer({ startTime, T, mode }) {
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
    <Title className="sm-pulse" style={{ fontSize: 32, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
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
    <div style={{ padding: '40px 20px', textAlign: 'center', background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {allDone ? <AllDone size={100} /> : <EmptySchedule size={100} />}
      <Subheading style={{ fontSize: 16, color: T.ink, lineHeight: 1.5, maxWidth: 240 }}>
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
  const [weekOffset, setWeekOffset] = useState(0);

  // Live clock — re-evaluates which job owns the spotlight each minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
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

  const weekDays = useMemo(() => {
    const start = addDays(today, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [today, weekOffset]);

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

  // Today's jobs used for categorized list (spotlight sections use todayJobs directly)
  const filteredSelectedJobs = todayJobs;

  // Jobs for the remaining days of the week strip, grouped by day
  const futureWeekGroups = useMemo(() => {
    if (!allJobs) return [];
    const groups = [];
    weekDays.forEach(d => {
      // If we are looking at the current week (weekOffset === 0), skip today
      // because today's jobs are already prominently displayed in categorized list
      if (weekOffset === 0 && sameDay(d, today)) return;

      const dayJobs = allJobs
        .map(j => {
          if (!j.scheduled_at) return null;
          const start = new Date(j.scheduled_at);
          if (isNaN(start.getTime())) return null;
          const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
          return { ...j, start, end };
        })
        .filter(j => j && sameDay(j.start, d) && j.status !== 'Cancelled')
        .sort((a, b) => a.start - b.start);
      if (dayJobs.length > 0) {
        groups.push({ date: d, jobs: dayJobs });
      }
    });
    return groups;
  }, [allJobs, weekDays, weekOffset, today]);

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

  // Scheduled jobs whose estimated window has passed but Sandra hasn't marked them done yet
  const overdueScheduled = todayJobs.filter(j =>
    j.status === 'Scheduled' &&
    j.end <= now &&
    j.id !== activeJob?.id
  );

  // The highlighted job is the first scheduled job whose window hasn't expired yet
  const firstScheduled = todayJobs.find(j =>
    j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.end > now
  );
  const next = (activeJob && firstScheduled?.id === activeJob.id)
    ? todayJobs.find(j => j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.id !== activeJob.id && j.end > now)
    : firstScheduled;
  
  const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);
  const completedJobsCount = todayJobs.filter(j => j.status === 'Completed').length;
  const progressPercent = todayJobs.length > 0 ? (completedJobsCount / todayJobs.length) * 100 : 0;

  const isSelectedToday = sameDay(selectedDate, today);

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

  const categorizedJobs = useMemo(() => {
    const incomplete = [];
    const upcoming = [];
    const done = [];
    const overdueIds = new Set(overdueScheduled.map(j => j.id));

    filteredSelectedJobs.forEach(j => {
      if (j.id === activeJob?.id) return;
      if (j.id === next?.id) return;
      if (overdueIds.has(j.id)) return; // shown in their own section

      const isCompleted = j.status === 'Completed';
      const isPast = j.end < now;

      if (isCompleted) {
        done.push(j);
      } else if (isPast) {
        incomplete.push(j);
      } else {
        upcoming.push(j);
      }
    });

    const unpaidFirst = arr => [...arr].sort((a, b) => {
      const aUnpaid = a.payment_status !== 'Paid' ? 0 : 1;
      const bUnpaid = b.payment_status !== 'Paid' ? 0 : 1;
      return aUnpaid - bUnpaid || a.start - b.start;
    });

    return { incomplete: unpaidFirst(incomplete), upcoming: unpaidFirst(upcoming), done: unpaidFirst(done) };
  }, [filteredSelectedJobs, activeJob, next, overdueScheduled, now]);

  const commandBrief = useMemo(() => {
    // Command brief should be for the active job if it exists, otherwise the next one
    const target = activeJob || next;
    if (!target) return null;
    try {
      return generateCommandBrief(target, business);
    } catch (e) {
      console.error("Error generating command brief:", e);
      return null;
    }
  }, [activeJob, next, business]);

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

  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);

  const handleRefreshTraffic = async (e) => {
    e.stopPropagation();
    setIsRefreshingTraffic(true);
    try {
      await updateDailyRoutes(todayJobs.map(j => j.raw));
      notifyDataChanged();
    } catch (err) {
      console.error("Traffic refresh failed:", err);
    } finally {
      setIsRefreshingTraffic(false);
    }
  };

  const handleAddTime = async (job, mins = 30) => {
    const currentHrs = job.estimated_hours || 0;
    const newHrs = currentHrs + (mins / 60);
    try {
      await updateJob(job.id, { estimated_hours: newHrs });
      notifyDataChanged();
    } catch (err) {
      alert("Could not add time.");
    }
  };

  const handleAddQuickCost = async (job) => {
    const amt = window.prompt("Amount to add ($)?");
    if (!amt || isNaN(parseFloat(amt))) return;
    const desc = window.prompt("What for?", "Supplies") || "Extra cost";
    
    const currentCosts = Array.isArray(job.additional_costs_json) ? job.additional_costs_json : [];
    const newCosts = [...currentCosts, { amount: parseFloat(amt), description: desc }];
    
    try {
      await updateJob(job.id, { additional_costs_json: newCosts });
      notifyDataChanged();
    } catch (err) {
      alert("Could not add cost.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

        {/* HERO */}
        <div style={{ 
          background: T.hero, 
          borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
          padding: '13px 15px 18px', 
          position: 'relative', 
          overflow: 'hidden' 
        }}>
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
              <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 5 }}>
                ✦ Command Brief · {dateBrief(today)}
              </SectionLabel>
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
                <Caption style={{ fontSize: 10.5, color: mode === 'dark' ? 'rgba(255,255,255,0.55)' : T.inkSub, lineHeight: 1.4 }}>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <SectionLabel style={{ margin: 0 }}>
              {weekOffset === 0 ? 'This Week' : (weekOffset < 0 ? 'Previous Week' : 'Future Week')}
            </SectionLabel>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button 
                onClick={() => setWeekOffset(prev => prev - 1)}
                style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink, fontSize: 16, cursor: 'pointer' }}
              >‹</button>
              {weekOffset !== 0 && (
                <button 
                  onClick={() => { setWeekOffset(0); setSelectedDate(today); }}
                  style={{ background: T.pink, border: 'none', borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                >Today</button>
              )}
              <button 
                onClick={() => setWeekOffset(prev => prev + 1)}
                style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink, fontSize: 16, cursor: 'pointer' }}
              >›</button>
            </div>
          </div>
          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, padding: '10px 12px', marginBottom: 12, marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {weekDays.map((d, i) => {
                const isSelected = sameDay(d, selectedDate);
                const isActuallyToday = sameDay(d, today);
                const dayJobsCount = (allJobs || []).filter(j => j.status !== 'Cancelled' && sameDay(new Date(j.scheduled_at), d)).length;
                return (
                  <div key={i} onClick={() => setSelectedDate(d)} style={{ textAlign: 'center', padding: '5px 2px 6px', borderRadius: 8, background: isSelected ? (mode === 'dark' ? '#1A0B2E' : T.pinkTint) : 'transparent', border: `1.5px solid ${isSelected ? T.pink : 'transparent'}`, cursor: 'pointer' }}>
                    <Caption style={{ fontSize: 7.5, fontWeight: 700, color: isActuallyToday ? T.pink : (isSelected ? T.ink : T.inkMuted) }}>{DOW_BY_DAY[d.getDay()]}</Caption>
                    <Text style={{ fontSize: 13, fontWeight: 500, color: isSelected ? T.pink : T.ink, fontFamily: T.serif }}>{d.getDate()}</Text>
                    {dayJobsCount > 0 && <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}><span style={{ width: 4, height: 4, borderRadius: '50%', background: T.pink }} /></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {activeJob && isSelectedToday && (
            <>
              <SectionLabel color={T.pink}>✦ MISSION ACTIVE · HAPPENING NOW</SectionLabel>
              <div style={{ background: mode === 'dark' ? 'linear-gradient(135deg, #1A0B2E 0%, #0D0517 100%)' : T.hero, border: `2px solid ${T.pink}`, borderRadius: 16, padding: '18px', marginBottom: 12, boxShadow: `0 0 20px ${T.pink}30`, position: 'relative', overflow: 'hidden' }}>
                <div className="sm-pulse" style={{ position: 'absolute', inset: 0, border: `2px solid ${T.pink}`, borderRadius: 16, pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Subheading style={{ fontSize: 22, color: mode === 'dark' ? 'white' : T.ink, fontWeight: 700 }}>{activeJob.client_name}</Subheading>
                  <AmtCell amount={`$${Number(activeJob.total || 0).toFixed(0)}`} size={22} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 800, color: T.pink, textTransform: 'uppercase', background: `${T.pink}15`, padding: '3px 8px', borderRadius: 6 }}>{activeJob.service_name}</span>
                  <Caption style={{ fontSize: 11, color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : T.inkSub, fontWeight: 600 }}>until {fmtTime12(activeJob.end).time}{fmtTime12(activeJob.end).period}</Caption>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: 12, marginBottom: 16 }}>
                  <LiveTimer startTime={activeJob.ai_context.clock_in_time} T={T} mode={mode} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAddTime(activeJob, 30)} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: T.ink, cursor: 'pointer' }}>+ 30m</button>
                    <button onClick={() => handleAddQuickCost(activeJob)} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: T.ink, cursor: 'pointer' }}>+ $ Cost</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={async (e) => { e.stopPropagation(); await handleClockOut(activeJob.id); openPostJob(activeJob.id); }} style={{ flex: 1, background: T.pink, color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>COMPLETE MISSION</button>
                </div>
              </div>
            </>
          )}

          {!activeJob && next && isSelectedToday && (
            <>
              {now >= next.start ? (
                <SectionLabel color={T.pink}>✦ MISSION READY · START NOW</SectionLabel>
              ) : (
                <SectionLabel>What's Next Today · {next.client_name}</SectionLabel>
              )}
              
              <div onClick={() => openJob(next.id)} style={{ 
                background: T.hero, 
                border: now >= next.start ? `2px solid ${T.pink}` : `1.5px solid ${mode === 'dark' ? 'rgba(233,30,106,0.32)' : T.cardBorder}`, 
                borderRadius: 14, 
                padding: '16px', 
                marginBottom: 12, 
                cursor: 'pointer', 
                position: 'relative', 
                overflow: 'hidden',
                boxShadow: now >= next.start ? `0 0 15px ${T.pink}20` : 'none'
              }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: mode === 'dark' ? 'radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)' : `radial-gradient(circle, ${T.pink}08 1px, transparent 1px)`, backgroundSize: '15px 15px', pointerEvents: 'none' }} />
                
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <Subheading style={{ fontSize: 20, color: mode === 'dark' ? 'white' : T.ink, marginBottom: 2 }}>{next.client_name}</Subheading>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: T.pink }}>{next.service_name}</Text>
                    </div>
                    <AmtCell amount={`$${next.total.toFixed(0)}`} size={18} />
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.inkMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <span style={{ fontFamily: T.font, fontSize: 12, color: T.inkSub, fontWeight: 600 }}>{fmtTime12(next.start).time} – {fmtTime12(next.end).time}</span>
                    </div>
                    {next.address && (
                      <div onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`, '_blank'); }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span style={{ fontFamily: T.font, fontSize: 12, color: T.pink, fontWeight: 600, textDecoration: 'underline' }}>{next.address.split(',')[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* Travel Intelligence */}
                  {next.ai_context?.drive_to && (
                    <div style={{ 
                      background: mode === 'dark' ? 'rgba(59,130,246,0.1)' : '#EFF6FF', 
                      borderRadius: 10, 
                      padding: '8px 12px', 
                      marginBottom: 16, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      border: mode === 'dark' ? '1px solid rgba(59,130,246,0.2)' : '1px solid #DBEAFE'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>🚗</span>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>
                          Traffic: {next.ai_context.drive_to.duration} ({next.ai_context.drive_to.distance})
                        </Text>
                      </div>
                      <button 
                        onClick={handleRefreshTraffic}
                        disabled={isRefreshingTraffic}
                        style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', padding: '4px' }}
                      >
                        {isRefreshingTraffic ? '...' : 'Refresh ↻'}
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button onClick={(e) => { e.stopPropagation(); handleAddTime(next, 30); }} style={{ flex: 1, background: 'rgba(255,255,255,0.4)', border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '8px', fontSize: 11, fontWeight: 700, color: T.ink, cursor: 'pointer' }}>+ 30m</button>
                    <button onClick={(e) => { e.stopPropagation(); handleAddQuickCost(next); }} style={{ flex: 1, background: 'rgba(255,255,255,0.4)', border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '8px', fontSize: 11, fontWeight: 700, color: T.ink, cursor: 'pointer' }}>+ $ Cost</button>
                  </div>

                  <CapeUpButton job={next} name={firstName} />
                </div>
              </div>
            </>
          )}

          {overdueScheduled.length > 0 && isSelectedToday && (
            <div style={{ marginTop: 4 }}>
              {overdueScheduled.map(j => (
                <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                  <div
                    onClick={() => openPostJob(j.id)}
                    style={{
                      background: mode === 'dark' ? 'rgba(251,191,36,0.08)' : '#FEFDF0',
                      border: `1.5px solid ${mode === 'dark' ? '#FBBF24' : '#F59E0B'}`,
                      borderLeft: `5px solid #F59E0B`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.ink }}>{j.client_name}</span>
                        <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.4px', background: 'rgba(245,158,11,0.15)', borderRadius: 4, padding: '2px 5px' }}>Needs Attention</span>
                      </div>
                      <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkSub }}>{j.service_name} · ended {fmtTime12(j.end).time} {fmtTime12(j.end).period}</div>
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>Wrap Up →</div>
                  </div>
                </Swipeable>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {/* Today — incomplete / past-due */}
            {categorizedJobs.incomplete.length > 0 && (
              <>
                {categorizedJobs.incomplete.length > 3 && <SectionLabel color="#F59E0B">✦ Incomplete Missions · Needs Update</SectionLabel>}
                {categorizedJobs.incomplete.map(j => (
                  <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                    <JobCard j={j} T={T} mode={mode} openJob={openJob} variant="incomplete" today={today} />
                  </Swipeable>
                ))}
              </>
            )}

            {/* Today — remaining upcoming */}
            {categorizedJobs.upcoming.length > 0 && (
              <>
                {categorizedJobs.upcoming.length > 3 && <SectionLabel>Upcoming Today</SectionLabel>}
                {categorizedJobs.upcoming.map(j => (
                  <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                    <JobCard j={j} T={T} mode={mode} openJob={openJob} next={next} today={today} />
                  </Swipeable>
                ))}
              </>
            )}

            {/* Today — empty state */}
            {categorizedJobs.upcoming.length === 0 && categorizedJobs.incomplete.length === 0 && !activeJob && !next && futureWeekGroups.length === 0 && (
              <EmptyState persona={persona} allDone={allDone} T={T} />
            )}

            {/* Today — completed */}
            {categorizedJobs.done.length > 0 && (
              <>
                {categorizedJobs.done.length > 1 && <SectionLabel>Missions Accomplished · Today</SectionLabel>}
                {categorizedJobs.done.map(j => (
                  <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                    <JobCard j={j} T={T} mode={mode} openJob={openJob} variant="done" today={today} />
                  </Swipeable>
                ))}
              </>
            )}

            {/* Unpaid completed jobs banner */}
            {overdueJobs.length > 0 && (
              <div onClick={() => openDetail("Unpaid Jobs", overdueJobs, 'jobs')} style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, cursor: 'pointer' }}>
                <span style={{ fontSize: 13 }}>💰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C' }}>{overdueJobs.length} unpaid completed jobs</div>
                  <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>{overdueJobs.slice(0, 2).map(j => j.client_name).join(', ')}</div>
                </div>
                <AmtCell amount={`$${overdueJobs.reduce((s, j) => s + Number(j.total || 0), 0).toFixed(0)}`} size={12} />
              </div>
            )}

            {/* Rest of week — grouped by day */}
            {futureWeekGroups.map(group => (
              <div key={group.date.toDateString()}>
                <SectionLabel style={{ marginTop: 16 }}>{dateBrief(group.date)}</SectionLabel>
                {group.jobs.map(j => (
                  <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                    <JobCard j={j} T={T} mode={mode} openJob={openJob} today={today} />
                  </Swipeable>
                ))}
              </div>
            ))}
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

  // Urgency Heatmap Logic for Unpaid Jobs
  let urgencyLevel = 0; // 0 (none) to 3 (critical)
  if (isCompleted && !isPaid) {
    const daysLate = Math.floor((today - j.start) / 86400000);
    urgencyLevel = daysLate <= 0 ? 1 : (daysLate === 1 ? 2 : 3);
  }

  // Color Mapping
  const COLORS = {
    upcoming: { border: '#3B82F6', bg: mode === 'dark' ? 'rgba(59,130,246,0.1)' : '#EFF6FF', accent: '#3B82F6' },
    paid: { border: '#22C55E', bg: mode === 'dark' ? 'rgba(34,197,94,0.1)' : '#F0FFF4', accent: '#22C55E' },
    next: { border: '#E91E6A', bg: mode === 'dark' ? 'rgba(233,30,106,0.1)' : T.pinkTint, accent: '#E91E6A' },
    incomplete: { border: '#F59E0B', bg: mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FFFBEB', accent: '#D97706' },
    urgency1: { border: '#FCA5A5', bg: '#FFF5F5', accent: '#EF4444' }, // Soft red
    urgency2: { border: '#F87171', bg: '#FEE2E2', accent: '#DC2626' }, // Medium red
    urgency3: { border: '#EF4444', bg: '#FECACA', accent: '#B91C1C' }, // High-intensity red
  };

  let theme = COLORS.upcoming;
  let label = { text: 'SCHEDULED', color: theme.accent };

  if (isIncomplete) {
    theme = COLORS.incomplete;
    label = { text: 'NEEDS WRAP-UP', color: theme.accent };
  } else if (urgencyLevel > 0) {
    theme = COLORS[`urgency${urgencyLevel}`];
    label = { text: 'UNPAID', color: theme.accent };
  } else if (isCompleted && isPaid) {
    theme = COLORS.paid;
    label = { text: 'PAID ✓', color: theme.accent };
  } else if (isNext) {
    theme = COLORS.next;
    label = { text: 'UP NEXT', color: theme.accent };
  }

  const prepNote = generatePrepNote(j);
  const startTime = fmtTime12(j.start);
  const endTime = fmtTime12(j.end);

  return (
    <div onClick={() => openJob(j.id)} style={{ 
      background: mode === 'dark' ? (urgencyLevel > 0 ? 'rgba(239,68,68,0.15)' : theme.bg) : theme.bg, 
      border: `1.5px solid ${theme.border}`, 
      borderLeft: `6px solid ${theme.accent}`,
      borderRadius: 16, 
      padding: '14px 16px', 
      marginBottom: 10, 
      cursor: 'pointer', 
      transition: 'all 0.15s ease',
      boxShadow: urgencyLevel >= 2 ? `0 4px 12px ${theme.border}40` : 'none',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Visual Pattern Watermark to fill space */}
      <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent}08 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -20, left: 40, width: 60, height: 60, border: `1px solid ${theme.accent}05`, borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        
        {/* TOP ROW: Title & Vitals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Subheading style={{ fontSize: 19, fontWeight: 700, color: T.ink, marginBottom: 2, letterSpacing: '-0.3px' }}>
              {j.client_name}
            </Subheading>
            <Text variant="secondary" style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>
              {j.service_name}
            </Text>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontFamily: T.font, fontSize: 10, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 4 }}>
                {isCompleted ? 'Actual' : 'Est'}: {isCompleted ? (j.actual_duration || j.estimated_hours || 0) : (j.estimated_hours || 0)}h
              </span>
              {j.address && (
                <Caption style={{ fontSize: 11, color: T.inkMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📍 {j.address.split(',')[0]}
                </Caption>
              )}
            </div>
          </div>

          {/* VITALS BLOCK (TOP RIGHT) */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ 
              fontFamily: T.font, 
              fontSize: 11, 
              fontWeight: 800, 
              color: T.pink, 
              textTransform: 'uppercase', 
              letterSpacing: '0.6px',
              marginBottom: 4
            }}>
              {isToday ? 'TODAY' : dateBrief(j.start).toUpperCase()}
            </div>
            <div style={{ 
              fontFamily: T.serif, 
              fontSize: 17, 
              fontWeight: 900, 
              color: T.pink,
              lineHeight: 1
            }}>
              {startTime.time}{startTime.period}
            </div>
            <div style={{ 
              fontFamily: T.serif, 
              fontSize: 14, 
              fontWeight: 800, 
              color: T.pink,
              opacity: 0.8,
              marginTop: 4
            }}>
              to {endTime.time}{endTime.period}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Status & Money */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ 
              background: label.color, 
              borderRadius: 6, 
              padding: '4px 9px', 
              fontSize: 10, 
              fontWeight: 900, 
              color: 'white', 
              letterSpacing: '0.4px', 
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
            }}>
              {label.text}
            </span>
            {needsDuration && (
              <span style={{ fontSize: 10, fontWeight: 900, color: '#D97706', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 6, border: '1px solid #F59E0B' }}>
                ⚠ ADD HOURS
              </span>
            )}
          </div>
          <AmtCell amount={`$${Number(j.total || 0).toFixed(0)}`} size={18} />
        </div>

      </div>
      
      {prepNote && !isCompleted && (
        <div style={{ 
          borderTop: `1px solid ${T.cardBorder}`, 
          paddingTop: 10, 
          marginTop: 10, 
          display: 'flex', 
          gap: 8,
          opacity: 0.8
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: theme.accent, flexShrink: 0 }}>✦ MISSION INTEL</span>
          <span style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.4, fontWeight: 500 }}>{prepNote}</span>
        </div>
      )}
    </div>
  );
}
