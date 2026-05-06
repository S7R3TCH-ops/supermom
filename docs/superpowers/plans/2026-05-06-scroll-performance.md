# Scroll Performance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce scroll jank on Clients, Finance, and Calendar pages for low-end mobile devices via CSS containment, React.memo card extraction, and Finance transaction pagination.

**Architecture:** Three independent, additive changes applied in ascending risk order — CSS containment first (pure CSS, zero logic), then memoized card components (additive extraction), then Finance pagination (only stateful change). No new libraries required.

**Tech Stack:** React 18, Vite, Tailwind/inline styles, Playwright for E2E. No unit test framework — verification is `npm run build` (zero errors) + `npm run dev` visual inspection.

---

## Task 1: CSS Containment on Scroll Containers

**Files:**
- Modify: `src/pages/Clients.jsx:151`
- Modify: `src/pages/Finance.jsx:285`
- Modify: `src/pages/Calendar.jsx:261` (Day view)
- Modify: `src/pages/Calendar.jsx:371` (Week view)
- Modify: `src/pages/Calendar.jsx:488` (Agenda view)

- [ ] **Step 1: Add containment to Clients list scroll container**

In `src/pages/Clients.jsx` line 151, find:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 13px 8px' }}>
```
Replace with:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 13px 8px', contain: 'layout style paint' }}>
```

- [ ] **Step 2: Add containment to Finance main scroll container**

In `src/pages/Finance.jsx` line 285, find:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '11px 13px 8px' }}>
```
Replace with:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '11px 13px 8px', contain: 'layout style paint' }}>
```

- [ ] **Step 3: Add containment to Calendar Day view scroll container**

In `src/pages/Calendar.jsx` line 261, find:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', position: 'relative' }}>
```
Replace with:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', position: 'relative', contain: 'layout style paint' }}>
```

- [ ] **Step 4: Add containment to Calendar Week view scroll container**

In `src/pages/Calendar.jsx` line 371, find:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflow: 'auto', padding: '6px 10px 14px' }}>
```
Replace with:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflow: 'auto', padding: '6px 10px 14px', contain: 'strict' }}>
```

Note: `contain: 'strict'` is safe here because the week grid has fixed, known dimensions. It implies `layout style paint size`.

- [ ] **Step 5: Add containment to Calendar Agenda view scroll container**

In `src/pages/Calendar.jsx` line 488, find:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 14px' }}>
```
Replace with:
```jsx
<div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 13px 14px', contain: 'layout style paint' }}>
```

- [ ] **Step 6: Verify build and visual check**

Run: `npm run build`
Expected: exits with 0 errors.

Then run `npm run dev`, open the app, navigate to Clients / Finance / Calendar and scroll each view. Verify: no visual regression (nothing clipped, no layout shift, bottom sheets still overlay correctly).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Clients.jsx src/pages/Finance.jsx src/pages/Calendar.jsx
git commit -m "perf: add CSS containment to scroll containers"
```

---

## Task 2: React.memo on ClientCard

**Files:**
- Modify: `src/pages/Clients.jsx`

The client card is currently an inline render inside `.map()` at line 152. Extract it into a `React.memo` component defined at the top of the file.

- [ ] **Step 1: Add `memo` and `useCallback` to imports**

In `src/pages/Clients.jsx` line 1, find:
```jsx
import { useMemo, useState } from 'react';
```
Replace with:
```jsx
import { memo, useCallback, useMemo, useState } from 'react';
```

- [ ] **Step 2: Add the `ClientCard` component above the default export**

Insert the following block immediately before `export default function Clients()` (around line 11):

