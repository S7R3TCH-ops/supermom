import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
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
import { getPersistentDailyMessage, getTimeBasedGreeting } from '../lib/greetings';
import { softDeleteJob, updateJob } from '../data/jobsRepo';
import { useGeofence } from '../context/GeofenceContext';
import { EmptyActivity, NoResults } from '../components/ui/Illustrations';
import { useKeyboardFocus } from '../hooks/useKeyboardFocus';
import Swipeable from '../components/ui/Swipeable';
import WeekStrip from '../components/ui/WeekStrip';

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * Returns an array of 7 Date objects representing the Monday-Sunday week containing the given date.
 */
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  // Monday is day 1. If day is 0 (Sun), we need to go back 6 days.
  // Otherwise, we go back (day - 1) days.
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const mon = new Date(d.setDate(diff));
  mon.setHours(0,0,0,0);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

function getWeekLabel(weekDays) {
  const first = weekDays[0];
  const last = weekDays[6];
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString('en-US', { month: 'long' })} ${first.getDate()}–${last.getDate()}`;
  }
  return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function fmtTime12(d) {
  const h = d.getHours(), m = d.getMinutes();
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return { time: m === 0 ? `${hh}:00` : `${hh}:${m.toString().padStart(2,'0')}`, period: ap };
}

function fmtTimeRange(start, end) {
  const s = fmtTime12(start);
  const e = fmtTime12(end);
  return s.period === e.period
    ? `${s.time} – ${e.time} ${e.period}`
    : `${s.time} ${s.period} – ${e.time} ${e.period}`;
}

function dateBrief(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function computeTotal(j) {
  // toDisplayJob strips raw fields — always read from j.raw when available
  // flat_rate stores the $/hr rate for Hourly jobs (NewJobSheet never writes hourly_rate)
  const src = j.raw || j;
  let base = 0;

  if (src.pricing_type === 'Hourly') {
    const rate = Number(src.hourly_rate || src.flat_rate || 0);
    const hours = Number(src.actual_duration || src.estimated_hours || 0);
    base = (rate > 0 && hours > 0) ? rate * hours : Number(src.total_amount || 0);
  } else {
    base = Number(src.total_amount || src.flat_rate || 0);
  }

  return base + Number(src.additional_cost || 0) + Number(src.hst_amount || 0);
}

function renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor }) {
  const src = j.raw || j;
  const remaining = Math.max(0, total - (paid || 0));
  if (remaining === 0) return null;

  if (privacyOn) {
    return (
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        {(paid || 0) > 0 && (
          <>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>••• paid</span>
            <span style={{ color: metaColor, opacity: 0.4, fontSize: 12 }}>·</span>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 800, color: T.pink, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>••• owing</span>
      </div>
    );
  }

  const isHourly = src.pricing_type === 'Hourly';
  const rate = Number(src.hourly_rate || src.flat_rate || 0);
  const hours = Number(src.actual_duration || src.estimated_hours || 0);
  const additionalCost = Number(src.additional_cost || 0);
  const hst = Number(src.hst_amount || 0);

  const mathParts = [];
  if (isHourly && rate > 0 && hours > 0) {
    mathParts.push(`$${rate.toFixed(0)}/hr x ${hours}h`);
  } else {
    mathParts.push('Flat rate');
  }
  if (additionalCost > 0) mathParts.push(`+ $${additionalCost.toFixed(0)} costs`);
  if (hst > 0) mathParts.push(`+ $${hst.toFixed(0)} HST`);
  mathParts.push(`= $${total.toFixed(0)}`);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: metaColor, opacity: 0.8, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
        {mathParts.join(' ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(paid || 0) > 0 && (
          <>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>
              ${paid.toFixed(0)} paid
            </span>
            <span style={{ color: metaColor, opacity: 0.4, fontSize: 12 }}>·</span>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 800, color: T.pink, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>
          ${remaining.toFixed(0)} owing
        </span>
      </div>
    </div>
  );
}


function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

  const urgencyColor = isUnpaid ? '#F59E0B' : isCompleted ? '#16A34A' : T.pink;
  const urgencyBg = isUnpaid ? 'rgba(245,158,11,0.12)' : isCompleted ? 'rgba(22,163,74,0.08)' : T.pinkGlow;
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isCompleted ? 'PAID ✓' : 'SCHEDULED';

  const remaining = isPaid ? 0 : Math.max(0, total - paid);
  const showPaymentInfo = isCompleted || total > 0;
  const metaColor = T.inkSub || '#795548';
  const timeRange = fmtTimeRange(j.start, j.end);
  const dateLabel = dateBrief(j.start);

  if (isCompleted) {
    // ── Compact completed card ─────────────────────────────────────────
    return (
      <div
        onClick={onClick}
        style={{
          background: urgencyBg,
          border: `1.5px solid ${urgencyColor}`,
          borderLeft: `5px solid ${urgencyColor}`,
          borderRadius: 14,
          marginBottom: 9,
          cursor: 'pointer',
          padding: '10px 14px',
        }}
      >
        {/* Row 1: client name + amount · STATUS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontFamily: T.serif,
            fontSize: 17,
            fontWeight: 600,
            color: T.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.3px',
            flex: 1,
          }}>
            {j.client_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {showPaymentInfo && !privacyOn && total > 0 && (
              <span style={{
                fontFamily: T.serif,
                fontSize: 14,
                fontWeight: 600,
                color: urgencyColor,
                letterSpacing: '-0.3px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${total.toFixed(0)}
              </span>
            )}
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: urgencyColor,
              textTransform: 'uppercase',
              background: `${urgencyColor}22`,
              padding: '3px 8px',
              borderRadius: 5,
              letterSpacing: '0.3px',
            }}>
              {statusLabel}
            </span>
            {onDuplicate && (
              <button
                onClick={e => { e.stopPropagation(); onDuplicate(j); }}
                style={{ background: 'none', border: 'none', padding: '0 2px', color: urgencyColor, fontSize: 14, fontWeight: 900, cursor: 'pointer', lineHeight: 1, opacity: 0.7 }}
                title="Rebook this job"
              >
                ↻
              </button>
            )}
          </div>
        </div>

        {/* Row 2: date · time inline, service */}
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: metaColor }}>
            {dateLabel} · {timeRange}
          </span>
          <span style={{ fontSize: 10, color: metaColor, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: urgencyColor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {j.service_name}
          </span>
        </div>

        {/* Row 3: color-coded payment breakdown */}
        {remaining > 0 && renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor })}
      </div>
    );
  }

  // ── Scheduled / upcoming card (full layout with time header) ──────────
  return (
    <div
      onClick={onClick}
      style={{
        background: urgencyBg,
        border: `2px solid ${urgencyColor}`,
        borderLeft: `6px solid ${urgencyColor}`,
        borderRadius: 16,
        marginBottom: 12,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Time header — full width, top of card */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${urgencyColor}30`,
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 22,
          fontWeight: 900,
          color: urgencyColor,
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          {timeRange}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: urgencyColor,
          textTransform: 'uppercase',
          background: `${urgencyColor}22`,
          padding: '4px 9px',
          borderRadius: 6,
          letterSpacing: '0.4px',
        }}>
          {statusLabel}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 16px 12px' }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.4px', marginBottom: 1 }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: metaColor, marginBottom: 4 }}>
          {dateLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: urgencyColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          {j.service_name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: metaColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span>Est: {j.raw?.estimated_hours || 0}h</span>
          {showPaymentInfo && remaining === 0 && total > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ color: paid > 0 ? '#16A34A' : urgencyColor, fontVariantNumeric: 'tabular-nums' }}>
                {privacyOn ? '•••' : paid > 0 ? `$${total.toFixed(0)} pre-paid` : `$${total.toFixed(0)} total`}
              </span>
            </>
          )}
        </div>
        {showPaymentInfo && remaining > 0 && renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor })}
        {j.job_notes ? (
          <div style={{
            fontSize: 11,
            color: metaColor,
            fontStyle: 'italic',
            marginTop: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}>
            {j.job_notes}
          </div>
        ) : null}
        {j.address && (
          <div style={{ fontSize: 11, color: metaColor, marginTop: 4, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {j.address}
          </div>
        )}
      </div>
    </div>
  );
}

const EmptyState = ({ allDone, T, persona }) => {
  const messages = {
    casual: {
      allDone: "Nice work, you're all set!",
      notDone: "Nothing on the list today. Chill time?"
    },
    professional: {
      allDone: "Mission Accomplished!",
      notDone: "Schedule clear."
    },
    coach: {
      allDone: "Solid hustle today!",
      notDone: "The board is clean. Time to recharge!"
    }
  };

  const style = persona?.toLowerCase() || 'professional';
  const msgSet = messages[style] || messages.professional;
  const msg = allDone ? msgSet.allDone : msgSet.notDone;

  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.9 }}>
      <EmptyActivity size={100} />
      <div style={{ marginTop: 16, fontFamily: T.font, fontSize: 13, color: T.inkMuted }}>{msg}</div>
    </div>
  );
};

