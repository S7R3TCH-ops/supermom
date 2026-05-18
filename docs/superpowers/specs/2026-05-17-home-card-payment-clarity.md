# Home Card Payment Clarity

**Date:** 2026-05-17  
**Status:** Approved

---

## Goal

Make every home card communicate the full financial picture at a glance. Owing amounts always in supermom pink. Pre-paid or collected amounts always in green. Hourly jobs show the rate math. Upcoming jobs surface job notes.

---

## Affected Components (all in `src/pages/Home.jsx`)

1. `JobCard` — completed card (compact layout)
2. `JobCard` — scheduled card (full layout with time header)
3. `UpcomingCard` — "Coming Up Today" blue cards
4. Attention items inline block (rendered directly in `Home`, not its own component)

---

## Design Rules

### 1. Color coding — all cards, all sections

| State | Color | What to show |
|---|---|---|
| Amount paid / pre-paid | `#16A34A` (green) | `$X paid` |
| Amount owing | `T.pink` (#E91E6A / #FF70A6) | `$Y owing` |
| Fully paid, no balance | `#16A34A` green | `$X total` or `PAID ✓` badge already handles this |

Never combine paid + owing into a single same-colored string. Always two separate `<span>` elements with their own colors.

### 2. Rate breakdown row — unpaid and partial jobs only

Shown **above** the green/pink split line, in small muted text (`fontSize: 11, color: metaColor`).

- **Hourly:** `$35/hr × 3h = $105` — reads from `j.raw.flat_rate` (the $/hr rate) and `j.raw.actual_duration || j.raw.estimated_hours`
- **Flat rate:** `Flat rate · $105` — reads from `j.raw.total_amount || j.raw.flat_rate`
- Additional costs: if `additional_cost > 0`, append `+ $X costs`
- HST: if `hst_amount > 0`, append `+ $X HST`
- Only show this breakdown row when `remaining > 0` (i.e., something is still owed)

### 3. Paid + owing split line

When `paid > 0 && remaining > 0`:
```
$15 paid  ·  $90 owing
  green        pink
```

When `paid === 0 && remaining > 0`:
```
$105 owing
   pink
```

When fully paid (`remaining === 0`): no owing line needed — the PAID ✓ badge handles it.

### 4. Job notes on upcoming cards

`UpcomingCard` and the scheduled `JobCard` (the full-layout variant): if `j.job_notes` is present, show it below the service name row. Truncate to 2 lines (`WebkitLineClamp: 2`). Font: 11px, `metaColor` / `T.inkMuted`, italic style to visually separate from structured data.

Do NOT show job notes on completed cards — they're compact and the notes are less actionable once a job is done.

---

## Data sources (no new fetches needed)

All data is already available at the call sites:

| Field | Where it lives |
|---|---|
| $/hr rate | `j.raw.flat_rate` (for Hourly jobs) |
| Flat fee | `j.raw.total_amount \|\| j.raw.flat_rate` (for Flat jobs) |
| Hours | `j.raw.actual_duration \|\| j.raw.estimated_hours` |
| Additional costs | `j.raw.additional_cost` (scalar sum) |
| HST | `j.raw.hst_amount` |
| Paid so far | `paymentMap[j.id]` (already fetched) |
| Job notes | `j.job_notes` (already on the job object) |
| Pricing type | `j.raw.pricing_type` |

`computeTotal(j)` already produces the correct total — use it as-is for the `=` figure in the breakdown.

---

## Helper function

Extract a shared `PaymentBreakdown` render helper (inline function inside `Home.jsx`, not a separate component — keeps the file self-contained):

```js
function renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor }) {
  const src = j.raw || j;
  const remaining = Math.max(0, total - paid);
  if (remaining === 0 || privacyOn) return null; // nothing to show

  const isHourly = src.pricing_type === 'Hourly';
  const rate = Number(src.flat_rate || 0);
  const hours = Number(src.actual_duration || src.estimated_hours || 0);
  const additionalCost = Number(src.additional_cost || 0);
  const hst = Number(src.hst_amount || 0);

  // Math row
  let mathParts = [];
  if (isHourly && rate > 0 && hours > 0) {
    mathParts.push(`$${rate.toFixed(0)}/hr × ${hours}h`);
  } else {
    mathParts.push('Flat rate');
  }
  if (additionalCost > 0) mathParts.push(`+ $${additionalCost.toFixed(0)} costs`);
  if (hst > 0) mathParts.push(`+ $${hst.toFixed(0)} HST`);
  mathParts.push(`= $${total.toFixed(0)}`);
  const mathString = mathParts.join(' ');

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: metaColor, opacity: 0.8, marginBottom: 2 }}>
        {mathString}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {paid > 0 && (
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
```

Privacy mode: when `privacyOn`, show `•••` instead of amounts (return a single `•••` span, same as current behavior).

---

## Card-by-card changes

### JobCard (completed, isCompleted === true)

**Row 3** (currently): one pink string `$X paid · $Y owing`  
**Row 3** (new): replace with `renderPaymentBreakdown(...)` call

The `total` amount in Row 1 (top-right) stays as-is — it's the headline number.

### JobCard (scheduled, isCompleted === false)

**Payment line in body** (currently): one pink string or `$X total`  
**New:** if `remaining > 0`, use `renderPaymentBreakdown(...)`. If fully paid or no payment yet and `total > 0`, keep the existing `$X total` span (no owing so no breakdown needed).

**Job notes** (new): after the Est / payment row, if `j.job_notes` is present:
```jsx
<div style={{
  fontSize: 11, color: metaColor, fontStyle: 'italic', marginTop: 4,
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
}}>
  {j.job_notes}
</div>
```

### UpcomingCard

**Job notes** (new): same treatment as scheduled JobCard above, placed below the service + total row.

### Attention items block

**Payment line** (currently): one pink string with optional Partial badge  
**New:** replace with `renderPaymentBreakdown(...)` call. Remove the separate `isPartial` badge — the green/pink split makes partial status self-evident. Keep the `WRAP UP / COLLECT / PAY` button logic unchanged.

---

## Privacy mode

Wherever `privacyOn` is true:
- Math row: omit entirely
- Paid span: `•••` in green
- Owing span: `•••` in pink

---

## What does NOT change

- `computeTotal()` — no changes
- `paymentMap` fetch — no changes
- STATUS badges (PAID ✓, UNPAID, PARTIAL, SCHEDULED) — no changes
- Card layout, borders, colors, border-radius — no changes
- Completed paid cards (DONE THIS WEEK section) — they're fully paid, no breakdown needed
