# Home Card Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all Home page job card visuals into one consistent anatomy with correct design-system colours, fix monospace font violations everywhere, and ensure every dynamic feature (privacy mode, payment breakdown, rebook, status badges, notes) stays fully functional.

**Architecture:** Three files change — `JobCard.jsx` and `UpcomingCard.jsx` get unified anatomy (left-border colour = state signal, real design-system bg tints, Inter for time, Fraunces for name/amount); `Home.jsx` gets targeted fixes for the Next Up monospace, the Rest of Week inline JSX, and the two wrong section label colours. No new components. No logic changes.

**Tech Stack:** React, Tailwind/inline styles, design-system tokens via `T` theme object from `useAppTheme`

---

## Colour Reference (design system — do not deviate)

| State | Left border | Card bg (light) | Accent text |
|---|---|---|---|
| Next Up (bespoke, not a card component) | `6px #B5004E` | gradient (keep as-is) | `#B5004E` |
| Coming Up Today (`UpcomingCard`) | `4px #E91E6A` | `#FFF0F7` | `#E91E6A` |
| Needs Action — unpaid/partial (`JobCard`) | `4px #F59E0B` | `#FEF3C7` | `#B45309` |
| Needs Action — scheduled (`JobCard`) | `4px #E91E6A` | `#FFF0F7` | `#E91E6A` |
| Done This Week (`JobCard` subtle) | `4px #86EFAC` | `#F0FFF5` | `#14532D` |
| Rest of Week (inline JSX) | `3px #FFD6E8` | `#FFF9F5` | `T.pink` / `T.inkSub` |

---

## Files

| File | Action |
|---|---|
| `src/components/cards/JobCard.jsx` | Rewrite — unified anatomy, fix colours, fix monospace |
| `src/components/cards/UpcomingCard.jsx` | Rewrite — replace blue palette, align anatomy |
| `src/pages/Home.jsx` | Targeted edits — Next Up monospace line ~531, Rest of Week inline JSX lines ~727–773, two section label colours |

---

## Task 1: Rewrite `JobCard.jsx`

**Files:**
- Modify: `src/components/cards/JobCard.jsx`

The current file has two completely different card layouts (scheduled vs completed) with a branch at line 20. Replace both branches with a single unified layout. All dynamic features must be preserved: privacy mode, PaymentBreakdown, rebook/duplicate button, status badge, notes, address.

- [ ] **Step 1: Replace the entire file with the unified implementation**

