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

const DEEP_ROSE = '#B5004E';

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
  const [owingOpen, setOwingOpen] = useState(false);

  const [currentWeekStart, currentWeekEnd] = useMemo(() => {
    const week = getWeekRange(today);
    const endOfSunday = new Date(week[6]);
    endOfSunday.setHours(23, 59, 59, 999);
    return [week[0], endOfSunday];
  }, [today]);

  const [nextWeekStart, nextWeekEnd] = useMemo(() => {
    const start = new Date(currentWeekEnd);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }, [currentWeekEnd]);

  // Friday of the current week (index 4 in Mon-Sun week = day[0]+4 days)
  const fridayOfThisWeek = useMemo(() => {
    const fri = new Date(currentWeekStart);
    fri.setDate(fri.getDate() + 4);
    fri.setHours(0, 0, 0, 0);
    return fri;
  }, [currentWeekStart]);

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
  const isNowWindow = next ? (now >= next.start && now < next.end) : false;

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

  const showNextWeekPreview = today >= fridayOfThisWeek;

  const nextWeekJobs = useMemo(() => {
    if (!allJobs || !showNextWeekPreview) return [];
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
        j.start >= nextWeekStart &&
        j.start <= nextWeekEnd
      )
      .sort((a, b) => a.start - b.start);
  }, [allJobs, nextWeekStart, nextWeekEnd, showNextWeekPreview]);

  // Stable string of IDs — changes only when actual job IDs change, not every clock tick.
  // attentionItems depends on `now` (updates every minute), so we extract IDs here to
  // prevent the payments fetch from firing 1440x/day while the tab is open.
  const paymentFetchKey = useMemo(() => {
    const ids = [...new Set([
      ...allWeekJobs.map(j => j.id),
      ...attentionItems.map(j => j.id),
    ])].sort();
    return ids.join(',');
  }, [allWeekJobs, attentionItems]);

  const [paymentMap, setPaymentMap] = useState({});
  useEffect(() => {
    const jobIds = paymentFetchKey ? paymentFetchKey.split(',') : [];

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
  }, [paymentFetchKey]);

  const owingGroups = useMemo(() => {
    const map = {};
    attentionItems.forEach(j => {
      if (!map[j.client_id]) {
        map[j.client_id] = {
          client_id: j.client_id,
          client_name: j.client_name,
          jobs: [],
          totalOwing: 0,
          maxHoursOld: 0,
          hasCompleted: false,
        };
      }
      const g = map[j.client_id];
      g.jobs.push(j);
      const paid = paymentMap[j.id] || 0;
      const remaining = Math.max(0, computeJobTotal(j) - paid);
      g.totalOwing += remaining;
      const hoursOld = (now - j.end) / 3600000;
      g.maxHoursOld = Math.max(g.maxHoursOld, hoursOld);
      if (j.status === 'Completed') g.hasCompleted = true;
    });
    return Object.values(map).sort((a, b) => b.maxHoursOld - a.maxHoursOld);
  }, [attentionItems, paymentMap, now]);

  const owingTotal = owingGroups.reduce((sum, g) => sum + g.totalOwing, 0);

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

  const locationFetchedRef = useRef(false);
  const routesFetchedRef = useRef(false);
  const activeJobIdRef = useRef(null);

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

  function formatLeaveBy(durationValue, jobStart, nowDate) {
    const leaveByMs = jobStart.getTime() - durationValue * 1000;
    const msUntilLeave = leaveByMs - nowDate.getTime();
    const minsUntilLeave = Math.round(msUntilLeave / 60000);
    if (minsUntilLeave <= 0) return { text: 'Leave NOW', urgent: true };
    if (minsUntilLeave <= 60) return { text: `Leave in ${fmtDuration(minsUntilLeave)}`, urgent: minsUntilLeave <= 15 };
    const { time, period } = fmtTime12(new Date(leaveByMs));
    return { text: `Leave by ${time} ${period}`, urgent: false };
  }

  useEffect(() => {
    if (!loading && todayJobs.length > 0 && !routesFetchedRef.current) {
      const needsUpdate = todayJobs.some(j => j.ai_context?.drive_to === undefined);
      if (needsUpdate) {
        routesFetchedRef.current = true;
        updateDailyRoutes(todayJobs.map(j => j.raw));
      }
    }
  }, [todayJobs, loading]);

  useEffect(() => {
    if (!loading && todayJobs.length > 0 && !locationFetchedRef.current) {
      locationFetchedRef.current = true;
      fetchLocationDrives();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayJobs, loading]);

  // Re-fetch GPS drives from job site when Sandra clocks into a job
  useEffect(() => {
    if (activeJob?.id && activeJob.id !== activeJobIdRef.current) {
      activeJobIdRef.current = activeJob.id;
      fetchLocationDrives();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id]);

  const openJob = detailSheet?.openJob;
  const openPostJob = postJobSheet?.openPostJob;
  const openDetail = financeSheet?.open;

  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);
  const [isGoLaunching, setIsGoLaunching] = useState(false);
  const [isFlyingIcon, setIsFlyingIcon] = useState(false);
  const [locationDrives, setLocationDrives] = useState({});
  const [locationLoading, setLocationLoading] = useState(false);

  const nextDriveValue =
    locationDrives[next?.id]?.durationValue ??
    next?.raw?.ai_context?.drive_to?.durationValue ??
    0;
  const minsLateToLeave = (next && nextDriveValue > 0)
    ? Math.round((now - (next.start.getTime() - nextDriveValue * 1000)) / 60000)
    : 0;

  const briefingMsg = useMemo(() => getBriefingMessage({
    allDone,
    activeJob,
    next,
    now,
    todayJobs,
    attentionItemCount: attentionItems.length,
    persona,
    firstName,
    minsLateToLeave,
  }), [allDone, activeJob, next, now, todayJobs, attentionItems.length, persona, firstName, minsLateToLeave]);
  const [lastKnownOrigin, setLastKnownOrigin] = useState(null);

  const handleSupermomGo = (e) => {
    e.stopPropagation();
    if (!next?.address) return;
    setIsGoLaunching(true);
    setIsFlyingIcon(true);
    const gpsPromise = new Promise(resolve =>
      navigator.geolocation.getCurrentPosition(
        pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve(null),
        { timeout: 1000, maximumAge: 30000 }
      )
    );
    setTimeout(async () => {
      const freshOrigin = await gpsPromise;
      const origin = freshOrigin ?? lastKnownOrigin;
      if (freshOrigin) setLastKnownOrigin(freshOrigin);
      const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
      window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(next.address)}&travelmode=driving&avoid=tolls`, '_blank');
      setIsGoLaunching(false);
    }, 1100);
    setTimeout(() => setIsFlyingIcon(false), 1450);
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

  const fetchLocationDrives = async () => {
    const targets = todayJobs.filter(j => j.address && j.end > now && j.status === 'Scheduled');
    if (!targets.length) return;
    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const origin = `${position.coords.latitude},${position.coords.longitude}`;
      setLastKnownOrigin(origin);
      const destinations = targets.map(j => j.address).join('|');
      const res = await fetch(`/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinations)}&departure_time=now&avoid=tolls`);
      const data = await res.json();
      if (data?.status !== 'OK') return;
      const newDrives = {};
      targets.forEach((job, idx) => {
        const el = data.rows?.[0]?.elements?.[idx];
        if (el?.status === 'OK') {
          const trafficDuration = el.duration_in_traffic ?? el.duration;
          newDrives[job.id] = {
            duration: trafficDuration.text,
            durationValue: trafficDuration.value,
          };
        }
      });
      setLocationDrives(newDrives);
    } catch (err) {
      // silently fail — drive time is best-effort
    } finally {
      setLocationLoading(false);
    }
  };

  const handleRefreshLocation = async (e) => {
    e.stopPropagation();
    setLocationDrives({});
    await fetchLocationDrives();
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
            <div style={{ marginTop: 2 }}>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>


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

              {/* Up Next strip — drive time from current job site to next job */}
              {next && (() => {
                const locDrive = locationDrives[next.id];
                const fallbackDrive = next.raw?.ai_context?.drive_to;
                const driveValue = locDrive?.durationValue ?? fallbackDrive?.durationValue ?? 0;
                const driveDuration = locDrive?.duration ?? fallbackDrive?.duration ?? null;
                const isGPS = !!locDrive;
                const leaveBy = driveValue > 0 ? formatLeaveBy(driveValue, next.start, now) : null;
                const gapMin = Math.round((next.start - activeJob.end) / 60000);
                const driveMin = Math.round(driveValue / 60);
                const isTight = driveMin > 0 && gapMin < driveMin + 15;
                const urgentColor = leaveBy?.urgent ? '#DC2626' : isTight ? '#F59E0B' : '#16A34A';
                return (
                  <div style={{
                    margin: '10px 0 0',
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: leaveBy?.urgent ? 'rgba(220,38,38,0.08)' : isTight ? 'rgba(245,158,11,0.08)' : mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F9F9F9',
                    border: `1px solid ${leaveBy?.urgent ? 'rgba(220,38,38,0.2)' : isTight ? 'rgba(245,158,11,0.25)' : T.cardBorder}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: urgentColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                          Up Next · {fmtTime12(next.start).time} {fmtTime12(next.start).period}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {next.client_name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {leaveBy ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: urgentColor }}>{leaveBy.text}</div>
                            {driveDuration && (
                              <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 1 }}>
                                {driveDuration} drive{!isGPS && driveDuration ? ' · est. from home' : ''}
                              </div>
                            )}
                          </>
                        ) : driveDuration ? (
                          <div style={{ fontSize: 11, color: T.inkMuted }}>{driveDuration} drive{!isGPS ? ' · est.' : ''}</div>
                        ) : (
                          <div style={{ fontSize: 10, color: T.inkMuted }}>No address</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                      const timingColor = isNowWindow ? '#E91E6A' : minsToStart <= 15 ? '#EF4444' : minsToStart <= 60 ? '#F59E0B' : '#16A34A';
                      const timingLabel = isNowWindow ? '🔴 Happening now' : minsToStart > 0 ? `Starts in ${fmtDuration(minsToStart)}` : null;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, position: 'relative' }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                              <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, color: T.ink, lineHeight: 1.1, letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {next.client_name}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: DEEP_ROSE, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>
                                {next.service_name}
                              </div>
                              {next.notes && (
                                <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 3, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {next.notes}
                                </div>
                              )}
                              {next.worker_name && (
                                <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 3 }}>{next.assignee_type === 'staff' ? '🌟 Wingmom:' : '🦸 Sidekick:'} {next.worker_name}</div>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontSize: 17, fontWeight: 900, color: DEEP_ROSE, fontFamily: T.font, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                {timeRange}
                              </div>
                              {timingLabel && (
                                <div style={{ fontSize: 10, fontWeight: 800, color: timingColor, marginTop: 4, whiteSpace: 'nowrap' }}>
                                  {timingLabel}
                                </div>
                              )}
                              {!privacyOn && computeJobSubtotal(next) > 0 && (
                                <div style={{ fontSize: 11, fontWeight: 600, color: DEEP_ROSE, opacity: 0.65, marginTop: 4, whiteSpace: 'nowrap' }}>
                                  Est. ${computeJobSubtotal(next).toFixed(0)}{computeJobTotal(next) > computeJobSubtotal(next) && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.7, marginLeft: 2 }}> +HST</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {isNowWindow ? (() => {
                      const afterNext = todayJobs.find(tj => tj.start > next.start && tj.id !== next.id);
                      const driveToNext = afterNext ? (locationDrives[afterNext.id]?.duration ?? afterNext.ai_context?.drive_to?.duration) : null;
                      if (!afterNext && !driveToNext) return null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 10px', background: DEEP_ROSE_TINT, borderRadius: 10 }}>
                          <span style={{ fontSize: 13 }}>🚗</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: T.ink }}>
                            {driveToNext
                              ? `${driveToNext} to ${afterNext.client_name}`
                              : afterNext
                                ? `Next: ${afterNext.client_name}`
                                : null}
                          </div>
                        </div>
                      );
                    })() : (() => {
                      const locDrive = locationDrives[next.id];
                      const fallback = next.ai_context?.drive_to?.duration;
                      const fallbackValue = next.ai_context?.drive_to?.durationValue;
                      const leaveBy = locDrive
                        ? formatLeaveBy(locDrive.durationValue, next.start, now)
                        : fallbackValue
                          ? formatLeaveBy(fallbackValue, next.start, now)
                          : null;
                      const isUrgent = leaveBy?.urgent ?? false;
                      let driveLabel;
                      if (locationLoading) driveLabel = 'Getting your location…';
                      else if (leaveBy) driveLabel = leaveBy.text;
                      else if (next.address) driveLabel = 'Calculating drive time…';
                      else driveLabel = 'No address on file';
                      const arrivalTime = (() => {
                        const secs = locDrive?.durationValue ?? fallbackValue ?? null;
                        if (!secs) return null;
                        return new Date(Date.now() + secs * 1000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' });
                      })();
                      const driveSubtitle = locationLoading ? null
                        : locDrive ? `${locDrive.duration} · arrive ${arrivalTime} · live traffic`
                        : fallback ? `~${fallback} · arrive ~${arrivalTime} · est. from home`
                        : null;
                      if (next.address) {
                        return (
                          <div style={{ marginBottom: 10, overflow: 'visible', position: 'relative' }}>
                            <button
                              onClick={handleSupermomGo}
                              disabled={isGoLaunching}
                              className={isUrgent && !isGoLaunching ? 'go-btn-urgent' : ''}
                              style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: 12,
                                background: isGoLaunching
                                  ? 'linear-gradient(90deg,#8B0E3F,#E91E6A,#FF78B0)'
                                  : `linear-gradient(90deg,${DEEP_ROSE},#E91E6A)`,
                                color: 'white',
                                border: 'none',
                                cursor: isGoLaunching ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                transition: 'background 0.3s, transform 0.15s',
                                transform: isGoLaunching ? 'scale(0.97)' : 'scale(1)',
                                boxShadow: isGoLaunching ? 'none' : '0 4px 16px rgba(233,30,106,0.35)',
                                textAlign: 'left',
                                overflow: 'visible',
                              }}
                            >
                              <img
                                src="/branding/supermom_icon_transparent.png"
                                className={`sm-hero-icon${isFlyingIcon ? ' launching' : ''}`}
                                style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
                                alt=""
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.3px', transition: 'opacity 0.2s', opacity: isGoLaunching ? 0.7 : 1 }}>
                                  {isGoLaunching ? 'LAUNCHING…' : driveLabel}
                                </div>
                                {!isGoLaunching && driveSubtitle && (
                                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                                    {driveSubtitle}
                                  </div>
                                )}
                              </div>
                              {!isGoLaunching && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRefreshLocation(e); }}
                                  disabled={locationLoading}
                                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 13, padding: '4px 7px', opacity: locationLoading ? 0.4 : 1, flexShrink: 0 }}
                                  title="Refresh location"
                                >
                                  {locationLoading ? '…' : '↻'}
                                </button>
                              )}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 10px', background: DEEP_ROSE_TINT, borderRadius: 10 }}>
                          <span style={{ fontSize: 13 }}>🚗</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{driveLabel}</div>
                          </div>
                        </div>
                      );
                    })()}


                    <MissionIntel prepNote={next.prep_note || next.client_access_json || next.client_prefs_json} T={T} theme={T} />
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
            {todayUpcoming.map(j => {
              const locDrive = locationDrives[j.id];
              const leaveBy = locDrive ? formatLeaveBy(locDrive.durationValue, j.start, now) : null;
              return (
                <div key={j.id}>
                  <UpcomingCard
                    job={j}
                    T={T}
                    onClick={() => openJob(j.id)}
                    total={computeJobSubtotal(j)}
                    grandTotal={computeJobTotal(j)}
                    paid={paymentMap[j.id] || 0}
                    privacyOn={privacyOn}
                    hstNote={computeJobTotal(j) > computeJobSubtotal(j)}
                  />
                  {leaveBy && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: -4, marginBottom: 8, paddingLeft: 16 }}>
                      <span style={{ fontSize: 10 }}>{leaveBy.urgent ? '⚠️' : '🚗'}</span>
                      <span style={{ fontSize: 10, fontWeight: leaveBy.urgent ? 800 : 600, color: leaveBy.urgent ? '#DC2626' : T.inkMuted }}>
                        {leaveBy.text}
                        {!leaveBy.urgent && <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>· {locDrive.duration} away</span>}
                      </span>
                    </div>
                  )}
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
                const rowDateLabel = j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const rowTimeRange = fmtTimeRange(j.start, j.end);
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
                  }}
                >
                  {/* Row 1: name · bold time | pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={{
                      fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink,
                      flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      letterSpacing: '-0.3px',
                    }}>
                      {j.client_name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.pink, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.3px' }}>
                      {rowTimeRange}
                    </div>
                    <span style={{
                      fontFamily: T.font, fontSize: 9, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.3px',
                      background: `${T.pink}18`, color: T.pink,
                      padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                    }}>
                      SCHEDULED
                    </span>
                  </div>

                  {/* Row 2: date | amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: T.inkSub }}>{rowDateLabel}</div>
                    {!privacyOn && total > 0 && (
                      <div style={{
                        fontFamily: T.serif, fontSize: 14, fontWeight: 600,
                        color: T.inkSub, fontVariantNumeric: 'tabular-nums',
                      }}>
                        ${total.toFixed(0)}{rowHstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
                      </div>
                    )}
                  </div>

                  {/* Row 3: service */}
                  <div style={{
                    fontFamily: T.font, fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                    background: `${T.pink}18`, color: T.pink,
                    padding: '2px 6px', borderRadius: 4,
                    display: 'inline-block', marginBottom: 3,
                  }}>
                    {j.service_name}
                  </div>

                  {/* Worker */}
                  {j.worker_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, color: T.inkMuted }}>{j.assignee_type === 'staff' ? '🌟 Wingmom:' : '🦸 Sidekick:'} {j.worker_name}</span>
                      {j.payment_status === 'Paid' && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
                        <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px' }}>$ Unpaid</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {j.notes && (
                    <div style={{
                      fontSize: 10, color: T.inkMuted, fontStyle: 'italic', marginTop: 3,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', lineHeight: 1.35,
                    }}>
                      {j.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* OWING — collapsible, below today's schedule */}
        {owingGroups.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              onClick={() => setOwingOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px',
                background: mode === 'dark' ? 'rgba(181,0,78,0.1)' : '#FFF0F4',
                borderRadius: owingOpen ? '12px 12px 0 0' : 12,
                border: `1px solid rgba(181,0,78,0.25)`,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{
                fontSize: 10, color: DEEP_ROSE,
                display: 'inline-block',
                transform: owingOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.18s',
              }}>▶</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: DEEP_ROSE }}>
                {owingGroups.length} owing{!privacyOn && owingTotal > 0 ? ` · $${owingTotal.toFixed(0)}` : ''}
              </div>
              <span style={{ fontSize: 11, color: DEEP_ROSE, opacity: 0.55, fontWeight: 600 }}>
                {owingOpen ? 'hide' : 'show'}
              </span>
            </div>
            {owingOpen && (
              <div style={{
                borderRadius: '0 0 12px 12px',
                border: `1px solid rgba(181,0,78,0.25)`,
                borderTop: 'none',
                overflow: 'hidden',
              }}>
                {owingGroups.map((g, i) => {
                  const isStale = g.maxHoursOld >= 48 && g.hasCompleted;
                  const isFresh = !isStale && g.hasCompleted;
                  const bgColor = isStale
                    ? (mode === 'dark' ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.07)')
                    : isFresh
                      ? (mode === 'dark' ? 'rgba(181,0,78,0.1)' : 'rgba(181,0,78,0.05)')
                      : (mode === 'dark' ? 'rgba(181,0,78,0.06)' : 'rgba(181,0,78,0.03)');
                  const accentColor = isStale ? '#DC2626' : DEEP_ROSE;
                  const mostRecentJob = g.jobs[g.jobs.length - 1];
                  const allWrapUp = g.jobs.every(j => j.status !== 'Completed');
                  const dateLabel = mostRecentJob.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <div
                      key={g.client_id}
                      onClick={() => openJob(mostRecentJob.id)}
                      style={{
                        background: bgColor,
                        borderTop: i > 0 ? `1px solid rgba(181,0,78,0.12)` : 'none',
                        borderLeft: `3px solid ${accentColor}`,
                        padding: '10px 14px 10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
                          {g.client_name}
                        </div>
                        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 800, color: accentColor, whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {privacyOn ? '•••' : allWrapUp ? `~$${g.totalOwing.toFixed(0)} est.` : `$${g.totalOwing.toFixed(0)} owing`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: T.inkMuted }}>{dateLabel}</span>
                        <span style={{ fontSize: 11, color: T.inkMuted, opacity: 0.4 }}>·</span>
                        <span style={{ fontSize: 11, color: T.inkMuted }}>{mostRecentJob.service_name}</span>
                        {g.jobs.length > 1 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, background: `${accentColor}18`, padding: '1px 5px', borderRadius: 4 }}>
                            +{g.jobs.length - 1} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NEXT WEEK PREVIEW — shown from Friday onward */}
        {nextWeekJobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel style={{ color: T.inkMuted, marginBottom: 8 }}>COMING UP NEXT WEEK</SectionLabel>
            {nextWeekJobs.map(j => {
              const total = computeJobSubtotal(j);
              const rowHstNote = computeJobTotal(j) > total;
              const rowDateLabel = j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const rowTimeRange = fmtTimeRange(j.start, j.end);
              return (
                <div
                  key={j.id}
                  onClick={() => openJob(j.id)}
                  style={{
                    background: mode === 'dark' ? T.card : '#FAFAFA',
                    border: `1px solid ${T.cardBorder}`,
                    borderLeft: '3px solid #E2C5D4',
                    borderRadius: 12,
                    padding: '10px 14px 10px 12px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    opacity: 0.82,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={{
                      fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: T.ink,
                      flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      letterSpacing: '-0.3px',
                    }}>
                      {j.client_name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {rowTimeRange}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: T.inkMuted }}>{rowDateLabel}</div>
                    {!privacyOn && total > 0 && (
                      <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 600, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                        ${total.toFixed(0)}{rowHstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
                      </div>
                    )}
                  </div>
                  {j.service_name && (
                    <div style={{
                      fontFamily: T.font, fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                      background: `${T.inkMuted}18`, color: T.inkMuted,
                      padding: '2px 6px', borderRadius: 4,
                      display: 'inline-block', marginTop: 4,
                    }}>
                      {j.service_name}
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
        {!activeJob && !next && todayUpcoming.length === 0 && attentionItems.length === 0 && restOfWeekJobs.length === 0 && completedPaidThisWeek.length === 0 && nextWeekJobs.length === 0 && (
          <EmptyState allDone={allDone} T={T} persona={persona} />
        )}

      </div>

      <div style={{ height: isKeyboardFocused ? 80 : 0, transition: 'height 0.2s ease-out' }} />
    </div>
  );
}