```jsx
const ClientCard = memo(function ClientCard({ c, T, onPress }) {
  return (
    <div
      onClick={() => onPress(c.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPress(c.id); }}
      style={{
        background: T.card, border: `1.5px solid ${c.owed ? 'rgba(233,30,106,0.35)' : T.cardBorder}`,
        borderRadius: 13, padding: '10px 12px', marginBottom: 7, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `${c.color}22`, border: `1.5px solid ${c.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: c.color,
        }}>{c.init}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            {c.vip && <span style={{ background: '#FCD34D', borderRadius: 4, padding: '1px 5px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>VIP ★</span>}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 4 }}>
            {c.service !== '—' ? `${c.service} · Last: ${c.last}` : 'No jobs yet'}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {c.tags.map(tag => {
              const isOverdue = tag.toLowerCase().includes('overdue');
              const isLead = tag === 'Lead';
              return (
                <span key={tag} style={{
                  background: isOverdue ? '#FEF3C7' : isLead ? '#F3F0FF' : T.pinkTint,
                  border: `1px solid ${isOverdue ? '#F59E0B40' : isLead ? '#7C3AED30' : T.cardBorder}`,
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: T.font, fontSize: 8.5, fontWeight: 700,
                  color: isOverdue ? '#78350F' : isLead ? '#5B21B6' : T.inkMuted,
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>{tag}</span>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          {c.owed && c.amt && <AmtCell amount={c.amt} size={13} />}
          {c.next !== '—' && (
            <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, textAlign: 'right' }}>Next: {c.next}</div>
          )}
          {c.tags.includes('Lead') && (
            <button
              onClick={(e) => { e.stopPropagation(); onPress(c.id); }}
              style={{ background: T.pink, color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: T.font, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Book</button>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Add `useCallback` for the navigate handler inside `Clients()`**

Inside `export default function Clients()`, after the existing hooks (around line 17), add:
```jsx
const handleClientPress = useCallback((id) => navigate(`/clients/${id}`), [navigate]);
```

- [ ] **Step 4: Replace the inline card render with `<ClientCard />`**

Find the `.map()` block starting at line 152:
```jsx
{filtered.map((c, i) => (
  <div
    key={c.id || i}
    onClick={() => navigate(`/clients/${c.id}`)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/clients/${c.id}`); }}
    style={{
      background: T.card, border: `1.5px solid ${c.owed ? 'rgba(233,30,106,0.35)' : T.cardBorder}`,
      borderRadius: 13, padding: '10px 12px', marginBottom: 7, cursor: 'pointer',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: `${c.color}22`, border: `1.5px solid ${c.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: c.color,
      }}>{c.init}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          {c.vip && <span style={{ background: '#FCD34D', borderRadius: 4, padding: '1px 5px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>VIP ★</span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 4 }}>
          {c.service !== '—' ? `${c.service} · Last: ${c.last}` : 'No jobs yet'}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {c.tags.map(tag => {
            const isOverdue = tag.toLowerCase().includes('overdue');
            const isLead = tag === 'Lead';
            return (
              <span key={tag} style={{
                background: isOverdue ? '#FEF3C7' : isLead ? '#F3F0FF' : T.pinkTint,
                border: `1px solid ${isOverdue ? '#F59E0B40' : isLead ? '#7C3AED30' : T.cardBorder}`,
                borderRadius: 4, padding: '2px 6px',
                fontFamily: T.font, fontSize: 8.5, fontWeight: 700,
                color: isOverdue ? '#78350F' : isLead ? '#5B21B6' : T.inkMuted,
                letterSpacing: '0.3px', textTransform: 'uppercase',
              }}>{tag}</span>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {c.owed && c.amt && <AmtCell amount={c.amt} size={13} />}
        {c.next !== '—' && (
          <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, textAlign: 'right' }}>Next: {c.next}</div>
        )}
        {c.tags.includes('Lead') && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}
            style={{ background: T.pink, color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: T.font, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >Book</button>
        )}
      </div>
    </div>
  </div>
))}
```
Replace the entire block with:
```jsx
{filtered.map((c, i) => (
  <ClientCard key={c.id || i} c={c} T={T} onPress={handleClientPress} />
))}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits with 0 errors, no "T.pink is not defined" or similar prop errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Clients.jsx
git commit -m "perf: extract ClientCard as React.memo component"
```

---

## Task 3: React.memo on TransactionRow

**Files:**
- Modify: `src/pages/Finance.jsx`

The transaction row is an inline render inside `.map()` at line 340. Extract it into a `React.memo` component.

- [ ] **Step 1: Add `memo` and `useCallback` to imports**

In `src/pages/Finance.jsx` line 1, find:
```jsx
import { useMemo, useState } from 'react';
```
Replace with:
```jsx
import { memo, useCallback, useMemo, useState } from 'react';
```

- [ ] **Step 2: Add the `TransactionRow` component above the default export**

Insert the following block immediately before `export default function Finance()` (around line 73):

```jsx
const TransactionRow = memo(function TransactionRow({ tx, T, privacyOn, onPress }) {
  const isJob = tx.type === 'job';
  const tappable = isJob && tx.status !== 'Cancelled';
  return (
    <div
      onClick={tappable ? () => onPress(tx.rawId) : undefined}
      style={{
        background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11,
        padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
        cursor: tappable ? 'pointer' : 'default',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${tx.color}18`, border: `1px solid ${tx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
        {tx.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>
          {tx.date}{tappable ? ' · tap to view details' : ''}
        </div>
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: tx.color, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {privacyOn ? '•••' : tx.amt}
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Add `useCallback` for the job open handler inside `Finance()`**

Inside `export default function Finance()`, after the `const { openJob } = useJobDetailSheet();` line (around line 198), add:
```jsx
const handleJobPress = useCallback((id) => openJob(id), [openJob]);
```

- [ ] **Step 4: Replace the inline transaction render with `<TransactionRow />`**

Find the `.map()` block starting at line 340:
```jsx
{transactions.map(tx => {
  const isJob = tx.type === 'job';
  const tappable = isJob && tx.status !== 'Cancelled';
  
  return (
    <div
      key={tx.id}
      onClick={tappable ? () => openJob(tx.rawId) : undefined}
      style={{
        background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11,
        padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
        cursor: tappable ? 'pointer' : 'default',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${tx.color}18`, border: `1px solid ${tx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
        {tx.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>
          {tx.date}{tappable ? ' · tap to view details' : ''}
        </div>
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: tx.color, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {privacyOn ? '•••' : tx.amt}
      </div>
    </div>
  );
})}
```
Replace with:
```jsx
{transactions.map(tx => (
  <TransactionRow key={tx.id} tx={tx} T={T} privacyOn={privacyOn} onPress={handleJobPress} />
))}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Finance.jsx
git commit -m "perf: extract TransactionRow as React.memo component"
```

---

## Task 4: React.memo on AgendaCard

**Files:**
- Modify: `src/pages/Calendar.jsx`

`AgendaCard` is already a named function component (line 543) — it just needs `React.memo` wrapping and a `useCallback` on the `onPress` handler passed to it.

- [ ] **Step 1: Add `memo` and `useCallback` to imports**

In `src/pages/Calendar.jsx` line 1, find:
```jsx
import { useMemo, useState } from 'react';
```
Replace with:
```jsx
import { memo, useCallback, useMemo, useState } from 'react';
```

- [ ] **Step 2: Wrap `AgendaCard` in `React.memo`**

In `src/pages/Calendar.jsx` at line 543, find:
```jsx
function AgendaCard({ T, mode, privacyOn, job, isNext, conflict, onPress }) {
```
Replace with:
```jsx
const AgendaCard = memo(function AgendaCard({ T, mode, privacyOn, job, isNext, conflict, onPress }) {
```

Then find the closing `}` of the `AgendaCard` function and add a closing `)` + `;` to complete the `memo()` call. The closing brace of `AgendaCard` is the last `}` in the file. Change:
```jsx
}
```
to:
```jsx
});
```

- [ ] **Step 3: Add `useCallback` for `onJobPress` in the `AgendaView` function**

Find the `AgendaView` function (it contains `grouped.map(group => {`). Near where `onJobPress` is used, add a `useCallback` wrapper. Find where `onJobPress` is defined or passed in as a prop and ensure it's stable. Since `onJobPress` is passed down from the parent `Calendar` component as a prop, add the callback in `Calendar`:

In the main `Calendar` component body, find where `onJobPress` is defined (it will be something like `function onJobPress(id) { ... }` or passed inline). Wrap it:
```jsx
const onJobPress = useCallback((id) => { /* existing body */ }, [/* existing deps */]);
```

Check the current definition of `onJobPress` in `Calendar.jsx` and apply `useCallback` with the same body and appropriate deps array.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exits with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Calendar.jsx
git commit -m "perf: wrap AgendaCard in React.memo"
```

---

## Task 5: Finance Transaction Pagination

**Files:**
- Modify: `src/pages/Finance.jsx`

Currently, `transactions` in Finance.jsx ends with `.slice(0, 10)` (line 237) — only the 10 most recent items show, with no way to see older ones. Replace this with a paginated `visibleCount` state: start at 50, "Show more" adds 50 at a time.

- [ ] **Step 1: Add `visibleCount` state**

Inside `export default function Finance()`, with the other `useState` declarations (around line 76), add:
```jsx
const [visibleCount, setVisibleCount] = useState(50);
```

- [ ] **Step 2: Remove the hardcoded `.slice(0, 10)` from the `transactions` useMemo**

Find in the `transactions` useMemo (around line 235):
```js
    return [...jobTx, ...expTx]
      .sort((a, b) => b._date - a._date)
      .slice(0, 10);
```
Replace with:
```js
    return [...jobTx, ...expTx]
      .sort((a, b) => b._date - a._date);
```

- [ ] **Step 3: Slice at render time using `visibleCount`**

Find the transaction render (now using `<TransactionRow />` from Task 3):
```jsx
{transactions.map(tx => (
  <TransactionRow key={tx.id} tx={tx} T={T} privacyOn={privacyOn} onPress={handleJobPress} />
))}
```
Replace with:
```jsx
{transactions.slice(0, visibleCount).map(tx => (
  <TransactionRow key={tx.id} tx={tx} T={T} privacyOn={privacyOn} onPress={handleJobPress} />
))}
{transactions.length > visibleCount && (
  <button
    onClick={() => setVisibleCount(c => c + 50)}
    style={{
      width: '100%', padding: '10px 0', background: 'none',
      border: `1px solid ${T.cardBorder}`, borderRadius: 10,
      fontFamily: T.font, fontSize: 11, fontWeight: 600,
      color: T.inkMuted, cursor: 'pointer', marginBottom: 8,
    }}
  >
    Show {Math.min(50, transactions.length - visibleCount)} more
  </button>
)}
```

- [ ] **Step 4: Reset `visibleCount` when period filter changes**

The Finance page has a `period` state (`Week` / `Month` / `Year` / `All`). When the user switches periods, the transaction list changes and the page count should reset. Find the `setPeriod` call on the period selector buttons (around line 276):
```jsx
onClick={() => setPeriod(v)}
```
Replace with:
```jsx
onClick={() => { setPeriod(v); setVisibleCount(50); }}
```

- [ ] **Step 5: Verify build and visual check**

Run: `npm run build`
Expected: exits with 0 errors.

Then `npm run dev`, go to Finance page, switch to "All" period. Verify: a "Show N more" button appears below the transaction list if there are more than 50 items. Tap it — more items load. Button disappears when all items are shown.

- [ ] **Step 6: Commit and bump version**

```bash
git add src/pages/Finance.jsx
git commit -m "perf: paginate Finance transaction list (50 per page)"
```

Then bump `package.json` version from `0.3.5` to `0.3.6`:
```bash
git add package.json
git commit -m "chore: bump version to 0.3.6"
```

---

## Task 6: Update GEMINI.md and CLAUDE.md

**Files:**
- Modify: `GEMINI.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update GEMINI.md Next priorities**

Mark the Scroll Performance Audit item as done and add any new priorities. Update the "Current State" table to include the scroll performance work.

In the Next priorities section, mark:
```
2. **Scroll Performance Audit** — Further optimize large client lists and finance history for low-end mobile devices.
```
As:
```
2. ~~**Scroll Performance Audit**~~ — ✅ Done (v0.3.6) — CSS containment on all scroll containers; React.memo on ClientCard, TransactionRow, AgendaCard; Finance transaction pagination (50/page).
```

- [ ] **Step 2: Update CLAUDE.md build status**

In the Core features section of `CLAUDE.md`, add a new entry:
```
- [x] Scroll Performance — CSS containment, React.memo card components, Finance pagination (v0.3.6)
```

- [ ] **Step 3: Commit docs**

```bash
git add GEMINI.md CLAUDE.md
git commit -m "docs: update GEMINI.md and CLAUDE.md for scroll perf (v0.3.6)"
```