```jsx
import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';

export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false, subtle = false }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

  // State signal colours — all from design system
  const borderColor = isUnpaid || isPartial ? '#F59E0B' : isPaid ? '#86EFAC' : '#E91E6A';
  const bgColor = subtle
    ? 'transparent'
    : isUnpaid || isPartial ? '#FEF3C7'
    : isPaid ? '#F0FFF5'
    : '#FFF0F7';
  const accentColor = isUnpaid || isPartial ? '#B45309' : isPaid ? '#14532D' : '#E91E6A';
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isPaid ? 'PAID ✓' : 'SCHEDULED';

  const remaining = isPaid ? 0 : Math.max(0, total - paid);
  const showAmount = (isCompleted || total > 0) && total > 0;
  const timeRange = fmtTimeRange(j.start, j.end);
  const dateLabel = dateBrief(j.start);

  return (
    <div
      onClick={onClick}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}30`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 14,
        padding: '11px 14px 11px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        opacity: subtle ? 0.8 : 1,
      }}
    >
      {/* Row 1: time — amount + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: accentColor }}>
          {timeRange}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showAmount && (
            <span style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: accentColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
            </span>
          )}
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${borderColor}22`, color: accentColor,
            padding: '3px 7px', borderRadius: 4,
          }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Row 2: client name */}
      <div style={{
        fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.ink,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '-0.3px', marginBottom: 4,
      }}>
        {j.client_name}
      </div>

      {/* Row 3: service pill + date + rebook button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          background: `${borderColor}18`, color: accentColor,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
        }}>
          {j.service_name}
        </span>
        <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
          {dateLabel}
        </span>
        {onDuplicate && (
          <button
            onClick={e => { e.stopPropagation(); onDuplicate(j); }}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              padding: '0 2px', color: accentColor, fontSize: 14,
              fontWeight: 900, cursor: 'pointer', lineHeight: 1, opacity: 0.7,
            }}
            title="Rebook this job"
          >↻</button>
        )}
      </div>

      {/* Row 4: payment breakdown when balance is owed */}
      {remaining > 0 && (
        <div style={{ marginTop: 6 }}>
          <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={accentColor} />
        </div>
      )}

      {/* Row 5: job notes */}
      {j.job_notes && (
        <div style={{
          fontSize: 11, color: T.inkMuted, fontStyle: 'italic', marginTop: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.job_notes}
        </div>
      )}

      {/* Row 6: address (scheduled jobs) */}
      {j.address && (
        <div style={{
          fontSize: 11, color: T.inkMuted, marginTop: 4, opacity: 0.7,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📍 {j.address}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: `✓ built` with no errors. If any import errors appear, they are in files that call `JobCard` — check the import path matches `../../lib/dateUtils`.

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/JobCard.jsx
git commit -m "refactor: unify JobCard anatomy — design-system colours, no monospace, all dynamic features preserved"
```

---

## Task 2: Rewrite `UpcomingCard.jsx`

**Files:**
- Modify: `src/components/cards/UpcomingCard.jsx`

Current file is hardcoded cobalt blue (`#1565C0`) throughout — completely off-brand. Replace with pink palette, match the unified anatomy from Task 1. `PaymentBreakdown` must be preserved for pre-paid jobs.

- [ ] **Step 1: Replace the entire file**

```jsx
import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';

const BORDER = '#E91E6A';
const BG = '#FFF0F7';
const ACCENT = '#E91E6A';

export default function UpcomingCard({ job: j, T, onClick, total = 0, paid = 0, privacyOn = false }) {
  const timeRange = fmtTimeRange(j.start, j.end);
  const remaining = Math.max(0, total - paid);

  return (
    <div
      onClick={onClick}
      style={{
        background: BG,
        border: `1px solid ${BORDER}30`,
        borderLeft: `4px solid ${BORDER}`,
        borderRadius: 14,
        padding: '11px 14px 11px 12px',
        marginBottom: 8,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: time — amount + UPCOMING badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: ACCENT }}>
          {timeRange}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {total > 0 && (
            <span style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
            </span>
          )}
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${ACCENT}20`, color: ACCENT,
            padding: '3px 7px', borderRadius: 4,
          }}>
            UPCOMING
          </span>
        </div>
      </div>

      {/* Row 2: client name */}
      <div style={{
        fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.ink,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '-0.3px', marginBottom: 4,
      }}>
        {j.client_name}
      </div>

      {/* Row 3: service pill + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          background: `${ACCENT}15`, color: ACCENT,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
        }}>
          {j.service_name}
        </span>
        <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
          {dateBrief(j.start)}
        </span>
      </div>

      {/* Row 4: payment breakdown for pre-paid jobs */}
      {remaining > 0 && (
        <div style={{ marginTop: 6 }}>
          <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={ACCENT} />
        </div>
      )}

      {/* Row 5: job notes */}
      {j.job_notes && (
        <div style={{
          fontSize: 11, color: T.inkMuted, fontStyle: 'italic', marginTop: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.job_notes}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: `✓ built` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/UpcomingCard.jsx
git commit -m "refactor: replace UpcomingCard blue palette with on-brand pink, unified anatomy"
```

---

## Task 3: Fix `Home.jsx` — four targeted edits

**Files:**
- Modify: `src/pages/Home.jsx`

Four independent fixes. Do them all in one edit pass, then one commit.

### Fix A — Next Up: monospace time (around line 531)

Find this line (inside the Next Up bespoke section, inside the `{(() => { ... })()}` call):
```jsx
<div style={{ fontSize: 17, fontWeight: 900, color: DEEP_ROSE, fontFamily: 'monospace', letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
```

Change `fontFamily: 'monospace'` to `fontFamily: T.font`:
```jsx
<div style={{ fontSize: 17, fontWeight: 900, color: DEEP_ROSE, fontFamily: T.font, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
```

### Fix B — "COMING UP TODAY" section label colour (around line 633)

Find:
```jsx
<SectionLabel style={{ color: '#1565C0', marginBottom: 8 }}>COMING UP TODAY</SectionLabel>
```

Replace with:
```jsx
<SectionLabel color={T.pink} style={{ marginBottom: 8 }}>COMING UP TODAY</SectionLabel>
```

### Fix C — "NEEDS ACTION" section label colour (around line 651)

Find:
```jsx
<SectionLabel color="#F59E0B">Needs Action</SectionLabel>
```

Replace with:
```jsx
<SectionLabel color="#B45309">Needs Action</SectionLabel>
```

### Fix D — Rest of Week inline card JSX (around lines 727–773)

Find the entire inner `<div>` block that renders each Rest of Week job (starts with `<div key={j.id} onClick={() => openJob(j.id)}` inside the `restOfWeekJobs.map`). Replace it:

```jsx
<div
  key={j.id}
  onClick={() => openJob(j.id)}
  style={{
    background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FFF9F5',
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
      ${total.toFixed(0)}
    </div>
  )}
</div>
```

- [ ] **Step 1: Apply all four fixes above to `Home.jsx`**

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: `✓ built` with no errors. If you see `T.pink is undefined`, check that the component has `const { T, mode, privacyOn } = useAppTheme()` — it does, so this shouldn't occur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "fix: Home card colours — Next Up monospace, section labels, Rest of Week palette"
```

---

## Task 4: Final verification + push

- [ ] **Step 1: Run full build one more time**

```bash
npm run build
```

Expected: `✓ built` cleanly.

- [ ] **Step 2: Visual checklist — open `npm run dev` and check each Home section**

| Section | What to verify |
|---|---|
| Next Up | Deep rose card, Inter font for time (not monospace), Supermom Go button present, timing badge present, Read Brief button present |
| Coming Up Today | Pink cards, pink section label (not blue), UPCOMING badge, notes visible if any |
| Needs Action | Amber cards (`#FEF3C7` bg, amber left border), `#B45309` accent text, PaymentBreakdown visible when balance owed, privacy mode hides amounts |
| Rest of Week | Soft pink-pale bg (`#FFF9F5`), `#FFD6E8` left border, Inter time font, Fraunces client name, amount in Fraunces |
| Done This Week | Green cards (`#F0FFF5` bg, `#86EFAC` border), 80% opacity, PAID ✓ badge, rebook ↻ button visible |
| Privacy mode | Toggle privacy → all amounts on all cards show `•••` |
| Dark mode | Toggle dark mode → cards should darken gracefully (transparent bg for subtle, dark tints for others) |

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```

- [ ] **Step 4: Update CLAUDE.md version to 0.7.0 and add release note**

In `CLAUDE.md`: bump `## Current version: 0.6.9` → `0.7.0`. Add under recent changes:

```
### Recent changes (v0.7.0 — May 19, 2026)
- **Home card refresh** — Unified card anatomy across all Home sections. Left-border colour = state signal (amber=needs action, pink=upcoming, green=done). Removed all monospace fonts, replaced with Inter. Real design-system bg tints replacing near-invisible opacity washes. UpcomingCard blue palette replaced with on-brand pink. Section labels fixed (COMING UP TODAY no longer blue). All dynamic features preserved: PaymentBreakdown, privacy mode, rebook, status badges, notes, address.
```

- [ ] **Step 5: Update GEMINI.md — mark item done, bump version**

Change the `2.` item in Next priorities from:
```
2. **Job card colour/branding refresh** — Cards need more visual pop...
```
to:
```
2. ~~**Job card colour/branding refresh**~~ — ✅ Done (v0.7.0). Unified anatomy, left-border state colours, no monospace, real bg tints.
```

Update the version line from `v0.6.9` to `v0.7.0`.

- [ ] **Step 6: Final commit for docs**

```bash
git add CLAUDE.md GEMINI.md
git commit -m "chore: bump to v0.7.0, document Home card refresh"
git push origin main
```
