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
import { sameDay, getWeekRange, fmtTime12, fmtTimeRange, dateBrief, fmtDuration } from '../lib/dateUtils';
import { computeJobTotal, computeJobSubtotal } from '../lib/financialMath';
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

  const allWeekJobs = useMemo(() => {
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
        j.status !== 'Cancelled' &&
        j.start >= currentWeekStart &&
        j.start <= currentWeekEnd
      )
      .sort((a, b) => a.start - b.start);
  }, [allJobs, currentWeekStart, currentWeekEnd]);

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
    () => allWeekJobs.reduce((s, j) => s + computeJobSubtotal(j), 0),
    [allWeekJobs]
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
        // needsWrap: only show after scheduled end passes (don't surface future wrap-ups)
        // needsPay: show immediately once completed regardless of scheduled end time
        return (isPast && needsWrap) || needsPay;
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
      ...allWeekJobs.map(j => j.id),
      ...attentionItems.map(j => j.id),
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
  }, [allWeekJobs, attentionItems]);

  const collectedThisWeek = useMemo(() => {
    return allWeekJobs.reduce((s, j) => {
      if (j.payment_status === 'Paid') return s + computeJobSubtotal(j);
      if (j.payment_status === 'Partial') return s + (paymentMap[j.id] || 0);
      return s;
    }, 0);
  }, [allWeekJobs, paymentMap]);

  const weekOwed = useMemo(() => {
    return allWeekJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid')
      .reduce((s, j) => s + Math.max(0, computeJobTotal(j) - (paymentMap[j.id] || 0)), 0);
  }, [allWeekJobs, paymentMap]);

  const weekUpcoming = useMemo(() => {
    return allWeekJobs
      .filter(j => j.status === 'Scheduled')
      .reduce((s, j) => s + computeJobSubtotal(j), 0);
  }, [allWeekJobs]);

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
      if (b.start <= now) continue;
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
  const [isGoLaunching, setIsGoLaunching] = useState(false);
  const [fromHereDuration, setFromHereDuration] = useState(null);
  const [isFromHereLoading, setIsFromHereLoading] = useState(false);

  const handleSupermomGo = (e) => {
    e.stopPropagation();
    if (!next?.address) return;
    setIsGoLaunching(true);
    setTimeout(() => {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(next.address)}`, '_blank');
      setIsGoLaunching(false);
    }, 650);
  };

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

  const handleFromHere = (e) => {
    e.stopPropagation();
    if (!next?.address) return;
    setIsFromHereLoading(true);
    setFromHereDuration(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
          const res = await fetch(`/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(next.address)}`);
          const data = await res.json();
          const el = data?.rows?.[0]?.elements?.[0];
          if (el?.status === 'OK') setFromHereDuration(el.duration.text);
          else setFromHereDuration('Unavailable');
        } catch {
          setFromHereDuration('Unavailable');
        } finally {
          setIsFromHereLoading(false);
        }
      },
      () => { setFromHereDuration('Location denied'); setIsFromHereLoading(false); },
      { timeout: 8000 }
    );
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
            <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 8 }}>
              ✦ Command Brief · {dateBrief(today)}
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
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              onClick={() => openDetail(
                'This Week',
                allWeekJobs.map(j => ({ ...j, total: computeJobSubtotal(j) })),
                'jobs'
              )}
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
                This Week
              </div>
              {displayRevenue > 0 && (
                <>
                  {collectedThisWeek > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', marginTop: 3, letterSpacing: '0.3px' }}>
                      {privacyOn ? '•••' : (
                        collectedThisWeek >= displayRevenue
                          ? '✓ all collected'
                          : `$${collectedThisWeek.toFixed(0)} collected`
                      )}
                    </div>
                  )}
                  {weekOwed > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', marginTop: 2, letterSpacing: '0.3px' }}>
                      {privacyOn ? '•••' : `$${weekOwed.toFixed(0)} owed`}
                    </div>
                  )}
                  {weekUpcoming > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.inkMuted, marginTop: 2, letterSpacing: '0.3px' }}>
                      {privacyOn ? '•••' : `$${weekUpcoming.toFixed(0)} upcoming`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

        {/* Stale attention banner */}
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

        {/* Tight transition alert */}
        {tightGap && (
          <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 20 }}>🕒</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9A3412', textTransform: 'uppercase', marginBottom: 2 }}>Tight Transition</div>
              <div style={{ fontSize: 12, color: '#7C2D12', lineHeight: 1.3 }}>
                Only {fmtDuration(tightGap.gapMin)} between {tightGap.a.client_name} and {tightGap.b.client_name}.
                {tightGap.driveMin > 0 && ` Drive takes ~${fmtDuration(tightGap.driveMin)}.`}
              </div>
            </div>
          </div>
        )}

        {/* TODAY — Active Job */}
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
          /* TODAY — Next Up */
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
                      const timingLabel = isNowWindow ? '🔴 Happening now' : minsToStart > 0 ? `Starts in ${fmtDuration(minsToStart)}` : null;
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
                              {next.worker_name && (
                                <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 3 }}>{next.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {next.worker_name}</div>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontSize: 17, fontWeight: 900, color: DEEP_ROSE, fontFamily: T.font, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
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
                          {!privacyOn && computeJobSubtotal(next) > 0 && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: DEEP_ROSE, opacity: 0.65, marginBottom: 6 }}>
                              Est. ${computeJobSubtotal(next).toFixed(0)}{computeJobTotal(next) > computeJobSubtotal(next) && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.7, marginLeft: 2 }}> +HST</span>}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 10px', background: DEEP_ROSE_TINT, borderRadius: 10 }}>
                      <span style={{ fontSize: 13 }}>🚗</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>
                          {fromHereDuration
                            ? `${fromHereDuration} from here`
                            : next.ai_context?.drive_to?.duration
                              ? `${next.ai_context.drive_to.duration} from home`
                              : next.address
                                ? 'Calculating drive time…'
                                : 'No address on file'}
                        </div>
                        {next.address && (
                          <button
                            onClick={handleFromHere}
                            disabled={isFromHereLoading}
                            style={{ background: 'none', border: 'none', color: DEEP_ROSE, cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: 0, marginTop: 2, opacity: isFromHereLoading ? 0.5 : 0.8 }}
                          >
                            {isFromHereLoading ? '…' : fromHereDuration ? '↻ from here' : '📍 from here'}
                          </button>
                        )}
                      </div>
                      {next.ai_context?.drive_to && (
                        <button onClick={e => { e.stopPropagation(); handleRefreshTraffic(e); }} disabled={isRefreshingTraffic} style={{ background: 'none', border: 'none', color: DEEP_ROSE, cursor: 'pointer', fontSize: 14, padding: 2 }} title="Refresh from home">
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}`, position: 'relative' }}>
                      {next.address && (
                        <button
                          onClick={handleSupermomGo}
                          disabled={isGoLaunching}
                          style={{
                            width: '100%', padding: '13px', borderRadius: 12,
                            background: isGoLaunching
                              ? 'linear-gradient(90deg,#8B0E3F,#E91E6A,#FF78B0)'
                              : `linear-gradient(90deg,${DEEP_ROSE},#E91E6A)`,
                            color: 'white', border: 'none',
                            fontSize: 14, fontWeight: 800, cursor: isGoLaunching ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'background 0.3s, transform 0.15s',
                            transform: isGoLaunching ? 'scale(0.97)' : 'scale(1)',
                            letterSpacing: '0.4px',
                            boxShadow: isGoLaunching ? 'none' : '0 4px 16px rgba(233,30,106,0.35)',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 48 46" fill="white"
                            style={{
                              transition: 'transform 0.4s ease, opacity 0.4s ease',
                              transform: isGoLaunching ? 'translateX(6px) scale(1.3)' : 'translateX(0) scale(1)',
                              opacity: isGoLaunching ? 0.5 : 1,
                            }}
                          >
                            <path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
                          </svg>
                          <span style={{ transition: 'opacity 0.2s', opacity: isGoLaunching ? 0.7 : 1 }}>
                            {isGoLaunching ? 'LAUNCHING…' : 'SUPERMOM GO'}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleClockOut(next.id); }}
                        style={{
                          width: '100%', padding: '11px', borderRadius: 12,
                          background: next.address ? 'transparent' : DEEP_ROSE,
                          border: next.address ? `1.5px solid ${DEEP_ROSE}` : 'none',
                          color: next.address ? DEEP_ROSE : 'white',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.4px',
                        }}
                      >
                        START NOW
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

        {/* TODAY — Remaining jobs */}
        {todayUpcoming.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel color={T.pink} style={{ marginBottom: 8 }}>COMING UP TODAY</SectionLabel>
            {todayUpcoming.map(j => (
              <UpcomingCard
                key={j.id}
                job={j}
                T={T}
                onClick={() => openJob(j.id)}
                total={computeJobSubtotal(j)}
                grandTotal={computeJobTotal(j)}
                paid={paymentMap[j.id] || 0}
                privacyOn={privacyOn}
                hstNote={computeJobTotal(j) > computeJobSubtotal(j)}
              />
            ))}
          </div>
        )}

        {/* NEEDS ACTION — carry-forward from any past date */}
        {attentionItems.length > 0 && (
          <div ref={attentionRef} style={{ marginBottom: 24 }}>
            <SectionLabel color="#78350F">Needs Action</SectionLabel>
            {attentionItems.map(j => {
              const needsWrap = j.status !== 'Completed';
              const paid = paymentMap[j.id] || 0;
              const total = computeJobTotal(j);
              const remaining = Math.max(0, total - paid);
              const src = j.raw || j;
              const isHourly = src.pricing_type === 'Hourly';
              const rate = Number(src.hourly_rate || src.flat_rate || 0);
              const pricingLabel = isHourly ? `Hourly · $${rate.toFixed(0)}/hr` : 'Flat rate';
              const attnHstNote = computeJobTotal(j) > computeJobSubtotal(j);
              const isAttnPartial = !needsWrap && j.payment_status === 'Partial';
              const isAttnUnpaid = !needsWrap && !isAttnPartial;
              const cardBorder = needsWrap ? '#F59E0B' : isAttnPartial ? '#F97316' : '#EF4444';
              const cardBg = needsWrap
                ? (mode === 'dark' ? 'rgba(245,158,11,0.08)' : '#FFFBEB')
                : isAttnPartial
                  ? (mode === 'dark' ? 'rgba(249,115,22,0.08)' : '#FFF7ED')
                  : (mode === 'dark' ? 'rgba(239,68,68,0.08)' : '#FEF2F2');
              return (
                <div
                  key={j.id}
                  onClick={() => openJob(j.id)}
                  style={{
                    background: cardBg,
                    border: `2px solid ${cardBorder}`,
                    borderLeft: `6px solid ${cardBorder}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                    marginBottom: 10,
                    cursor: 'pointer',
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
                      {j.worker_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: '#92400E', opacity: 0.75 }}>{j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}</span>
                          {j.payment_status === 'Paid' && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
                            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px' }}>$ Unpaid</span>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                        {j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtTimeRange(j.start, j.end)}
                      </div>
                      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 10, color: '#92400E', opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {pricingLabel}
                        </div>
                        {privacyOn ? (
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.pink, letterSpacing: '-0.2px' }}>••• owing</span>
                        ) : remaining > 0 ? (
                          <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                            {paid > 0 && (
                              <>
                                <span style={{ color: '#92400E', opacity: 0.7 }}>${total.toFixed(0)} total</span>
                                <span style={{ color: '#92400E', opacity: 0.4 }}>·</span>
                                <span style={{ color: '#16A34A' }}>${paid.toFixed(0)} paid</span>
                                <span style={{ color: '#92400E', opacity: 0.4 }}>·</span>
                              </>
                            )}
                            <span style={{ color: T.pink, fontWeight: 800 }}>${remaining.toFixed(0)} owing{attnHstNote && <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.55, marginLeft: 3, fontFamily: T.font }}>(incl. HST)</span>}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>${total.toFixed(0)} total{attnHstNote && <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.55, marginLeft: 3, fontFamily: T.font }}>(incl. HST)</span>}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openPostJob(j.id); }}
                      style={{ background: cardBorder, color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}
                    >
                      {needsWrap ? 'WRAP UP' : remaining > 0 ? 'COLLECT' : 'VIEW'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REST OF THIS WEEK — upcoming scheduled jobs */}
        {restOfWeekJobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel style={{ color: T.inkSub, marginBottom: 8 }}>REST OF THIS WEEK</SectionLabel>
            {restOfWeekJobs.map(j => {
              const total = computeJobSubtotal(j);
              const rowHstNote = computeJobTotal(j) > total;
              return (
                <div
                  key={j.id}
                  onClick={() => openJob(j.id)}
                  style={{
                    background: mode === 'dark' ? T.card : '#FFF9F5',
                    border: `1px solid ${T.cardBorder}`,
                    borderLeft: '3px solid #FFD6E8',
                    borderRadius: 12,
                    padding: '10px 14px 10px 12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSub, marginBottom: 2, whiteSpace: 'nowrap' }}>
                      {j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.pink, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                      {fmtTimeRange(j.start, j.end)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: T.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {j.client_name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSub, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {j.service_name}
                    </div>
                    {j.worker_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10.5, color: T.inkMuted }}>{j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}</span>
                        {j.payment_status === 'Paid' && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
                          <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px' }}>$ Unpaid</span>
                        )}
                      </div>
                    )}
                    {j.job_notes && (
                      <div style={{
                        fontSize: 10, color: T.inkMuted, fontStyle: 'italic', marginTop: 2,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', lineHeight: 1.35,
                      }}>
                        {j.job_notes}
                      </div>
                    )}
                  </div>
                  {!privacyOn && total > 0 && (
                    <div style={{
                      fontFamily: T.serif, fontSize: 14, fontWeight: 500,
                      color: T.inkSub, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                    }}>
                      ${total.toFixed(0)}{rowHstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* DONE THIS WEEK — subtle progress view */}
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
                total={computeJobSubtotal(j)}
                grandTotal={computeJobTotal(j)}
                privacyOn={privacyOn}
                hstNote={computeJobTotal(j) > computeJobSubtotal(j)}
                subtle
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeJob && !next && todayUpcoming.length === 0 && attentionItems.length === 0 && restOfWeekJobs.length === 0 && completedPaidThisWeek.length === 0 && (
          <EmptyState allDone={allDone} T={T} persona={persona} />
        )}

      </div>

      <div style={{ height: isKeyboardFocused ? 80 : 0, transition: 'height 0.2s ease-out' }} />
    </div>
  );
}

