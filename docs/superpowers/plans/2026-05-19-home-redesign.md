# Home Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual-mode Home page (week browser + daily dashboard) with a focused, always-today action dashboard: Command Brief → Today → Needs Action → Rest of Week → Done This Week.

**Architecture:** Remove all week-navigation state (`selectedDate`, `weekStart`, `weekDays`) and the `isSelectedToday` conditional branch. Add `restOfWeekJobs` derived list. The page is permanently anchored to the real `today`. `briefingMessages.js` loses its `isSelectedToday` guard. `JobCard` gains a `subtle` prop for the muted Done This Week treatment.

**Tech Stack:** React (Vite), Tailwind-style inline CSS, Supabase via existing hooks, `src/lib/dateUtils.js` for date math.

---

## File Map

| File | Change |
|---|---|
| `src/lib/briefingMessages.js` | Remove `isSelectedToday` guard + `selectedDateJobCount` param |
| `src/pages/Home.jsx` | Strip week-nav state/handlers/imports; add `restOfWeekJobs`; simplify hero + body |
| `src/components/cards/JobCard.jsx` | Add `subtle` prop for muted completed-job treatment |

---

## Task 1: Simplify `briefingMessages.js`

**Files:**
- Modify: `src/lib/briefingMessages.js`

- [ ] **Step 1: Remove `isSelectedToday` from the function signature and body**

Replace the entire file content with:

