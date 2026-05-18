# Home Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Home screen into a permanent 3-zone layout: Today's Schedule (deep rose Next Up hero + blue upcoming cards), Needs Attention (amber, all past incomplete/unpaid jobs), and no completed/paid zone on home.

**Architecture:** All changes are in `src/pages/Home.jsx` only. `allJobs` from `useData` already covers all dates (no date filter in `fetchActiveJobs`), so attention items are computed client-side via `useMemo`. `selectedDate` defaults to today instead of null, removing the weekly-summary default state.

**Tech Stack:** React, Tailwind-style inline styles, existing `T` theme tokens, `useData` / `useJobs` context, Google Maps drive data already on `job.ai_context.drive_to`.

---

## File Map

| File | Change |
|---|---|
| `src/pages/Home.jsx` | All changes — default date, attention items, 3-zone render, hero color, blue cards, staleness banner, remove Zone 3 |

---

### Task 1: Default selectedDate to today

**Files:**
- Modify: `src/pages/Home.jsx` — `useState` for `selectedDate`, revenue display, `isSelectedToday`

- [ ] **Step 1: Change selectedDate initial value**

Find this line (~193):
```jsx
const [selectedDate, setSelectedDate] = useState(null);
```
Replace with:
```jsx
const [selectedDate, setSelectedDate] = useState(() => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
});
```

- [ ] **Step 2: Fix isSelectedToday — always true when selectedDate equals today**

Find (~303):
```jsx
const isSelectedToday = selectedDate ? sameDay(selectedDate, today) : false;
```
Replace with:
```jsx
const isSelectedToday = sameDay(selectedDate, today);
```

- [ ] **Step 3: Fix revenue — show today total when today, week total otherwise**

Find (~283):
```jsx
const displayRevenue = useMemo(() => {
  const jobs = selectedDate ? selectedDateJobs : weekJobs;
  return jobs.reduce((s, j) => s + Number(j.total || 0), 0);
}, [selectedDate, selectedDateJobs, weekJobs]);
```
Replace with:
```jsx
const displayRevenue = useMemo(() => {
  const jobs = isSelectedToday ? todayJobs : selectedDate ? selectedDateJobs : weekJobs;
  return jobs.reduce((s, j) => s + Number(j.total || 0), 0);
}, [isSelectedToday, selectedDate, todayJobs, selectedDateJobs, weekJobs]);
```

- [ ] **Step 4: Fix header revenue label**

Find (~539):
```jsx
<Caption style={{ fontWeight: 800, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase', fontSize: 10 }}>
  {!selectedDate ? 'Projected' : 'Revenue'}
</Caption>
```
Replace with:
```jsx
<Caption style={{ fontWeight: 800, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase', fontSize: 10 }}>
  {isSelectedToday ? 'Today' : 'Revenue'}
</Caption>
```

- [ ] **Step 5: Fix the weekly summary header branch**

The hero currently shows weekly summary when `!selectedDate`. Since selectedDate now always has a value, update the condition:

Find (~498):
```jsx
{!selectedDate ? (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
      <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, margin: 0 }}>
        ✦ WEEKLY SUMMARY
      </SectionLabel>
```

Replace the entire `!selectedDate` hero branch (`!selectedDate ? ( ... ) : ( ... )`) with just the selected-date branch content. The weekly summary header is now only shown when a non-today day is selected — the header content for today view shows the greeting. Update condition to:
```jsx
{isSelectedToday ? (
  <>
    <SectionLabel style={{ color: mode === 'dark' ? T.pinkLabel : T.pink, marginBottom: 5 }}>
      ✦ Command Brief · {dateBrief(selectedDate)}
    </SectionLabel>
    <Title style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.5px', color: mode === 'dark' ? 'white' : T.ink, lineHeight: 1.15, marginBottom: 4 }}>
      {timeBasedGreeting}
    </Title>
    <Text style={{ fontSize: 14, color: T.inkSub, fontWeight: 600 }}>
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
```

- [ ] **Step 6: Verify in browser**

`npm run dev`. Home should load with today highlighted in the strip and the greeting visible (not weekly summary). Tapping another day should show that day's header. Tapping today should return to greeting.

