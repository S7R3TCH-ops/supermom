import { useMemo, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useToast } from '../context/ToastContext';
import { useKeyboardFocus } from '../hooks/useKeyboardFocus';
import { sameDay, getWeekRange, fmtTime12, dateBrief, fmtDuration } from '../lib/dateUtils';
import { computeJobTotal } from '../lib/financialMath';
import { getWorkerLabel } from '../lib/labels';
import OfflineMessage from '../components/ui/OfflineMessage';
import JobCard from '../components/cards/JobCard';
import UpcomingCard from '../components/cards/UpcomingCard';
import Swipeable from '../components/ui/Swipeable';
import EmptyState from '../components/cards/EmptyState';
import LiveTimer from '../components/cards/LiveTimer';
import MissionIntel from '../components/cards/MissionIntel';
import PaymentBreakdown from '../components/cards/PaymentBreakdown';

const DEEP_ROSE = '#B5004E';

export default function Home() {
  const navigate = useNavigate();
  const themeCtx = useAppTheme();
  const jobsCtx = useJobs();
  const detailSheet = useJobDetailSheet();
  const postJobSheet = usePostJobSheet();
  const financeSheet = useFinanceDetailSheet();
  const newJobSheet = useNewJobSheet();
  const authCtx = useAuth();
  const { handleClockOut } = useGeofence();
  const toast = useToast();
  const bizCtx = useBusiness();
  const isKeyboardFocused = useKeyboardFocus();

  // Use a stable reference for "today"
  const [today, setToday] = useState(() => new Date());
  const hiddenAtRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

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
  const { jobs: allJobs, loading, error: jobsError, refresh: refetchJobs } = jobsCtx || {};
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

  // Resume handler: refresh clock, reload if date changed or away >30 min, re-fetch drives if stale.
  // Placed here (after todayJobs) to avoid TDZ — todayJobs is const, accessing it in the dep array
  // before its declaration crashes the production bundle.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      const awayMs = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      
      const currentDate = new Date();
      setNow(currentDate);
      
      if (awayMs > 30 * 60 * 1000) {
        window.location.reload();
        return;
      }
      
      if (!sameDay(currentDate, today)) {
        setToday(currentDate);
      }
      
      if (todayJobs.length > 0 && Date.now() - lastFetchTimeRef.current > 10 * 60 * 1000) {
        fetchLocationDrives();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayJobs, today]);

  const allDone = todayJobs.length > 0 && !todayJobs.some(j => j.status === 'Scheduled' || j.payment_status !== 'Paid');

  const displayRevenue = useMemo(
    () => allWeekJobs.reduce((s, j) => s + computeJobTotal(j), 0),
    [allWeekJobs]
  );

  const monthlyGoal = business?.ai_profile?.revenue_goal_monthly || null;
  const monthlyRevenue = useMemo(() => {
    if (!monthlyGoal || !allJobs) return 0;
    const now2 = new Date();
    const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
    const monthEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 0, 23, 59, 59, 999);
    return allJobs
      .filter(j => {
        if (j.status !== 'Completed') return false;
        const d = j.raw?.scheduled_date;
        if (!d) return false;
        const [y, m, day] = d.split('-').map(Number);
        const date = new Date(y, m - 1, day);
        return date >= monthStart && date <= monthEnd;
      })
      .reduce((s, j) => s + computeJobTotal(j), 0);
  }, [allJobs, monthlyGoal]);

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

  const owingJobs = useMemo(() => {
    return attentionItems.map(j => {
      const paid = paymentMap[j.id] || 0;
      const tot = computeJobTotal(j);
      const remaining = Math.max(0, tot - Math.min(paid, tot));
      const hoursOld = (now - j.end) / 3600000;
      return { ...j, paid: Math.min(paid, tot), remaining, hoursOld };
    }).sort((a, b) => b.hoursOld - a.hoursOld);
  }, [attentionItems, paymentMap, now]);

  const owingTotal = useMemo(() => owingJobs.filter(j => j.status === 'Completed').reduce((sum, j) => sum + j.remaining, 0), [owingJobs]);

  const collectedThisWeek = useMemo(() => {
    return allWeekJobs.reduce((s, j) => {
      const tot = computeJobTotal(j);
      if (j.payment_status === 'Paid') return s + tot;
      if (j.payment_status === 'Partial') return s + Math.min(paymentMap[j.id] || 0, tot);
      return s;
    }, 0);
  }, [allWeekJobs, paymentMap]);

  const weekOwed = useMemo(() => {
    return allWeekJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid')
      .reduce((s, j) => {
        const tot = computeJobTotal(j);
        const paid = paymentMap[j.id] || 0;
        return s + Math.max(0, tot - Math.min(paid, tot));
      }, 0);
  }, [allWeekJobs, paymentMap]);

  const weekUpcoming = useMemo(() => {
    return allWeekJobs
      .filter(j => j.status === 'Scheduled')
      .reduce((s, j) => s + computeJobTotal(j), 0);
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
  const windowJobIdRef = useRef(null);
  const lastFetchTimeRef = useRef(0);

  // Which job is currently in its scheduled time window (time-based, no clock-in needed)
  const currentWindowJobId = useMemo(
    () => todayJobs.find(j => now >= j.start && now < j.end && j.status === 'Scheduled')?.id ?? null,
    [todayJobs, now]
  );

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
      const driveText =
        locationDrives[next?.id]?.duration ||
        next?.raw?.ai_context?.drive_to?.duration ||
        null;
      const brief = generateCommandBrief(next, business, driveText ? { driveText } : {});
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
        updateDailyRoutes(todayJobs);
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

  // Re-fetch GPS drives when a job enters its time window — no button needed.
  // Fires within 1 min of job start; assumes Sandra is at/near the job site.
  useEffect(() => {
    if (currentWindowJobId && currentWindowJobId !== windowJobIdRef.current) {
      windowJobIdRef.current = currentWindowJobId;
      fetchLocationDrives();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWindowJobId]);

  const [locationDrives, setLocationDrives] = useState({});
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() =>
    localStorage.getItem('notif-banner-dismissed') === 'true'
  );

  // Schedule leave-time notifications whenever jobs or drive times update
  useEffect(() => {
    if (notifPermission !== 'granted') return;
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return;

    const now = Date.now();
    const jobs = todayJobs
      .filter(j => j.status === 'Scheduled')
      .flatMap(j => {
        const driveValue =
          locationDrives[j.id]?.durationValue ??
          j.raw?.ai_context?.drive_to?.durationValue;
        if (!driveValue) return [];
        const fireAt = j.start.getTime() - driveValue * 1000 - 15 * 60 * 1000;
        if (fireAt <= now) return [];
        const driveMins = Math.round(driveValue / 60);
        return [{
          id: j.id,
          clientName: j.client_name || 'your client',
          fireAt,
          body: `${driveMins} min drive · job at ${j.start.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' })}`,
        }];
      });

    sw.postMessage({ type: 'SCHEDULE_LEAVE_NOTIFICATIONS', jobs });
  }, [todayJobs, locationDrives, notifPermission]);

  const openJob = detailSheet?.openJob;
  const openPostJob = postJobSheet?.openPostJob;
  const openDetail = financeSheet?.open;

  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);
  const [isGoLaunching, setIsGoLaunching] = useState(false);
  const [isFlyingIcon, setIsFlyingIcon] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [costModalJob, setCostModalJob] = useState(null);
  const [costAmount, setCostAmount] = useState('');
  const [costDesc, setCostDesc] = useState('');
  const [costErr, setCostErr] = useState(null);
  const [costSaving, setCostSaving] = useState(false);
  const [costFieldFocus, setCostFieldFocus] = useState(null);

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
    // Same-tab navigation (not window.open) — immune to popup/"tab-under" blocking
    // that browsers apply to a blank window redirected after a delay. iOS/Android
    // universal-link interception still fires on a plain location.href navigation.
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
      const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(next.address)}&travelmode=driving&avoid=tolls`;
      window.location.href = url;
      setIsGoLaunching(false);
    }, 1100);
    setTimeout(() => setIsFlyingIcon(false), 1450);
  };

  const handleRefreshTraffic = async (e) => {
    e.stopPropagation();
    setIsRefreshingTraffic(true);
    try {
      await updateDailyRoutes(todayJobs);
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
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 90000 })
      );
      const origin = `${position.coords.latitude},${position.coords.longitude}`;
      setLastKnownOrigin(origin);
      const destinations = targets.map(j => j.address).join('|');
      const res = await fetch(`/api/maps?type=distance&origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinations)}&departure_time=now&avoid=tolls`);
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
      lastFetchTimeRef.current = Date.now();
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
      toast.error("Could not add time.");
    }
  };

  const openAddCost = (job) => {
    setCostModalJob(job);
    setCostAmount('');
    setCostDesc('');
    setCostErr(null);
  };

  const closeAddCost = () => {
    setCostModalJob(null);
    setCostAmount('');
    setCostDesc('');
    setCostErr(null);
  };

  const handleSaveQuickCost = async () => {
    const amt = parseFloat(costAmount);
    if (!amt || amt <= 0) { setCostErr('Enter a valid amount.'); return; }
    const job = costModalJob;
    const currentCosts = Array.isArray(job.additional_costs_json) ? job.additional_costs_json : [];
    const newCosts = [...currentCosts, { amount: amt, description: costDesc.trim() || 'Extra cost' }];

    setCostSaving(true);
    setCostErr(null);
    try {
      await updateJob(job.id, { additional_costs_json: newCosts });
      notifyDataChanged();
      toast.success('Cost added.');
      closeAddCost();
    } catch (e) {
      setCostErr(e.message || 'Could not add cost.');
    } finally {
      setCostSaving(false);
    }
  };

  // Safety check for context
  if (!themeCtx || !jobsCtx || !authCtx) {
    return <div style={{ padding: 20, color: 'white' }}>Initializing context...</div>;
  }

  if (jobsError && !allJobs) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
        <OfflineMessage onRetry={refetchJobs} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #FC4693' : 'none', 
        padding: '13px 15px 15px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ flex: 1 }}>
            <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.ink, marginBottom: 8 }}>
              Today · {dateBrief(today)}
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

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => openDetail(
                'This Week',
                allWeekJobs.map(j => ({ ...j, total: computeJobTotal(j) })),
                'jobs'
              )}
              aria-label="View this week's jobs"
              style={{ cursor: 'pointer', padding: '4px 0', background: 'none', border: 'none', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
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
                {privacyOn ? '•••' : `$${Math.round(displayRevenue).toLocaleString('en-CA')}`}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>
                This Week
              </div>
              {/* Fixed-height slot (not conditionally-rendered) so "See full schedule"
                  below doesn't reflow up/down as this line appears/disappears
                  (Joel, 2026-07-15). */}
              <div style={{ minHeight: 16, marginTop: 3 }}>
                {displayRevenue > 0 && collectedThisWeek > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', letterSpacing: '0.3px' }}>
                    {privacyOn ? '•••' : (
                      collectedThisWeek >= displayRevenue
                        ? '✓ all collected'
                        : `$${Math.round(collectedThisWeek).toLocaleString('en-CA')} collected`
                    )}
                  </div>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/calendar')}
              aria-label="See full schedule"
              style={{
                cursor: 'pointer',
                marginTop: 4,
                padding: '4px 0',
                background: 'none',
                border: 'none',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.3px',
                color: mode === 'dark' ? 'rgba(255,255,255,0.55)' : T.inkMuted,
              }}
            >
              See full schedule →
            </button>
          </div>
        </div>

        {monthlyGoal && !privacyOn && (
          <div style={{ marginTop: 10, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Monthly goal
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}>
                ${Math.round(monthlyRevenue).toLocaleString('en-CA')} / ${Math.round(monthlyGoal).toLocaleString('en-CA')}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (monthlyRevenue / monthlyGoal) * 100).toFixed(1)}%`,
                background: monthlyRevenue >= monthlyGoal
                  ? 'linear-gradient(90deg, #16A34A, #22C55E)'
                  : `linear-gradient(90deg, ${T.pink}, #FF78B0)`,
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

        {/* Loading skeleton — shown while initial data fetch is in flight */}
        {loading && !allJobs && (
          <div>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 16, padding: '14px', marginBottom: 8,
                opacity: 1 - i * 0.2,
              }}>
                <div style={{ height: 12, borderRadius: 6, background: T.cardBorder, width: '55%', marginBottom: 10 }} />
                <div style={{ height: 10, borderRadius: 5, background: T.cardBorder, width: '35%' }} />
              </div>
            ))}
          </div>
        )}

        {/* Notification permission banner — shown once until dismissed */}
        {notifPermission === 'default' && !notifBannerDismissed && (
          <div style={{
            background: T.card, border: `1.5px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: `600 13px/1.2 ${T.font}`, color: T.ink }}>Leave-time reminders</div>
              <div style={{ font: `12px/1.4 ${T.font}`, color: T.inkSub, marginTop: 2 }}>Get notified 15 mins before you need to leave for each job.</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const result = await Notification.requestPermission();
                setNotifPermission(result);
                if (result !== 'granted') {
                  localStorage.setItem('notif-banner-dismissed', 'true');
                  setNotifBannerDismissed(true);
                }
              }}
              style={{
                background: T.pink, color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 12px',
                font: `600 12px/1 ${T.font}`, cursor: 'pointer', whiteSpace: 'nowrap',
                minHeight: 44,
              }}
            >Enable</button>
            <button
              type="button"
              aria-label="Dismiss notification reminder"
              onClick={() => {
                localStorage.setItem('notif-banner-dismissed', 'true');
                setNotifBannerDismissed(true);
              }}
              style={{
                background: 'transparent', border: 'none', color: T.inkMuted,
                fontSize: 18, cursor: 'pointer', lineHeight: 1,
                minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        )}

        {/* TODAY — Active Job */}
        {activeJob ? (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel color={T.pink}>Happening now</SectionLabel>
            <div style={{
              background: mode === 'dark' ? '#0D0D0D' : 'white',
              border: `2px solid ${T.pink}`,
              borderRadius: 18,
              padding: '16px',
              boxShadow: `0 4px 8px ${T.pinkGlow}`,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="sm-pulse" style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: T.pink }} />

              <div onClick={() => openJob(activeJob.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Title style={{ fontSize: 19, color: T.ink }}>{activeJob.client_name}</Title>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{fmtTime12(activeJob.start).time}</Text>
                    <Caption style={{ fontWeight: 700, color: T.inkMuted }}>{fmtTime12(activeJob.start).period}</Caption>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: T.pinkTint, color: T.pink, textTransform: 'uppercase' }}>{activeJob.service_name || 'General Service'}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.inkMuted }}>{activeJob.estimated_hours}h</span>
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
                const urgentColor = leaveBy?.urgent ? T.errorFg : isTight ? T.amberFg : T.greenFg;
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
                            <div style={{ fontSize: 11, fontWeight: 700, color: urgentColor }}>{leaveBy.text}</div>
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
                <button type="button" onClick={(e) => { e.stopPropagation(); handleAddTime(activeJob); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+30 MIN</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); openAddCost(activeJob); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+COST</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); openPostJob(activeJob.id); }} style={{ flex: 2, padding: '10px', borderRadius: 10, background: T.pink, color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>WRAP UP</button>
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
                    <SectionLabel style={{ color: DEEP_ROSE, margin: 0 }}>Next up</SectionLabel>
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
                      border: `2px solid ${DEEP_ROSE}`,
                      borderRadius: 18,
                      padding: '18px 18px 14px',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: `0 4px 8px ${DEEP_ROSE_GLOW}`,
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
                      const timingColor = isNowWindow ? '#FC4693' : minsToStart <= 15 ? T.errorFg : minsToStart <= 60 ? T.amberFg : T.greenFg;
                      const timingLabel = isNowWindow ? '🔴 Happening now' : minsToStart > 0 ? `Starts in ${fmtDuration(minsToStart)}` : null;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, position: 'relative' }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, lineHeight: 1.2, letterSpacing: '-0.4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
                                <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 3 }}>{getWorkerLabel(business, next.assignee_type)}: {next.worker_name}</div>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontSize: 17, fontWeight: 700, color: DEEP_ROSE, fontFamily: T.font, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                                {timeRange}
                              </div>
                              {timingLabel && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: timingColor, marginTop: 4, whiteSpace: 'nowrap' }}>
                                  {timingLabel}
                                </div>
                              )}
                              {!privacyOn && computeJobTotal(next) > 0 && (
                                <div style={{ fontSize: 11, fontWeight: 600, color: DEEP_ROSE, opacity: 0.65, marginTop: 4, whiteSpace: 'nowrap' }}>
                                  ${computeJobTotal(next).toFixed(0)}
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
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={!isGoLaunching ? handleSupermomGo : undefined}
                              onKeyDown={(e) => { if (!isGoLaunching && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleSupermomGo(e); } }}
                              aria-disabled={isGoLaunching}
                              className={isUrgent && !isGoLaunching ? 'go-btn-urgent' : ''}
                              style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: 12,
                                background: isGoLaunching
                                  ? 'linear-gradient(90deg,#8B0E3F,#FC4693,#FF78B0)'
                                  : `linear-gradient(90deg,${DEEP_ROSE},#FC4693)`,
                                color: 'white',
                                cursor: isGoLaunching ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                transition: 'background 0.3s, transform 0.15s',
                                transform: isGoLaunching ? 'scale(0.97)' : 'scale(1)',
                                boxShadow: isGoLaunching ? 'none' : '0 4px 16px rgba(233,30,106,0.35)',
                                overflow: 'visible',
                                userSelect: 'none',
                              }}
                            >
                              <img
                                src="/branding/supermom_icon_transparent.png"
                                className={`sm-hero-icon${isFlyingIcon ? ' launching' : ''}`}
                                style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
                                alt=""
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', transition: 'opacity 0.2s', opacity: isGoLaunching ? 0.7 : 1 }}>
                                  {isGoLaunching ? 'On my way…' : driveLabel}
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
                                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 13, padding: '10px 12px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: locationLoading ? 0.4 : 1, flexShrink: 0 }}
                                  title="Refresh location"
                                >
                                  {locationLoading ? '…' : '↻'}
                                </button>
                              )}
                            </div>
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
            <SectionLabel color={T.pink} style={{ marginBottom: 8 }}>Coming up today</SectionLabel>
            {todayUpcoming.map(j => {
              const locDrive = locationDrives[j.id];
              const leaveBy = locDrive ? formatLeaveBy(locDrive.durationValue, j.start, now) : null;
              return (
                <div key={j.id}>
                  <Swipeable onAction={() => openPostJob(j.id)} actionLabel="Wrap up" actionColor="#16A34A">
                    <UpcomingCard
                      job={j}
                      T={T}
                      onClick={() => openJob(j.id)}
                      total={computeJobTotal(j)}
                      grandTotal={computeJobTotal(j)}
                      paid={paymentMap[j.id] || 0}
                      privacyOn={privacyOn}
                    />
                  </Swipeable>
                  {leaveBy && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: -4, marginBottom: 8, paddingLeft: 16 }}>
                      <span style={{ fontSize: 10 }}>{leaveBy.urgent ? '⚠️' : '🚗'}</span>
                      <span style={{ fontSize: 10, fontWeight: leaveBy.urgent ? 800 : 600, color: leaveBy.urgent ? T.errorFg : T.inkMuted }}>
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

        {/* NEEDS ATTENTION — wrap-up jobs and outstanding payment jobs. Rendered
            ahead of "Rest of this week" (Joel's call, 2026-07-15) — money owed
            and jobs needing wrap-up shouldn't get buried under future scheduling. */}
        {owingJobs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', marginBottom: 8 }}>
              <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: DEEP_ROSE }}>
                Needs attention
              </div>
              {!privacyOn && owingTotal > 0 && (
                <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 600, color: DEEP_ROSE, opacity: 0.65 }}>
                  ${owingTotal.toFixed(0)} outstanding
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {owingJobs.map((j) => {
                const isWrapUp = j.status !== 'Completed';
                const isPartial = j.status === 'Completed' && j.payment_status === 'Partial';
                const isStale = j.hoursOld >= 48;
                const variant = isWrapUp ? 'wrap-up' : isPartial ? 'partial' : isStale ? 'unpaid-stale' : 'unpaid-fresh';
                const VSTYLES = {
                  'wrap-up':      { ...T.status.attention, label: 'WRAP UP' },
                  'unpaid-fresh': { ...T.status.unpaid,    label: 'UNPAID' },
                  'unpaid-stale': { ...T.status.overdue,   label: 'UNPAID' },
                  'partial':      { ...T.status.partial,   label: 'PARTIAL PAID' },
                }[variant];

                // Bold solid fill for unpaid/overdue/partial — switch body text to white for contrast
                const isBold = !isWrapUp;
                const cardNameColor = isBold ? VSTYLES.fg : T.ink;
                const cardSubColor = isBold ? 'rgba(255,255,255,0.85)' : T.inkSub;
                const cardMutedColor = isBold ? 'rgba(255,255,255,0.75)' : T.inkMuted;
                const cardAccentColor = isBold ? VSTYLES.fg : VSTYLES.text;

                const h = j.hoursOld;
                const recencyText = isWrapUp
                  ? (h < 1 ? 'just now' : h < 24 ? `${Math.floor(h)}h overdue` : `${Math.floor(h / 24)}d overdue`)
                  : (h < 1 ? 'moments ago' : h < 24 ? `${Math.floor(h)}h ago` : `${Math.floor(h / 24)}d ago`);

                const dateStr = j.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const fmtTime = (d) => {
                  const hh = d.getHours(); const mm = d.getMinutes();
                  const ap = hh >= 12 ? 'pm' : 'am'; const h12 = hh % 12 || 12;
                  return mm > 0 ? `${h12}:${String(mm).padStart(2, '0')}${ap}` : `${h12}${ap}`;
                };
                const timeRange = `${fmtTime(j.start)}–${fmtTime(j.end)}`;

                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => openJob(j.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: VSTYLES.bg,
                      border: `1px solid ${VSTYLES.border}66`,
                      borderLeft: `4px solid ${VSTYLES.border}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', background: VSTYLES.pill, color: VSTYLES.text, padding: '2px 6px', borderRadius: 4 }}>
                        {VSTYLES.label}
                      </span>
                      {isWrapUp ? (
                        <span style={{ fontFamily: T.font, fontSize: 11, color: VSTYLES.text, opacity: 0.8 }}>Tap to wrap up →</span>
                      ) : (
                        <span style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 700, color: cardAccentColor, fontVariantNumeric: 'tabular-nums' }}>
                          {privacyOn ? '•••' : `$${j.remaining.toFixed(0)} owing`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: cardNameColor, letterSpacing: '-0.3px', marginBottom: 2 }}>
                      {j.client_name}
                    </div>
                    {j.service_name && (
                      <div style={{ fontFamily: T.font, fontSize: 12, color: cardSubColor, marginBottom: 4 }}>
                        {j.service_name}
                      </div>
                    )}
                    {isPartial && !privacyOn && (
                      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, color: cardAccentColor, marginBottom: 4 }}>
                        ${j.paid.toFixed(0)} paid already
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: T.font, fontSize: 11, color: cardMutedColor }}>{dateStr} · {timeRange}</span>
                      <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, color: cardAccentColor }}>{recencyText}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* REST OF THIS WEEK — upcoming scheduled jobs */}
        {restOfWeekJobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel style={{ color: T.inkSub, marginBottom: 8 }}>REST OF THIS WEEK</SectionLabel>
            {restOfWeekJobs.map(j => (
              <JobCard
                key={j.id}
                job={j}
                T={T}
                onClick={() => openJob(j.id)}
                paid={paymentMap[j.id] || 0}
                total={computeJobTotal(j)}
                grandTotal={computeJobTotal(j)}
                privacyOn={privacyOn}
              />
            ))}
          </div>
        )}

        {/* NEXT WEEK PREVIEW — shown from Friday onward */}
        {nextWeekJobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel style={{ color: T.inkMuted, marginBottom: 8 }}>COMING UP NEXT WEEK</SectionLabel>
            {nextWeekJobs.map(j => (
              <JobCard
                key={j.id}
                job={j}
                T={T}
                onClick={() => openJob(j.id)}
                paid={paymentMap[j.id] || 0}
                total={computeJobTotal(j)}
                grandTotal={computeJobTotal(j)}
                privacyOn={privacyOn}
              />
            ))}
          </div>
        )}

        {/* DONE THIS WEEK */}
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
                total={computeJobTotal(j)}
                grandTotal={computeJobTotal(j)}
                privacyOn={privacyOn}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeJob && !next && todayUpcoming.length === 0 && attentionItems.length === 0 && restOfWeekJobs.length === 0 && completedPaidThisWeek.length === 0 && nextWeekJobs.length === 0 && (
          <EmptyState allDone={allDone} T={T} persona={persona} />
        )}

      </div>

      <div style={{ height: isKeyboardFocused ? 80 : 0 }} />

      {costModalJob && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add a cost"
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={closeAddCost}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: T.bg, color: T.ink,
              borderRadius: '20px 20px 0 0',
              border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
              padding: '20px 18px 28px',
            }}
          >
            <div style={{ width: 40, height: 4, background: T.cardBorder, borderRadius: 4, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>Add a cost</div>
            <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.ink, marginBottom: 16 }}>
              What did you spend on {costModalJob.client_name || 'this job'}?
            </div>

            <label htmlFor="qc-amount" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, border: `1.5px solid ${costFieldFocus === 'amount' ? T.pink : T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, transition: 'border-color 0.15s' }}>
              <span style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.inkSub }}>$</span>
              <input
                id="qc-amount"
                type="number"
                autoFocus
                value={costAmount}
                onChange={e => setCostAmount(e.target.value)}
                onFocus={e => { e.target.select(); setCostFieldFocus('amount'); }}
                onBlur={() => setCostFieldFocus(null)}
                placeholder="0"
                min="0"
                step="0.01"
                inputMode="decimal"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>

            <label htmlFor="qc-desc" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>What for</label>
            <div style={{ background: T.card, border: `1.5px solid ${costFieldFocus === 'desc' ? T.pink : T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: costErr ? 10 : 18, transition: 'border-color 0.15s' }}>
              <input
                id="qc-desc"
                type="text"
                value={costDesc}
                onChange={e => setCostDesc(e.target.value)}
                onFocus={() => setCostFieldFocus('desc')}
                onBlur={() => setCostFieldFocus(null)}
                placeholder="Supplies"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.font, fontSize: 13, color: T.ink }}
              />
            </div>

            {costErr && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 11.5, color: T.errorFg, marginBottom: 14 }}>
                {costErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeAddCost} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveQuickCost} disabled={costSaving} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: costSaving ? '#F9C5DB' : T.pink, color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: costSaving ? 'default' : 'pointer' }}>
                {costSaving ? 'Adding…' : 'Add cost'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

