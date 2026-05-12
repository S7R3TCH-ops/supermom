import { useMemo, useEffect, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import { useJobs, useBusiness, notifyDataChanged } from '../data/useData';
import { useAuth } from '../context/AuthContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { usePostJobSheet } from '../context/PostJobSheetContext';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { stopSpeaking } from '../data/ai';
import { updateDailyRoutes } from '../lib/maps';
import { getPersistentDailyMessage, getTimeBasedGreeting } from '../lib/greetings';
import { softDeleteJob, updateJob } from '../data/jobsRepo';
import { useGeofence } from '../context/GeofenceContext';
import { EmptyActivity, NoResults } from '../components/ui/Illustrations';
import { useKeyboardFocus } from '../hooks/useKeyboardFocus';
import Swipeable from '../components/ui/Swipeable';

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

function dateBrief(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function JobCard({ job: j, T, onClick }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isUnpaid = isCompleted && !isPaid;
  const startTime = fmtTime12(j.start);
  const endTime = fmtTime12(j.end);

  const urgencyColor = isUnpaid ? '#F59E0B' : isCompleted ? '#22C55E' : '#3B82F6';
  const urgencyBg = isUnpaid ? 'rgba(245,158,11,0.08)' : isCompleted ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)';
  const statusLabel = isUnpaid ? 'UNPAID' : isCompleted ? 'PAID ✓' : 'SCHEDULED';

  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1.5px solid ${urgencyColor}`,
        borderLeft: `5px solid ${urgencyColor}`,
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 10,
        cursor: 'pointer',
        backgroundColor: urgencyBg,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{j.client_name}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: urgencyColor }}>{j.service_name}</div>
          <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 4 }}>
            {isCompleted ? 'Actual' : 'Est'}: {isCompleted ? (j.actual_duration || j.estimated_hours || 0) : (j.estimated_hours || 0)}h
            {j.address && <span> · 📍{j.address.split(',')[0]}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.pink }}>
            {startTime.time}<span style={{ fontSize: 11 }}>{startTime.period}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted }}>–{endTime.time}<span style={{ fontSize: 10 }}>{endTime.period}</span></div>
          <div style={{ marginTop: 4, fontSize: 9, fontWeight: 800, color: urgencyColor, textTransform: 'uppercase', background: `${urgencyColor}20`, padding: '2px 6px', borderRadius: 4 }}>{statusLabel}</div>
        </div>
      </div>
    </div>
  );
}

const EmptyState = ({ allDone, T }) => {
  const msg = allDone ? "Mission Accomplished! You've cleared the board." : "Schedule clear. Time for a well-deserved break?";
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.9 }}>
      <EmptyActivity size={100} />
      <div style={{ marginTop: 16, fontFamily: T.font, fontSize: 13, color: T.inkMuted }}>{msg}</div>
    </div>
  );
};

export default function Home() {
  const themeCtx = useAppTheme();
  const jobsCtx = useJobs();
  const detailSheet = useJobDetailSheet();
  const postJobSheet = usePostJobSheet();
  const financeSheet = useFinanceDetailSheet();
  const authCtx = useAuth();
  const { handleClockOut } = useGeofence();
  const bizCtx = useBusiness();
  const isKeyboardFocused = useKeyboardFocus();

  const [runtimeError] = useState(null);

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

  const { T = {}, mode, privacyOn } = themeCtx || {};
  const { jobs: allJobs, loading } = jobsCtx || {};
  const { profile } = authCtx || {};
  const { business } = bizCtx || {};
  
  const persona = business?.ai_profile?.style || 'professional';
  
  const briefingMsg = useMemo(() => {
    try {
      return getPersistentDailyMessage('briefing', persona);
    } catch {
      return "Ready for the day.";
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

  const timeBasedGreeting = useMemo(() => {
    try {
      return getTimeBasedGreeting(firstName, persona, !allDone);
    } catch {
      return `Hello, ${firstName}!`;
    }
  }, [firstName, persona, allDone]);

  // Jobs for the remaining days of the week strip, grouped by day
  const futureWeekGroups = useMemo(() => {
    if (!allJobs) return [];
    const groups = [];
    weekDays.forEach(d => {
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

  const activeJob = todayJobs.find(j => j.status === 'Scheduled' && j.ai_context?.clock_in_time != null);

  const overdueScheduled = todayJobs.filter(j =>
    j.status === 'Scheduled' &&
    j.end <= now &&
    j.id !== activeJob?.id
  );

  const firstScheduled = todayJobs.find(j =>
    j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.end > now
  );
  const next = (activeJob && firstScheduled?.id === activeJob.id)
    ? todayJobs.find(j => j.status === 'Scheduled' && j.payment_status !== 'Paid' && j.id !== activeJob.id && j.end > now)
    : firstScheduled;
  
  const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);

  const isSelectedToday = sameDay(selectedDate, today);

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await softDeleteJob(jobId);
      notifyDataChanged();
    } catch {
      alert('Could not delete job.');
    }
  };

  const categorizedJobs = useMemo(() => {
    const incomplete = [];
    const upcoming = [];
    const done = [];
    const overdueIds = new Set(overdueScheduled.map(j => j.id));

    todayJobs.forEach(j => {
      if (j.id === activeJob?.id) return;
      if (j.id === next?.id) return;
      if (overdueIds.has(j.id)) return;

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
  }, [todayJobs, activeJob, next, overdueScheduled, now]);

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
      notifyDataChanged();
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
            <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 5 }}>
              ✦ Command Brief · {dateBrief(today)}
            </SectionLabel>
            <Title style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: mode === 'dark' ? 'white' : T.ink, lineHeight: 1.15, marginBottom: 4 }}>
              {timeBasedGreeting}
            </Title>
            <Text style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500 }}>
              {briefingMsg}
            </Text>
          </div>

          {!allDone && todayJobs.length > 0 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div 
                onClick={openDetail}
                style={{ cursor: 'pointer', padding: '4px 0' }}
              >
                <Text style={{ fontSize: 18, fontWeight: 600, color: mode === 'dark' ? 'white' : T.pink }}>
                  {privacyOn ? '•••' : `$${revenueToday.toFixed(0)}`}
                </Text>
                <Caption style={{ fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase' }}>Done</Caption>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {/* Week Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <button 
            onClick={() => setWeekOffset(w => w - 1)}
            style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, width: 30, height: 38, color: T.ink, cursor: 'pointer' }}
          >‹</button>
          
          <div className="sm-scroll" style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0' }}>
            {weekDays.map(d => {
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selectedDate);
              const dayJobs = (allJobs || []).filter(j => sameDay(new Date(j.scheduled_at), d));
              return (
                <div
                  key={d.toISOString()}
                  onClick={() => { setSelectedDate(d); setWeekOffset(0); }}
                  style={{
                    minWidth: 42, height: 54, borderRadius: 12,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: isToday ? T.pink : isSelected ? T.pinkTint : T.card,
                    border: `1.5px solid ${isToday ? T.pink : isSelected ? T.pink : T.cardBorder}`,
                    cursor: 'pointer', position: 'relative'
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? 'white' : T.inkMuted, textTransform: 'uppercase' }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? 'white' : T.ink }}>
                    {d.getDate()}
                  </div>
                  {dayJobs.length > 0 && (
                    <div style={{ position: 'absolute', bottom: 4, display: 'flex', gap: 2 }}>
                      {dayJobs.slice(0, 3).map((_, i) => (
                        <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: isToday ? 'white' : T.pink }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, width: 30, height: 38, color: T.ink, cursor: 'pointer' }}
          >›</button>

          {weekOffset !== 0 && (
            <button 
              onClick={() => { setWeekOffset(0); setSelectedDate(today); }}
              style={{ background: T.pink, border: 'none', borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
            >Today</button>
          )}
        </div>

        {isSelectedToday ? (
          <>
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
              <div style={{ marginBottom: 24 }}>
                <SectionLabel color={T.pink}>✦ MISSION READY · START NOW</SectionLabel>
                <div 
                  onClick={() => openJob(next.id)}
                  style={{ 
                    background: mode === 'dark' ? '#1C1C1E' : 'white', 
                    border: `1.5px solid ${mode === 'dark' ? 'rgba(233,30,106,0.32)' : T.cardBorder}`, 
                    borderRadius: 14, 
                    padding: '16px', 
                    marginBottom: 12, 
                    cursor: 'pointer', 
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pink, textTransform: 'uppercase', marginBottom: 4 }}>Next Mission</div>
                      <Title style={{ fontSize: 18, color: T.ink }}>{next.client_name}</Title>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text style={{ fontSize: 16, fontWeight: 900, color: T.ink }}>{fmtTime12(next.start).time}</Text>
                      <Caption style={{ fontWeight: 700, color: T.inkMuted }}>{fmtTime12(next.start).period}</Caption>
                    </div>
                  </div>

                  {next.ai_context?.drive_to && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: T.pinkTint, borderRadius: 10 }}>
                      <span style={{ fontSize: 14 }}>🚗</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.pink, textTransform: 'uppercase' }}>Traffic Update</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{next.ai_context.drive_to.duration} to destination</div>
                      </div>
                      <button 
                        onClick={handleRefreshTraffic}
                        disabled={isRefreshingTraffic}
                        style={{ background: 'none', border: 'none', color: T.pink, cursor: 'pointer', padding: 4 }}
                      >
                        {isRefreshingTraffic ? '...' : '↻'}
                      </button>
                    </div>
                  )}

                  <MissionIntel prepNote={next.prep_note || next.client_access_json || next.client_prefs_json} T={T} theme={T} />
                  
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {next.address && (
                      <button onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`, '_blank'); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>NAVIGATE</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleClockOut(next.id); /* using handleClockOut as a proxy for START */ }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.pink, color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>START NOW</button>
                  </div>
                </div>
              </div>
            ) : null}

            {categorizedJobs.incomplete.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel color="#F59E0B">✦ Incomplete Missions · Needs Update</SectionLabel>
                {categorizedJobs.incomplete.map(j => (
                  <Swipeable key={j.id} onSwipeLeft={() => handleDeleteJob(j.id)}>
                    <JobCard job={j} T={T} onClick={() => openJob(j.id)} />
                  </Swipeable>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              {categorizedJobs.upcoming.length > 0 && (
                <>
                  <SectionLabel>Upcoming Today</SectionLabel>
                  {categorizedJobs.upcoming.map(j => (
                    <Swipeable key={j.id} onSwipeLeft={() => handleDeleteJob(j.id)}>
                      <JobCard job={j} T={T} onClick={() => openJob(j.id)} />
                    </Swipeable>
                  ))}
                </>
              )}
            </div>

            {categorizedJobs.done.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel>Missions Accomplished · Today</SectionLabel>
                {categorizedJobs.done.map(j => (
                  <JobCard key={j.id} job={j} T={T} onClick={() => openJob(j.id)} />
                ))}
              </div>
            )}

            {!activeJob && !next && categorizedJobs.upcoming.length === 0 && categorizedJobs.done.length === 0 && categorizedJobs.incomplete.length === 0 && (
              <EmptyState allDone={allDone} T={T} />
            )}
          </>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>{dateBrief(selectedDate)}</SectionLabel>
            {todayJobs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.7 }}>
                <NoResults size={60} />
                <div style={{ marginTop: 12, fontSize: 13, color: T.inkMuted }}>No missions scheduled for this day.</div>
              </div>
            ) : (
              todayJobs.map(j => (
                <Swipeable key={j.id} onSwipeLeft={() => handleDeleteJob(j.id)}>
                  <JobCard job={j} T={T} onClick={() => openJob(j.id)} />
                </Swipeable>
              ))
            )}
          </div>
        )}

        {/* Future Schedule Groups */}
        {futureWeekGroups.length > 0 && (
          <div style={{ marginTop: 12, paddingBottom: 40 }}>
            {futureWeekGroups.map(group => (
              <div key={group.date.toISOString()} style={{ marginBottom: 24 }}>
                <SectionLabel style={{ marginTop: 16 }}>{dateBrief(group.date)}</SectionLabel>
                {group.jobs.map(j => (
                  <Swipeable key={j.id} onSwipeLeft={() => handleDeleteJob(j.id)}>
                    <JobCard job={j} T={T} onClick={() => openJob(j.id)} />
                  </Swipeable>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: isKeyboardFocused ? 260 : 0, transition: 'height 0.2s ease-out' }} />
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