```js
import { fmtTime12 } from './dateUtils';
import { getPersistentDailyMessage } from './greetings';

const NICKNAMES = ['Boss', 'Hero', 'Champ', 'Legend', 'Captain'];

function dailyAddress(now, firstName) {
  const daySeed = now.toDateString() + firstName;
  let h = 0;
  for (let i = 0; i < daySeed.length; i++) { h = ((h << 5) - h) + daySeed.charCodeAt(i); h |= 0; }
  return (Math.abs(h) % 10) < 4 ? NICKNAMES[Math.abs(h >> 2) % NICKNAMES.length] : firstName;
}

export function getBriefingMessage({ allDone, activeJob, next, now, todayJobs, attentionItemCount, persona, firstName }) {
  const hour = now.getHours();
  const isMorning = hour < 12;
  const isEvening = hour >= 17;
  const address = dailyAddress(now, firstName);

  if (allDone) {
    if (isMorning) return `Done already, ${address}? You're a morning superhero.`;
    if (isEvening) return `Wrapped for the day. Go put your feet up, ${address}.`;
    return "All wrapped up. Go enjoy the rest of your afternoon!";
  }

  if (activeJob) {
    const remainingCount = todayJobs.filter(j => j.status === 'Scheduled' && j.id !== activeJob.id).length;
    const moreStr = remainingCount > 0 ? `${remainingCount} more` : 'one more';
    if (isMorning) return `In the zone! ${moreStr} boss ${remainingCount === 1 ? 'move' : 'moves'} before noon.`;
    if (isEvening) return `Almost there — ${moreStr} and you're done for tonight.`;
    return `Locked in. ${moreStr} to go this afternoon.`;
  }

  if (next) {
    const minsToStart = Math.round((next.start - now) / 60000);
    const jobsRemaining = todayJobs.filter(j => j.status === 'Scheduled' && j.payment_status !== 'Paid').length;
    const countStr = jobsRemaining > 1 ? ` · ${jobsRemaining - 1} more after` : '';

    if (minsToStart <= 0) {
      if (isMorning) return `Suit up, ${address}! Your next mission is starting now.${countStr}`;
      if (isEvening) return `Last push, ${address}! Starting right now.${countStr}`;
      return `Time to go! Next mission is starting now.${countStr}`;
    }

    if (minsToStart < 60) {
      if (isMorning) return `T-minus ${minsToStart} mins. Morning's moving fast.${countStr}`;
      if (isEvening) return `T-minus ${minsToStart} mins — one more and you're free, ${address}.${countStr}`;
      return `T-minus ${minsToStart} mins until you save the day again.${countStr}`;
    }

    const timeStr = fmtTime12(next.start);
    const timeLabel = `${timeStr.time} ${timeStr.period}`;
    if (isMorning) return `Deep breaths. Next mission at ${timeLabel}.${countStr}`;
    if (isEvening) return `One more at ${timeLabel}. Enjoy the downtime.${countStr}`;
    return `Enjoy the gap. Back at it by ${timeLabel}.${countStr}`;
  }

  if (attentionItemCount > 0) {
    return `${attentionItemCount} job${attentionItemCount > 1 ? 's' : ''} need wrapping up. Let's tidy those out.`;
  }

  try {
    return getPersistentDailyMessage('briefing', persona).replace(/{name}/g, address);
  } catch {
    return "Ready for the day.";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/briefingMessages.js
git commit -m "refactor: remove isSelectedToday from briefingMessages — home always anchored to today"
```

---

## Task 2: Strip week-nav state and add new derived lists in Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx` (lines 40–235)

The goal here is to replace all the week-navigation state and derived data with the simpler always-today equivalents.

- [ ] **Step 1: Replace the state block and all derived data (lines 40–235)**

Find this block (starts at line 40, `const [runtimeError]...`, ends at line 218 closing `}, [weekJobs, todayJobs, attentionItems]);`):

```js
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

  const currentWeekStart = useMemo(() => getWeekRange(today)[0], [today]);
  const isOffCurrentWeek = useMemo(
    () => weekStart.toDateString() !== currentWeekStart.toDateString(),
    [weekStart, currentWeekStart]
  );
```

Replace with:

```js
  const [today] = useState(() => new Date());
  const [isSpeaking, setIsSpeaking] = useState(false);
```

- [ ] **Step 2: Replace `weekDays` + `weekJobs` with `currentWeek` derived data**

Find and remove the `weekDays` and `weekJobs` useMemo blocks (lines 72–89):

```js
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
```

Replace with:

```js
  const currentWeek = useMemo(() => getWeekRange(today), [today]);
  const currentWeekStart = currentWeek[0];
  const currentWeekEnd = currentWeek[6];
```

- [ ] **Step 3: Remove `selectedDateJobs` and `isSelectedToday` (lines 113–134)**

Find and remove:

```js
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

  const isSelectedToday = sameDay(selectedDate, today);

  const displayRevenue = useMemo(() => {
    const jobs = isSelectedToday ? todayJobs : selectedDate ? selectedDateJobs : weekJobs;
    return jobs.reduce((s, j) => s + computeJobTotal(j), 0);
  }, [isSelectedToday, selectedDate, todayJobs, selectedDateJobs, weekJobs]);
```

Replace with:

```js
  const allDone = todayJobs.length > 0 && !todayJobs.some(j => j.status === 'Scheduled' || j.payment_status !== 'Paid');

  const displayRevenue = useMemo(
    () => todayJobs.reduce((s, j) => s + computeJobTotal(j), 0),
    [todayJobs]
  );
```

- [ ] **Step 4: Update `briefingMsg` useMemo (line 165)**

Find:

```js
  const briefingMsg = useMemo(() => getBriefingMessage({
    isSelectedToday,
    selectedDateJobCount: selectedDateJobs.length,
    allDone,
    activeJob,
    next,
    now,
    todayJobs,
    attentionItemCount: attentionItems.length,
    persona,
    firstName,
  }), [isSelectedToday, selectedDateJobs.length, allDone, activeJob, next, now, todayJobs, attentionItems.length, persona, firstName]);
```

Replace with:

```js
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
```

- [ ] **Step 5: Update `completedPaidThisWeek` to use current week directly (line 183)**

Find:

```js
  const completedPaidThisWeek = useMemo(() => {
    return weekJobs
      .filter(j => j.status === 'Completed' && j.payment_status === 'Paid')
      .sort((a, b) => b.start - a.start);
  }, [weekJobs]);
```

Replace with:

```js
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
```

- [ ] **Step 6: Add `restOfWeekJobs` derived list after `completedPaidThisWeek`**

Insert immediately after the `completedPaidThisWeek` useMemo:

```js
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
```

- [ ] **Step 7: Update `paymentMap` useEffect deps (line 190)**

Find:

```js
  }, [weekJobs, todayJobs, attentionItems]);
```

And update the `jobIds` inside + the dep array:

```js
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
```

- [ ] **Step 8: Remove unused handlers**

Find and delete `handleWeekChange` and `handleGoToToday` (lines 302–311):

```js
  const handleWeekChange = useCallback((delta) => {
    setWeekStart(prev => addDays(prev, delta * 7));
  }, []);

  const handleGoToToday = useCallback(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setSelectedDate(t);
    setWeekStart(getWeekRange(t)[0]);
  }, []);
```

Also find and delete `handleDeleteJob` (lines 236–244) and `nextUpLabel` (lines 231–234):

```js
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
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "refactor: strip week-nav state from Home — add restOfWeekJobs, simplify derived data"
```

---

## Task 3: Rewrite the hero section in Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx` (the hero `<div>` block, approx lines 368–484)

- [ ] **Step 1: Replace the entire hero block**

Find the opening `{/* Hero */}` comment and its outer `<div>` all the way through the closing `</div>` that ends the WeekStrip container (line 484). Replace the entire block with:

```jsx
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
                Projected
              </div>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: simplify Home hero to always-on Command Brief, remove WeekStrip"
```

---

## Task 4: Rewrite the body sections in Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx` (the scrollable body, approx lines 486–799)

- [ ] **Step 1: Replace the entire scrollable body**

Find `<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>` and everything through `<div style={{ height: isKeyboardFocused ? 80 : 0, transition: 'height 0.2s ease-out' }} />` — replace it entirely with:

```jsx
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
                Only {tightGap.gapMin}m between {tightGap.a.client_name} and {tightGap.b.client_name}.
                {tightGap.driveMin > 0 && ` Drive takes ~${tightGap.driveMin}m.`}
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

        {/* TODAY — Remaining jobs */}
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

        {/* NEEDS ACTION — carry-forward from any past date */}
        {attentionItems.length > 0 && (
          <div ref={attentionRef} style={{ marginBottom: 24 }}>
            <SectionLabel color="#F59E0B">Needs Action</SectionLabel>
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

        {/* REST OF THIS WEEK — upcoming scheduled jobs */}
        {restOfWeekJobs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel style={{ color: T.inkSub, marginBottom: 8 }}>REST OF THIS WEEK</SectionLabel>
            {restOfWeekJobs.map(j => {
              const startFmt = fmtTime12(j.start);
              const total = computeJobTotal(j);
              return (
                <div
                  key={j.id}
                  onClick={() => openJob(j.id)}
                  style={{
                    background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${T.cardBorder}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 40 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: T.pink, fontFamily: 'monospace', lineHeight: 1.2 }}>{startFmt.time}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.pink, textTransform: 'uppercase' }}>{startFmt.period}</div>
                    <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 2, whiteSpace: 'nowrap' }}>
                      {j.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.client_name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSub, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {j.service_name}
                    </div>
                  </div>
                  {!privacyOn && total > 0 && (
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.inkSub, flexShrink: 0 }}>
                      ${total.toFixed(0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* DONE THIS WEEK — subtle, progress view */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: rewrite Home body — Today / Needs Action / Rest of Week / Done This Week sections"
```

---

## Task 5: Add `subtle` prop to JobCard

**Files:**
- Modify: `src/components/cards/JobCard.jsx`

- [ ] **Step 1: Add `subtle` to the function signature**

Find:

```js
export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false }) {
```

Replace with:

```js
export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false, subtle = false }) {
```

- [ ] **Step 2: Apply subtle style in the `isCompleted` render path**

Find the opening `<div>` of the `isCompleted` return (the one with `background: urgencyBg, border: ...`):

```js
      style={{
          background: urgencyBg,
          border: `1.5px solid ${urgencyColor}`,
          borderLeft: `5px solid ${urgencyColor}`,
          borderRadius: 14,
          marginBottom: 9,
          cursor: 'pointer',
          padding: '10px 14px',
        }}
```

Replace with:

```js
      style={{
          background: subtle ? 'transparent' : urgencyBg,
          border: subtle ? `1px solid ${T.cardBorder}` : `1.5px solid ${urgencyColor}`,
          borderLeft: subtle ? `1px solid ${T.cardBorder}` : `5px solid ${urgencyColor}`,
          borderRadius: 14,
          marginBottom: 9,
          cursor: 'pointer',
          padding: '10px 14px',
          opacity: subtle ? 0.6 : 1,
        }}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/JobCard.jsx
git commit -m "feat: add subtle prop to JobCard for muted completed-job display"
```

---

## Task 6: Clean up unused imports in Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx` (lines 1–27)

- [ ] **Step 1: Remove unused imports**

Find the import block at the top of Home.jsx and update it:

Remove these imports entirely:
- `import WeekStrip from '../components/ui/WeekStrip';`
- `import Swipeable from '../components/ui/Swipeable';`
- `softDeleteJob` from the jobsRepo import (if `handleDeleteJob` was removed)

Update the dateUtils import to remove `getWeekLabel` (keep `sameDay` — still used by `todayJobs`):

Find:
```js
import { sameDay, addDays, getWeekRange, getWeekLabel, fmtTime12, dateBrief } from '../lib/dateUtils';
```

Replace with:
```js
import { sameDay, addDays, getWeekRange, fmtTime12, dateBrief } from '../lib/dateUtils';
```

Find:
```js
import { softDeleteJob, updateJob } from '../data/jobsRepo';
```

Replace with:
```js
import { updateJob } from '../data/jobsRepo';
```

- [ ] **Step 2: Verify no remaining references to removed items**

Run:
```bash
grep -n "WeekStrip\|Swipeable\|getWeekLabel\|softDeleteJob\|selectedDate\|weekStart\|isOffCurrentWeek\|isSelectedToday\|handleWeekChange\|handleGoToToday\|handleDeleteJob\|nextUpLabel\|selectedDateJobs\|weekJobs\|weekDays" src/pages/Home.jsx
```

Expected output: no matches. If any appear, remove the remaining references.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "chore: remove unused imports and dead code from Home after redesign"
```

---

## Verification

- [ ] `npm run dev` — open on 390px mobile viewport
- [ ] Command Brief header shows today's date and live briefing message
- [ ] Revenue ticker shows today's projected total; tapping opens finance detail sheet
- [ ] Active job spotlight renders with LiveTimer and action buttons if a job is clocked in
- [ ] Next Up card renders with timing countdown for the next scheduled job today
- [ ] Coming Up Today list appears below Next Up for any additional today jobs
- [ ] Needs Action shows amber cards for any past-end jobs that aren't fully closed
- [ ] Stale attention banner scrolls to the Needs Action section when tapped
- [ ] Rest of This Week shows compact cards for future scheduled jobs this week
- [ ] Done This Week shows muted cards at the bottom for completed+paid this week
- [ ] Empty state shows when there's nothing in any section
- [ ] Navigate to Schedule page — week picker and agenda still work (regression check)
- [ ] Dark mode: all sections render correctly with dark backgrounds