function UpcomingCard({ job: j, T, onClick, total = 0, privacyOn = false }) {
  const BLUE = '#1565C0';
  const timeRange = fmtTimeRange(j.start, j.end);
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(21,101,192,0.07)',
        border: `2px solid ${BLUE}`,
        borderLeft: `6px solid ${BLUE}`,
        borderRadius: 14,
        marginBottom: 10,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Time header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '9px 14px 7px',
        borderBottom: `1px solid ${BLUE}25`,
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: BLUE, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {timeRange}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: BLUE, textTransform: 'uppercase', background: `${BLUE}18`, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.4px' }}>
          UPCOMING
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 14px 10px' }}>
        <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: BLUE, opacity: 0.7, marginBottom: 3 }}>
          {dateBrief(j.start)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {j.service_name}
          </div>
          {total > 0 && (
            <>
              <span style={{ fontSize: 10, color: BLUE, opacity: 0.4 }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>
                {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              </span>
            </>
          )}
        </div>
        {j.job_notes ? (
          <div style={{
            fontSize: 11,
            color: BLUE,
            opacity: 0.7,
            fontStyle: 'italic',
            marginTop: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}>
            {j.job_notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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

  const [runtimeError] = useState(null);

  // Use a stable reference for "today"
  const [today] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [weekStart, setWeekStart] = useState(() => getWeekRange(today)[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

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
  
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekJobs = useMemo(() => {
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
        return weekDays.some(d => sameDay(j.start, d));
      })
      .sort((a, b) => a.start - b.start);
  }, [allJobs, weekDays]);

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

  const selectedDateJobs = useMemo(() => {
    if (!allJobs || !selectedDate) return [];
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

  const allDone = todayJobs.length > 0 && !todayJobs.some(j => j.status === 'Scheduled' || j.payment_status !== 'Paid');

  const timeBasedGreeting = useMemo(() => {
    try {
      return getTimeBasedGreeting(firstName, persona, !allDone);
    } catch {
      return `Hello, ${firstName}!`;
    }
  }, [firstName, persona, allDone]);

  const isSelectedToday = sameDay(selectedDate, today);

  const displayRevenue = useMemo(() => {
    const jobs = isSelectedToday ? todayJobs : selectedDate ? selectedDateJobs : weekJobs;
    return jobs.reduce((s, j) => s + computeTotal(j), 0);
  }, [isSelectedToday, selectedDate, todayJobs, selectedDateJobs, weekJobs]);

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

  const briefingMsg = useMemo(() => {
    if (!isSelectedToday) return `${selectedDateJobs.length} jobs scheduled`;
    
    if (allDone) {
      return "Mission accomplished. Time to go be fabulous somewhere else!";
    }
    
    if (activeJob) {
      const remainingCount = todayJobs.filter(j => j.status === 'Scheduled' && j.id !== activeJob.id).length;
      return `In the zone! ${remainingCount > 0 ? `${remainingCount} more boss moves` : 'Almost done'} for today.`;
    }
    
    if (next) {
      const minsToStart = Math.round((next.start - now) / 60000);
      const jobsRemaining = todayJobs.filter(j => j.status === 'Scheduled' && j.payment_status !== 'Paid').length;
      const countStr = jobsRemaining > 1 ? ` (${jobsRemaining - 1} more to go)` : '';
      
      if (minsToStart <= 0) return `Suit up! Your next mission is starting now.${countStr}`;
      if (minsToStart < 60) return `T-minus ${minsToStart} mins until you save the day again.${countStr}`;
      
      const timeStr = fmtTime12(next.start);
      return `Deep breaths. Next mission at ${timeStr.time}${timeStr.period}.${countStr}`;
    }
    
    if (attentionItems.length > 0) {
      return `${attentionItems.length} job${attentionItems.length > 1 ? 's are' : ' is'} giving you the side-eye. Time to wrap up!`;
    }
    
    try {
      return getPersistentDailyMessage('briefing', persona);
    } catch {
      return "Ready for the day.";
    }
  }, [isSelectedToday, selectedDateJobs.length, allDone, activeJob, next, now, todayJobs, attentionItems.length, persona]);

  const staleAttentionItems = useMemo(() => {
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return attentionItems.filter(j => j.end < cutoff);
  }, [attentionItems, now]);

  const completedPaidThisWeek = useMemo(() => {
    return weekJobs
      .filter(j => j.status === 'Completed' && j.payment_status === 'Paid')
      .sort((a, b) => b.start - a.start);
  }, [weekJobs]);

  const [paymentMap, setPaymentMap] = useState({});
  useEffect(() => {
    const jobIds = [...new Set([
      ...weekJobs.map(j => j.id),
      ...todayJobs.map(j => j.id),
      ...attentionItems.map(j => j.id)
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
  }, [weekJobs, todayJobs, attentionItems]);

  const todayUpcoming = useMemo(() => {
    return todayJobs.filter(j =>
      j.id !== activeJob?.id &&
      j.id !== next?.id &&
      j.start >= now &&
      j.status === 'Scheduled'
    );
  }, [todayJobs, activeJob, next, now]);

  const attentionRef = useRef(null);

  const nextUpLabel = useMemo(() => {
    if (!selectedDate || isSelectedToday || !next) return null;
    return `Next Up Today: ${fmtTime12(next.start).time}${fmtTime12(next.start).period} @ ${next.client_name}`;
  }, [selectedDate, isSelectedToday, next]);

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await softDeleteJob(jobId);
      notifyDataChanged();
    } catch {
      alert('Could not delete job.');
    }
  };

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

  const handleWeekChange = useCallback((delta) => {
    setWeekStart(prev => addDays(prev, delta * 7));
  }, []);

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

  if (runtimeError) {
    return (
      <div style={{ padding: 24, color: '#E91E6A', background: '#0A0A0A', height: '100svh' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>✦ Critical Error</div>
        <div style={{ fontSize: 13, fontFamily: 'monospace', opacity: 0.8 }}>{runtimeError}</div>
      </div>
    );
  }

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
                <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 5 }}>
                  ✦ Command Brief · {dateBrief(selectedDate)}
                </SectionLabel>
                <Title style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.5px', color: mode === 'dark' ? 'white' : T.ink, lineHeight: 1.15, marginBottom: 4 }}>
                  {timeBasedGreeting}
                </Title>
                <Text style={{ fontSize: 14, color: T.inkSub, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isSelectedToday && (
                    <span style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      background: allDone ? '#16A34A' : (activeJob || (next && Math.round((next.start - now) / 60000) < 60)) ? '#F59E0B' : '#64748B',
                      flexShrink: 0
                    }} />
                  )}
                  {briefingMsg}
                </Text>
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
                    total={computeTotal(j)}
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
                  const total = computeTotal(j);
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
                              ? renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor: '#92400E' })
                              : <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>${total.toFixed(0)} total</span>
                            }
                          </div>
                        </div>
                        <button
                          onClick={() => openPostJob(j.id)}
                          style={{ background: '#F59E0B', color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}
                        >
                          {needsWrap ? 'WRAP UP' : remaining > 0 ? 'COLLECT' : 'PAY'}
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
                    paid={paymentMap[j.id]}
                    total={computeTotal(j)}
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
                    paid={paymentMap[j.id]}
                    total={computeTotal(j)}
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

function LiveTimer({ startTime }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime) return;
    
    const update = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = Math.max(0, now - start);
      
      const hh = Math.floor(diff / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      
      setElapsed(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace', letterSpacing: -1, margin: '8px 0 12px' }}>
      {elapsed}
    </div>
  );
}

function MissionIntel({ prepNote, T, theme }) {
  if (!prepNote) return null;
  return (
    <div style={{ 
      background: theme.bgSecondary || 'rgba(0,0,0,0.03)', 
      borderRadius: 12, 
      padding: '10px 12px', 
      borderLeft: `3px solid ${theme.accent || T.pink}`,
      marginBottom: 10
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: theme.accent || T.pink, flexShrink: 0 }}>✦ MISSION INTEL</span>
        <span style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.4, fontWeight: 500 }}>{prepNote}</span>
      </div>
    </div>
  );
}