- [ ] **Step 7: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): default selectedDate to today, remove weekly summary as default view"
```

---

### Task 2: Compute attentionItems and todayUpcoming

**Files:**
- Modify: `src/pages/Home.jsx` — add two `useMemo` blocks after existing `overdueScheduled`

- [ ] **Step 1: Add attentionItems useMemo**

After the `overdueScheduled` computation (~294), add:
```jsx
// All past jobs not yet completed or not yet paid — across all dates
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
    .sort((a, b) => a.start - b.start); // oldest first
}, [allJobs, now]);
```

- [ ] **Step 2: Add staleAttentionItems — items > 48 hours overdue**

Directly after attentionItems:
```jsx
const staleAttentionItems = useMemo(() => {
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  return attentionItems.filter(j => j.end < cutoff);
}, [attentionItems, now]);
```

- [ ] **Step 3: Add todayUpcoming — future today jobs excluding Next Up and active**

After staleAttentionItems:
```jsx
const todayUpcoming = useMemo(() => {
  return todayJobs.filter(j =>
    j.id !== activeJob?.id &&
    j.id !== next?.id &&
    j.start >= now &&
    j.status === 'Scheduled'
  );
}, [todayJobs, activeJob, next, now]);
```

- [ ] **Step 4: Add attentionRef for scroll-to from banner**

After the `useRef(sheetRef)` or near other refs at the top of the component:
```jsx
const attentionRef = useRef(null);
```

- [ ] **Step 5: Verify no crashes**

`npm run dev`. Console should be clean. No visible change yet.

- [ ] **Step 6: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): compute attentionItems, staleAttentionItems, todayUpcoming"
```

---

### Task 3: Restyle Next Up hero card (deep rose + drive time + job notes)

**Files:**
- Modify: `src/pages/Home.jsx` — the `next ?` branch, ~line 668

- [ ] **Step 1: Define the deep rose color constant near the top of the return block**

Just inside the `return (` (~line 484), add after the safety check:
```jsx
const DEEP_ROSE = '#B5004E';
const DEEP_ROSE_GLOW = 'rgba(181,0,78,0.18)';
const DEEP_ROSE_TINT = mode === 'dark' ? 'rgba(181,0,78,0.12)' : '#FFF0F4';
```

- [ ] **Step 2: Update the Next Up card container colors**

In the `next ?` branch find the card container div (~line 679). Replace every `T.pink` reference inside this card with `DEEP_ROSE` and `T.pinkGlow` with `DEEP_ROSE_GLOW`:

```jsx
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
```

- [ ] **Step 3: Update glow orb and text colors inside the card**

Replace the glow orb radial gradient color and client name / time colors from `T.pink` to `DEEP_ROSE`:

