import { useMemo, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/AppThemeContext';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import { useJobs, useBusiness, notifyDataChanged } from '../data/useData';
import { useAuth } from '../context/AuthContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { usePostJobSheet } from '../context/PostJobSheetContext';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { useNewJobSheet } from '../context/NewJobSheetContext';
import { generateCommandBrief, speakBrief, stopSpeaking } from '../data/ai';
import { updateDailyRoutes } from '../lib/maps';
import { getBriefingMessage } from '../lib/briefingMessages';
import { updateJob } from '../data/jobsRepo';
import { useGeofence } from '../context/GeofenceContext';
import { useKeyboardFocus } from '../hooks/useKeyboardFocus';
import Swipeable from '../components/ui/Swipeable';
import WeekStrip from '../components/ui/WeekStrip';
import { sameDay, getWeekRange, fmtTime12, dateBrief } from '../lib/dateUtils';
import { computeJobTotal } from '../lib/financialMath';
import JobCard from '../components/cards/JobCard';
import UpcomingCard from '../components/cards/UpcomingCard';
import EmptyState from '../components/cards/EmptyState';
import LiveTimer from '../components/cards/LiveTimer';
import MissionIntel from '../components/cards/MissionIntel';
import PaymentBreakdown from '../components/cards/PaymentBreakdown';

export default function Home() {
  const themeCtx = useAppTheme();
  const jobsCtx = useJobs();
  const detailSheet = useJobDetailSheet();
  const postJobSheet = usePostJobSheet();
  const financeSheet = useFinanceDetailSheet();
  const newJobSheet = useNewJobSheet();
  const authCtx = useAuth();
  const { handleClockOut } = useGeofence();
  const bizCtx = useBusiness();
  const isKeyboardFocused = useKeyboardFocus();

  // Use a stable reference for "today"
  const [today] = useState(() => new Date());
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [currentWeekStart, currentWeekEnd] = useMemo(() => {
    const week = getWeekRange(today);
    const endOfSunday = new Date(week[6]);
    endOfSunday.setHours(23, 59, 59, 999);
    return [week[0], endOfSunday];
  }, [today]);

  // Live clock — re-evaluates which job owns the spotlight each minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const { T = {}, mode, privacyOn } = themeCtx || {};
  const { jobs: allJobs, loading } = jobsCtx || {};
  const { profile } = authCtx || {};
  const { business } = bizCtx || {};
  
  const persona = business?.ai_profile?.style || 'professional';
  
  const firstName = useMemo(() => {
    try {
      if (business?.owner_name) return business.owner_name.split(' ')[0];
      if (profile?.first_name) return profile.first_name;
    } catch { /* ignore */ }
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

  const displayRevenue = useMemo(
    () => todayJobs.reduce((s, j) => s + computeJobTotal(j), 0),
    [todayJobs]
  );

  const activeJob = todayJobs.find(j => j.status === 'Scheduled' && j.ai_context?.clock_in_time != null);

  const firstScheduled = todayJobs.find(j =>
    j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.end > now
  );
  const next = (activeJob && firstScheduled?.id === activeJob.id)
    ? todayJobs.find(j => j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.id !== activeJob.id && j.end > now)
    : firstScheduled;

  const attentionItems = useMemo(() => {
    if (!allJobs) return [];
    return allJobs
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j => {
        if (!j || j.status === 'Cancelled') return false;
        const isPast = j.end < now;
        const needsWrap = j.status !== 'Completed';
        const needsPay = j.status === 'Completed' && j.payment_status !== 'Paid';
        return isPast && (needsWrap || needsPay);
      })
      .sort((a, b) => a.start - b.start);
  }, [allJobs, now]);

  const briefingMsg = useMemo(() => getBriefingMessage({
    allDone,
    activeJob,
    next,
    now,
    todayJobs,
    attentionItemCount: attentionItems.length,
    persona,
    firstName,
  }), [allDone, activeJob, next, now, todayJobs, attentionItems.length, persona, firstName]);

  const staleAttentionItems = useMemo(() => {
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return attentionItems.filter(j => j.end < cutoff);
  }, [attentionItems, now]);

  const completedPaidThisWeek = useMemo(() => {
    if (!allJobs) return [];
    return allJobs
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j =>
        j &&
        j.status === 'Completed' &&
        j.payment_status === 'Paid' &&
        j.start >= currentWeekStart &&
        j.start <= currentWeekEnd
      )
      .sort((a, b) => b.start - a.start);
  }, [allJobs, currentWeekStart, currentWeekEnd]);

  const restOfWeekJobs = useMemo(() => {
    if (!allJobs) return [];
    const todayMidnight = new Date(today);
    todayMidnight.setHours(23, 59, 59, 999);
    return allJobs
      .map(j => {
        if (!j.scheduled_at) return null;
        const start = new Date(j.scheduled_at);
        if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j =>
        j &&
        j.status === 'Scheduled' &&
        j.start > todayMidnight &&
        j.start <= currentWeekEnd
      )
      .sort((a, b) => a.start - b.start);
  }, [allJobs, today, currentWeekEnd]);

  const [paymentMap, setPaymentMap] = useState({});
  useEffect(() => {
    const jobIds = [...new Set([
      ...todayJobs.map(j => j.id),
      ...attentionItems.map(j => j.id),
      ...restOfWeekJobs.map(j => j.id),
      ...completedPaidThisWeek.map(j => j.id),
    ])];

    let alive = true;
    const fetchPayments = async () => {
      if (!jobIds.length) {
        if (alive) setPaymentMap(p => Object.keys(p).length === 0 ? p : {});
        return;
      }
      const { data } = await supabase
        .from('payments')
        .select('job_id, amount')
        .in('job_id', jobIds)
        .eq('is_void', false);

      if (alive) {
        const map = {};
        (data ?? []).forEach(p => { map[p.job_id] = (map[p.job_id] || 0) + Number(p.amount); });
        setPaymentMap(map);
      }
    };

    fetchPayments();
    return () => { alive = false; };
  }, [todayJobs, attentionItems, restOfWeekJobs, completedPaidThisWeek]);

  const todayUpcoming = useMemo(() => {
    return todayJobs.filter(j =>
      j.id !== activeJob?.id &&
      j.id !== next?.id &&
      j.start >= now &&
      j.status === 'Scheduled'
    );
  }, [todayJobs, activeJob, next, now]);

  const attentionRef = useRef(null);

  const handleDuplicateJob = (job) => {
    newJobSheet.openWithPrefill({
      client_id: job.client_id,
      service_id: job.service_id,
      estimated_hours: job.estimated_hours,
      job_notes: job.job_notes,
      recurrence: job.recurrence,
    });
  };

  const handleReadAloud = (e) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      const brief = generateCommandBrief(next, business);
      if (brief?.speechText) {
        setIsSpeaking(true);
        speakBrief(brief.speechText, () => setIsSpeaking(false));
      }
    }
  };


  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const tightGap = (() => {
    for (let i = 0; i < todayJobs.length - 1; i++) {
      const a = todayJobs[i], b = todayJobs[i + 1];
      const gapMin = Math.round((b.start - a.end) / 60000);
      if (gapMin < 0) continue;
      const driveMin = Math.round((b.raw?.ai_context?.drive_to?.durationValue ?? 0) / 60);
      const threshold = driveMin > 0 ? driveMin + 15 : 60;
      if (gapMin < threshold) return { a, b, gapMin, driveMin };
    }
    return null;
  })();

  useEffect(() => {
    if (!loading && todayJobs.length > 0) {
      const needsUpdate = todayJobs.some(j => !j.ai_context?.drive_to);
      if (needsUpdate) {
        updateDailyRoutes(todayJobs.map(j => j.raw));
      }
    }
  }, [todayJobs, loading]);

  const openJob = detailSheet?.openJob;
  const openPostJob = postJobSheet?.openPostJob;
  const openDetail = financeSheet?.open;

  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);

  const handleRefreshTraffic = async (e) => {
    e.stopPropagation();
    setIsRefreshingTraffic(true);
    try {
      await updateDailyRoutes(todayJobs.map(j => j.raw));
      notifyDataChanged();
    } catch {
      /* ignore */
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
    } catch {
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
    } catch {
      alert("Could not add cost.");
    }
  };

  // Safety check for context
  if (!themeCtx || !jobsCtx || !authCtx) {
    return <div style={{ padding: 20, color: 'white' }}>Initializing context...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '13px 15px 15px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ flex: 1 }}>
            {isSelectedToday ? (
              <>
                <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 8 }}>
                  ✦ Command Brief · {dateBrief(selectedDate)}
                </SectionLabel>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 2 }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: allDone ? '#16A34A' : (activeJob || (next && Math.round((next.start - now) / 60000) < 60)) ? '#F59E0B' : '#64748B',
                    flexShrink: 0,
                    marginTop: 7,
                  }} />
                  <div style={{
                    fontFamily: T.serif,
                    fontSize: 21,
                    fontWeight: 500,
                    letterSpacing: '-0.3px',
                    color: mode === 'dark' ? 'white' : T.ink,
                    lineHeight: 1.3,
                  }}>
                    {briefingMsg}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, margin: 0 }}>
                    ✦ WEEKLY SUMMARY
                  </SectionLabel>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleWeekChange(-1)} style={{ background: 'rgba(233,30,106,0.1)', border: 'none', borderRadius: 4, width: 22, height: 22, color: T.pink, fontSize: 14, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                    <button onClick={() => handleWeekChange(1)} style={{ background: 'rgba(233,30,106,0.1)', border: 'none', borderRadius: 4, width: 22, height: 22, color: T.pink, fontSize: 14, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                  </div>
                </div>
                <Title style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.5px', color: mode === 'dark' ? 'white' : T.ink, lineHeight: 1.15, marginBottom: 4 }}>
                  {getWeekLabel(weekDays)}
                </Title>
                <Text style={{ fontSize: 14, color: T.inkSub, fontWeight: 600 }}>
                  {selectedDateJobs.length} jobs scheduled
                </Text>
              </>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              onClick={openDetail}
              style={{ cursor: 'pointer', padding: '4px 0 4px 12px' }}
            >
              <div style={{
                fontFamily: T.serif,
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: '-1px',
                lineHeight: 1,
                color: mode === 'dark' ? 'rgba(255,255,255,0.88)' : T.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {privacyOn ? '•••' : `$${displayRevenue.toFixed(0)}`}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>
                {isSelectedToday ? 'Projected' : 'Revenue'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          {isOffCurrentWeek && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 14, marginBottom: 4 }}>
              <button
                onClick={handleGoToToday}
                style={{
                  background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontFamily: T.font,
                  fontSize: 9,
                  fontWeight: 700,
                  color: mode === 'dark' ? 'white' : T.ink,
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                }}
              >
                TODAY
              </button>
            </div>
          )}
          <WeekStrip
            weekStart={weekStart}
            selectedDate={selectedDate}
            today={today}
            allJobs={allJobs}
            onWeekChange={handleWeekChange}
            onDaySelect={setSelectedDate}
            T={T}
            mode={mode}
            variant="calendar"
          />
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

        {/* Mini Spotlight Label */}
        {nextUpLabel && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.pink, background: T.pinkTint, padding: '3px 10px', borderRadius: 8, textTransform: 'uppercase' }}>
              ✦ {nextUpLabel}
            </span>
          </div>
        )}

        {isSelectedToday ? (
          <>
            {staleAttentionItems.length > 0 && (
              <div
                onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                  {staleAttentionItems.length} job{staleAttentionItems.length > 1 ? 's' : ''} need{staleAttentionItems.length === 1 ? 's' : ''} your attention
                </div>
                <span style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>↓ View</span>
              </div>
            )}

            {/* Mission Critical Alert: Tight Gap */}
            {tightGap && (
              <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 20 }}>🕒</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9A3412', textTransform: 'uppercase', marginBottom: 2 }}>Tight Transition</div>
                  <div style={{ fontSize: 12, color: '#7C2D12', lineHeight: 1.3 }}>
                    Only {tightGap.gapMin}m between {tightGap.a.client_name} and {tightGap.b.client_name}. 
                    {tightGap.driveMin > 0 && ` Drive takes ~${tightGap.driveMin}m.`}
                  </div>
                </div>
              </div>
            )}

            {/* Spotlight Section */}
            {activeJob ? (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel color={T.pink}>✦ MISSION ACTIVE · HAPPENING NOW</SectionLabel>
                <div style={{ 
                  background: mode === 'dark' ? '#0D0D0D' : 'white', 
                  border: `2px solid ${T.pink}`, 
                  borderRadius: 18, 
                  padding: '16px', 
                  boxShadow: '0 8px 24px rgba(233,30,106,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Pulsing indicator */}
                  <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: '#E91E6A', animation: 'pulse 2s infinite' }} />
                  
                  <div onClick={() => openJob(activeJob.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <Title style={{ fontSize: 19, color: T.ink }}>{activeJob.client_name}</Title>
                      <div style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: 16, fontWeight: 900, color: T.ink }}>{fmtTime12(activeJob.start).time}</Text>
                        <Caption style={{ fontWeight: 700, color: T.inkMuted }}>{fmtTime12(activeJob.start).period}</Caption>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: T.pinkTint, color: T.pink, textTransform: 'uppercase' }}>{activeJob.service_name || 'General Service'}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.inkMuted }}>{activeJob.estimated_hours}h EST</span>
                    </div>

                    <LiveTimer startTime={activeJob.ai_context.clock_in_time} />

                    {activeJob.address && (
                      <div onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeJob.address)}`, '_blank'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: T.pink, cursor: 'pointer' }}>
                        <span style={{ fontSize: 14 }}>📍</span>
                        <span style={{ fontSize: 12, fontWeight: 500, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeJob.address}</span>
                      </div>
                    )}

                    <MissionIntel prepNote={activeJob.prep_note || activeJob.client_access_json || activeJob.client_prefs_json} T={T} theme={T} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}` }}>
                    <button onClick={(e) => { e.stopPropagation(); handleAddTime(activeJob); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+30 MIN</button>
                    <button onClick={(e) => { e.stopPropagation(); handleAddQuickCost(activeJob); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+COST</button>
                    <button onClick={(e) => { e.stopPropagation(); openPostJob(activeJob.id); }} style={{ flex: 2, padding: '10px', borderRadius: 10, background: T.pink, color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>WRAP UP</button>
                  </div>
                </div>
              </div>
            ) : next ? (
              <div style={{ marginBottom: 20 }}>
                {(() => {
                  const DEEP_ROSE = '#B5004E';
                  const DEEP_ROSE_GLOW = 'rgba(181,0,78,0.18)';
                  const DEEP_ROSE_TINT = mode === 'dark' ? 'rgba(181,0,78,0.12)' : '#FFF0F4';
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: DEEP_ROSE, textTransform: 'uppercase', letterSpacing: '0.8px' }}>✦ Next Up</div>
                        <button
                          onClick={handleReadAloud}
                          style={{ background: isSpeaking ? DEEP_ROSE : 'none', border: `1.5px solid ${DEEP_ROSE}`, borderRadius: 8, padding: '6px 13px', color: isSpeaking ? 'white' : DEEP_ROSE, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          {isSpeaking ? '⏹ Stop' : '🔊 Read Brief'}
                        </button>
                      </div>
                      <div
                        onClick={() => openJob(next.id)}
                        style={{
                          background: mode === 'dark' ? 'linear-gradient(135deg,#1a0008 0%,#200010 100%)' : 'linear-gradient(135deg,#FFF0F4 0%,#fff 60%)',
                          border: `2.5px solid ${DEEP_ROSE}`,
                          borderLeft: `6px solid ${DEEP_ROSE}`,
                          borderRadius: 18,
                          padding: '18px 18px 14px',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: `0 8px 28px ${DEEP_ROSE_GLOW}, 0 2px 8px rgba(0,0,0,0.08)`,
                        }}
                      >
                        <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${DEEP_ROSE_GLOW} 0%,transparent 70%)`, pointerEvents: 'none' }} />

                        {(() => {
                          const startFmt = fmtTime12(next.start);
                          const endFmt = fmtTime12(next.end);
                          const sameAMPM = startFmt.period === endFmt.period;
                          const timeRange = sameAMPM
                            ? `${startFmt.time} – ${endFmt.time}${endFmt.period}`
                            : `${startFmt.time}${startFmt.period} – ${endFmt.time}${endFmt.period}`;
                          const minsToStart = Math.round((next.start - now) / 60000);
                          const isNowWindow = now >= next.start && now < next.end;
                          const timingColor = isNowWindow ? '#E91E6A' : minsToStart <= 15 ? '#EF4444' : minsToStart <= 60 ? '#F59E0B' : '#16A34A';
                          const timingLabel = isNowWindow ? '🔴 Happening now' : minsToStart > 0 ? `Starts in ${minsToStart}m` : null;
                          return (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, position: 'relative' }}>
                                <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                                  <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, color: T.ink, lineHeight: 1.1, letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {next.client_name}
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: DEEP_ROSE, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>
                                    {next.service_name}
                                  </div>
                                </div>
                                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                  <div style={{ fontSize: 17, fontWeight: 900, color: DEEP_ROSE, fontFamily: 'monospace', letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                    {timeRange}
                                  </div>
                                </div>
                              </div>
                              {timingLabel && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: timingColor, background: `${timingColor}18`, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    {timingLabel}
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 10px', background: DEEP_ROSE_TINT, borderRadius: 10 }}>
                          <span style={{ fontSize: 13 }}>🚗</span>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.ink }}>
                            {next.ai_context?.drive_to?.duration
                              ? `${next.ai_context.drive_to.duration} to destination`
                              : next.address
                                ? 'Calculating drive time…'
                                : 'No address on file'}
                          </div>
                          {next.ai_context?.drive_to && (
                            <button onClick={e => { e.stopPropagation(); handleRefreshTraffic(e); }} disabled={isRefreshingTraffic} style={{ background: 'none', border: 'none', color: DEEP_ROSE, cursor: 'pointer', fontSize: 14, padding: 2 }}>
                              {isRefreshingTraffic ? '…' : '↻'}
                            </button>
                          )}
                        </div>

                        {next.job_notes && (
                          <div style={{ background: mode === 'dark' ? 'rgba(181,0,78,0.08)' : 'rgba(181,0,78,0.05)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, borderLeft: `3px solid ${DEEP_ROSE}` }}>
                            <div style={{ fontSize: 9, fontWeight: 900, color: DEEP_ROSE, textTransform: 'uppercase', marginBottom: 3 }}>📌 JOB NOTES</div>
                            <div style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.4 }}>{next.job_notes}</div>
                          </div>
                        )}

                        <MissionIntel prepNote={next.prep_note || next.client_access_json || next.client_prefs_json} T={T} theme={T} />

                        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}`, position: 'relative' }}>
                          {next.address && (
                            <button onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`, '_blank'); }} style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.card, border: `1px solid ${DEEP_ROSE}`, color: DEEP_ROSE, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>NAVIGATE</button>
                          )}
                          <button onClick={e => { e.stopPropagation(); handleClockOut(next.id); }} style={{ flex: 2, padding: '11px', borderRadius: 10, background: DEEP_ROSE, color: 'white', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.5px' }}>START NOW</button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {todayUpcoming.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <SectionLabel style={{ color: '#1565C0', marginBottom: 8 }}>COMING UP TODAY</SectionLabel>
                {todayUpcoming.map(j => (
                  <UpcomingCard
                    key={j.id}
                    job={j}
                    T={T}
                    onClick={() => openJob(j.id)}
                    total={computeJobTotal(j)}
                    paid={paymentMap[j.id] || 0}
                    privacyOn={privacyOn}
                  />
                ))}
              </div>
            )}

            {attentionItems.length > 0 && (
              <div ref={attentionRef} style={{ marginBottom: 24 }}>
                <SectionLabel color="#F59E0B">⚠️ Needs Attention</SectionLabel>
                {attentionItems.map(j => {
                  const needsWrap = j.status !== 'Completed';
                  const startTime = fmtTime12(j.start);
                  const paid = paymentMap[j.id] || 0;
                  const total = computeJobTotal(j);
                  const remaining = Math.max(0, total - paid);
                  return (
                    <div
                      key={j.id}
                      style={{
                        background: mode === 'dark' ? 'rgba(245,158,11,0.08)' : '#FFFBEB',
                        border: '2px solid #F59E0B',
                        borderLeft: '6px solid #F59E0B',
                        borderRadius: 16,
                        padding: '14px 16px',
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {j.client_name}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', marginTop: 2 }}>
                            {j.service_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                            {j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {startTime.time}{startTime.period}
                          </div>
                          <div style={{ marginTop: 5 }}>
                            {remaining > 0
                              ? <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor="#92400E" />
                              : <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>${total.toFixed(0)} total</span>
                            }
                          </div>
                        </div>
                        <button
                          onClick={() => openPostJob(j.id)}
                          style={{ background: '#F59E0B', color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}
                        >
                          {needsWrap ? 'WRAP UP' : remaining > 0 ? 'COLLECT' : 'VIEW'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


            {completedPaidThisWeek.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel color="#16A34A">✓ DONE THIS WEEK</SectionLabel>
                {completedPaidThisWeek.map(j => (
                  <JobCard
                    key={j.id}
                    job={j}
                    T={T}
                    onClick={() => openJob(j.id)}
                    onDuplicate={handleDuplicateJob}
                    paid={paymentMap[j.id] || 0}
                    total={computeJobTotal(j)}
                    privacyOn={privacyOn}
                  />
                ))}
              </div>
            )}

            {!activeJob && !next && todayUpcoming.length === 0 && attentionItems.length === 0 && completedPaidThisWeek.length === 0 && (
              <EmptyState allDone={allDone} T={T} persona={persona} />
            )}
          </>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>{dateBrief(selectedDate)}</SectionLabel>
            {selectedDateJobs.length === 0 ? (
              <EmptyState allDone={false} T={T} persona={persona} />
            ) : (
              selectedDateJobs.map(j => (
                <Swipeable key={j.id} onDelete={() => handleDeleteJob(j.id)}>
                  <JobCard
                    job={j}
                    T={T}
                    onClick={() => openJob(j.id)}
                    onDuplicate={handleDuplicateJob}
                    paid={paymentMap[j.id] || 0}
                    total={computeJobTotal(j)}
                    privacyOn={privacyOn}
                  />
                </Swipeable>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ height: isKeyboardFocused ? 80 : 0, transition: 'height 0.2s ease-out' }} />
    </div>
  );
}