Glow orb:
```jsx
<div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${DEEP_ROSE_GLOW} 0%,transparent 70%)`, pointerEvents: 'none' }} />
```

Client name stays `T.ink`. Service name:
```jsx
<div style={{ fontSize: 14, fontWeight: 700, color: DEEP_ROSE, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>
  {next.service_name}
</div>
```

Time display:
```jsx
<div style={{ fontSize: 26, fontWeight: 900, color: DEEP_ROSE, fontFamily: 'monospace', letterSpacing: '-1px', lineHeight: 1 }}>
  {fmtTime12(next.start).time}
</div>
```

- [ ] **Step 4: Drive time row — always present**

Find the existing drive time block (~line 717):
```jsx
{next.ai_context?.drive_to && (
  <div style={{ display: 'flex', ...
```

Replace with an always-visible row that shows "Calculating…" when data isn't available yet:
```jsx
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
    <button
      onClick={e => { e.stopPropagation(); handleRefreshTraffic(e); }}
      disabled={isRefreshingTraffic}
      style={{ background: 'none', border: 'none', color: DEEP_ROSE, cursor: 'pointer', fontSize: 14, padding: 2 }}
    >
      {isRefreshingTraffic ? '…' : '↻'}
    </button>
  )}
</div>
```

- [ ] **Step 5: Job notes block — show job_notes below drive row**

After the drive row and before MissionIntel, add:
```jsx
{next.job_notes && (
  <div style={{
    background: mode === 'dark' ? 'rgba(181,0,78,0.08)' : 'rgba(181,0,78,0.05)',
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 10,
    borderLeft: `3px solid ${DEEP_ROSE}`,
  }}>
    <div style={{ fontSize: 9, fontWeight: 900, color: DEEP_ROSE, textTransform: 'uppercase', marginBottom: 3 }}>📌 JOB NOTES</div>
    <div style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.4 }}>{next.job_notes}</div>
  </div>
)}
```

- [ ] **Step 6: Update START NOW and NAVIGATE button colors**

```jsx
<button onClick={e => { e.stopPropagation(); handleClockOut(next.id); }} style={{ flex: 2, padding: '11px', borderRadius: 10, background: DEEP_ROSE, color: 'white', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.5px' }}>START NOW</button>
```

NAVIGATE button border:
```jsx
<button onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`, '_blank'); }} style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.card, border: `1px solid ${DEEP_ROSE}`, color: DEEP_ROSE, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>NAVIGATE</button>
```

- [ ] **Step 7: Verify on phone**

Next Up card should appear notably deeper/richer than any other pink on screen. Drive time always shows. Job notes appear if present on the job.

- [ ] **Step 8: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): Next Up card deep rose color, always-on drive row, job notes block"
```

---

### Task 4: Blue upcoming-today cards inside Zone 1

**Files:**
- Modify: `src/pages/Home.jsx` — add blue `UpcomingCard` component and render `todayUpcoming`

- [ ] **Step 1: Add UpcomingCard component (blue variant)**

After the `EmptyState` component definition (~line 174), add:
```jsx
function UpcomingCard({ job: j, T, onClick }) {
  const BLUE = '#1565C0';
  const BLUE_BG = 'rgba(21,101,192,0.07)';
  const startTime = fmtTime12(j.start);
  const endTime = fmtTime12(j.end);
  return (
    <div
      onClick={onClick}
      style={{
        background: BLUE_BG,
        border: `2px solid ${BLUE}`,
        borderLeft: `6px solid ${BLUE}`,
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {j.client_name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>
            {j.service_name}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: BLUE, fontFamily: 'monospace' }}>
            {startTime.time}<span style={{ fontSize: 11 }}>{startTime.period}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted }}>–{endTime.time}<span style={{ fontSize: 10 }}>{endTime.period}</span></div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render todayUpcoming inside Zone 1 — below the Next Up / active card**

In the today view, after the closing `</div>` of the Next Up card block (around line 736) and before the `{overdueScheduled.length > 0 &&` block, add:
```jsx
{todayUpcoming.length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <SectionLabel style={{ color: '#1565C0', marginBottom: 8 }}>COMING UP TODAY</SectionLabel>
    {todayUpcoming.map(j => (
      <UpcomingCard key={j.id} job={j} T={T} onClick={() => openJob(j.id)} />
    ))}
  </div>
)}
```

- [ ] **Step 3: Remove todayUpcoming from categorizedJobs upcoming render**

Find the "Upcoming Today" section (~line 787):
```jsx
{categorizedJobs.upcoming.length > 0 && (
  <>
    <SectionLabel>Upcoming Today</SectionLabel>
    {categorizedJobs.upcoming.map(j => (
```
Delete this entire block (it's now covered by `todayUpcoming` in Zone 1 above). The `categorizedJobs.upcoming` data is no longer needed for today view.

- [ ] **Step 4: Verify**

Multiple jobs today → all future ones appear as blue cards below the hero. No duplicate rendering.

- [ ] **Step 5: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): blue upcoming-today cards in Zone 1 below Next Up"
```

---

### Task 5: Zone 2 — Needs Attention render + staleness banner

**Files:**
- Modify: `src/pages/Home.jsx` — replace `overdueScheduled` section and `categorizedJobs.incomplete` with unified `attentionItems` render

- [ ] **Step 1: Add staleness banner**

In the today view, at the very top of the scroll area content (before the tightGap alert block, ~line 607), add:
```jsx
{staleAttentionItems.length > 0 && (
  <div
    onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    style={{
      background: '#FEF3C7',
      border: '1.5px solid #F59E0B',
      borderRadius: 12,
      padding: '10px 14px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
    }}
  >
    <span style={{ fontSize: 18 }}>⚠️</span>
    <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
      {staleAttentionItems.length} job{staleAttentionItems.length > 1 ? 's' : ''} need{staleAttentionItems.length === 1 ? 's' : ''} your attention
    </div>
    <span style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>↓ View</span>
  </div>
)}
```

- [ ] **Step 2: Replace the two old incomplete/overdue sections with unified Zone 2**

Delete these two blocks from the today view:
1. The `overdueScheduled.length > 0` block (~line 740)
2. The `categorizedJobs.incomplete.length > 0` block (~line 775)

Replace both with a single Zone 2 block, placed after the `todayUpcoming` render and before the `categorizedJobs.done` section:
```jsx
{attentionItems.length > 0 && (
  <div ref={attentionRef} style={{ marginBottom: 24 }}>
    <SectionLabel color="#F59E0B">⚠️ Needs Attention</SectionLabel>
    {attentionItems.map(j => {
      const needsWrap = j.status !== 'Completed';
      const startTime = fmtTime12(j.start);
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
            </div>
            <button
              onClick={() => openPostJob(j.id)}
              style={{
                background: '#F59E0B',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '9px 14px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
                marginLeft: 10,
              }}
            >
              {needsWrap ? 'WRAP UP' : 'PAY'}
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Verify**

Any incomplete or unpaid past jobs appear in amber regardless of date. Staleness banner appears if any item is > 48hrs old. Tapping banner scrolls to the section. WRAP UP / PAY button opens PostJobSheet.

- [ ] **Step 4: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): unified Needs Attention zone — all past incomplete/unpaid with staleness banner"
```

---

### Task 6: Remove Zone 3 (completed + paid) from home

**Files:**
- Modify: `src/pages/Home.jsx` — delete done/completed sections from today view

- [ ] **Step 1: Delete the "Missions Accomplished · Today" section**

Find and delete (~line 799):
```jsx
{categorizedJobs.done.length > 0 && (
  <div style={{ marginBottom: 24 }}>
    <SectionLabel>Missions Accomplished · Today</SectionLabel>
    {categorizedJobs.done.map(j => (
      <JobCard key={j.id} job={j} T={T} onClick={() => openJob(j.id)} onDuplicate={handleDuplicateJob} />
    ))}
  </div>
)}
```

- [ ] **Step 2: Update empty state condition**

Find (~line 808):
```jsx
{!activeJob && !next && categorizedJobs.upcoming.length === 0 && categorizedJobs.incomplete.length === 0 && (
```
Replace with:
```jsx
{!activeJob && !next && todayUpcoming.length === 0 && attentionItems.length === 0 && (
```

- [ ] **Step 3: Verify**

Completed + paid jobs no longer appear on home. Empty state shows only when nothing needs action.

- [ ] **Step 4: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): remove completed+paid zone from home screen"
```

---

### Task 7: Non-today day selected view cleanup

**Files:**
- Modify: `src/pages/Home.jsx` — the `!isSelectedToday` branch (other day selected)

- [ ] **Step 1: Simplify other-day view**

The `!isSelectedToday` branch (~line 812) currently shows `selectedDateJobs` as a flat list. This is already correct. Confirm it doesn't render `attentionItems` or Zone 1 content (it shouldn't — those are inside the `isSelectedToday` branch). No code change needed if the branching is clean — just verify.

- [ ] **Step 2: Verify by tapping a non-today day**

Tap yesterday in the week strip. Should see: yesterday's header + that day's jobs as plain JobCards. No attention queue. No Next Up card.

- [ ] **Step 3: Final full smoke test on phone**

Walk through:
1. Home loads → today highlighted, greeting visible, Next Up card in deep rose
2. Next Up: drive time row visible, job notes visible if present
3. Blue upcoming cards below Next Up (if more jobs today)
4. Any past incomplete/unpaid jobs appear amber below
5. Staleness banner if any > 48hrs old
6. Completed+paid jobs NOT on home screen
7. Tap other day → simple job list, no zones
8. Tap today → returns to 3-zone view

- [ ] **Step 4: Final commit and push**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): 3-zone layout complete — deep rose Next Up, blue upcoming, amber attention queue"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Today defaults as home → Task 1
- ✅ Next Up hero deep rose + drive + notes → Task 3
- ✅ Blue upcoming today cards → Task 4
- ✅ Attention queue all past incomplete/unpaid → Task 5
- ✅ Staleness banner → Task 5
- ✅ No completed+paid on home → Task 6
- ✅ Other day = simple view → Task 7
- ✅ attentionItems data computed without new fetch → Task 2 (allJobs covers all dates)

**Type consistency:** `attentionItems`, `staleAttentionItems`, `todayUpcoming`, `DEEP_ROSE`, `attentionRef` — all defined before use. `UpcomingCard` defined before render site.

**No placeholders:** All code blocks are complete and copy-pasteable.
