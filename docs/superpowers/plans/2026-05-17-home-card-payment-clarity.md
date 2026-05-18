# Home Card Payment Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every home card show a full color-coded payment breakdown — green for paid, pink for owing — with rate math for hourly jobs, and job notes on upcoming cards.

**Architecture:** All changes are in `src/pages/Home.jsx`. A new inline helper `renderPaymentBreakdown` handles the shared math-row + green/pink split markup. Each card variant calls it instead of building its own payment string.

**Tech Stack:** React (Vite), inline styles, Tailwind not used for these cards.

---

### Task 1: Add `renderPaymentBreakdown` helper

**Files:**
- Modify: `src/pages/Home.jsx` — add helper function after `computeTotal` (~line 86)

- [ ] **Step 1: Add the helper function**

Insert this block immediately after the closing `}` of `computeTotal` (around line 86):

```jsx
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
  const rate = Number(src.flat_rate || 0);
  const hours = Number(src.actual_duration || src.estimated_hours || 0);
  const additionalCost = Number(src.additional_cost || 0);
  const hst = Number(src.hst_amount || 0);

  const mathParts = [];
  if (isHourly && rate > 0 && hours > 0) {
    mathParts.push(`$${rate.toFixed(0)}/hr × ${hours}h`);
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
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors. Warnings OK.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): add renderPaymentBreakdown helper with green/pink color split"
```

---

### Task 2: Update JobCard completed variant

**Files:**
- Modify: `src/pages/Home.jsx` — `JobCard` component, Row 3 block (~line 183–190)

The completed card's Row 3 currently is:
```jsx
{remaining > 0 && (
  <div style={{ marginTop: 4 }}>
    <span style={{ color: T.pink, fontSize: 13, fontWeight: 800, letterSpacing: '-0.2px' }}>
      {privacyOn ? '•••' : paid > 0 ? `$${paid.toFixed(0)} paid · $${remaining.toFixed(0)} owing` : `$${total.toFixed(0)} owing`}
    </span>
  </div>
)}
```

- [ ] **Step 1: Replace Row 3 with helper call**

Replace the entire block above with:
```jsx
{remaining > 0 && renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor })}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): completed job cards use color-coded payment breakdown"
```

---

### Task 3: Update JobCard scheduled variant + add job notes

**Files:**
- Modify: `src/pages/Home.jsx` — `JobCard` scheduled (non-completed) body, ~line 253–269

The scheduled card's payment block currently is:
```jsx
<div style={{ fontSize: 12, fontWeight: 600, color: metaColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
  <span>Est: {j.raw?.estimated_hours || 0}h</span>
  {showPaymentInfo && (
    <>
      <span style={{ opacity: 0.4 }}>·</span>
      {remaining > 0 ? (
        <span style={{ color: T.pink, fontSize: 13, fontWeight: 800, letterSpacing: '-0.2px' }}>
          {privacyOn ? '•••' : paid > 0 ? `$${paid.toFixed(0)} paid · $${remaining.toFixed(0)} owing` : `$${total.toFixed(0)} owing`}
        </span>
      ) : (
        <span style={{ color: urgencyColor }}>
          {privacyOn ? '•••' : `$${total.toFixed(0)} total`}
        </span>
      )}
    </>
  )}
</div>
```

- [ ] **Step 1: Replace payment block and add job notes**

Replace the entire block above with:
```jsx
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
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): scheduled job cards show breakdown + job notes"
```

---

### Task 4: Update UpcomingCard with job notes

**Files:**
- Modify: `src/pages/Home.jsx` — `UpcomingCard` component body, ~line 348–363

The UpcomingCard body currently ends with:
```jsx
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
```

- [ ] **Step 1: Add job notes below service row**

Replace the block above with:
```jsx
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
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): upcoming cards show job notes"
```

---

### Task 5: Update Attention Items block

**Files:**
- Modify: `src/pages/Home.jsx` — inline attention items render block, ~line 1062–1073

The attention item payment block currently is:
```jsx
<div style={{ fontSize: 11, fontWeight: 700, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
  {isPartial && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase', color: '#92400E' }}>Partial</span>}
  {privacyOn ? (
    <span style={{ color: '#D97706' }}>•••</span>
  ) : remaining > 0 ? (
    <span style={{ color: T.pink, fontSize: 13, fontWeight: 800, letterSpacing: '-0.2px' }}>
      {paid > 0 ? `$${paid.toFixed(0)} paid · $${remaining.toFixed(0)} owing` : `$${total.toFixed(0)} owing`}
    </span>
  ) : (
    <span style={{ color: '#D97706' }}>{`$${total.toFixed(0)} total`}</span>
  )}
</div>
```

Note: `metaColor` is not in scope here — use `'#92400E'` (the amber text color already used in this block) as `metaColor` for the helper call.

- [ ] **Step 1: Replace the payment block**

Replace the entire block above with:
```jsx
<div style={{ marginTop: 5 }}>
  {remaining > 0
    ? renderPaymentBreakdown({ j, paid, total, privacyOn, T, metaColor: '#92400E' })
    : <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>${total.toFixed(0)} total</span>
  }
</div>
```

- [ ] **Step 2: Remove now-unused `isPartial` variable in the attention items map**

Find this line inside the attention items `.map()` callback (~line 1037):
```jsx
const isPartial = j.payment_status === 'Partial';
```
Delete it. Also remove the `isPartial` reference from the button label logic — change:
```jsx
{needsWrap ? 'WRAP UP' : isPartial ? 'COLLECT' : 'PAY'}
```
to:
```jsx
{needsWrap ? 'WRAP UP' : remaining > 0 ? 'COLLECT' : 'PAY'}
```

- [ ] **Step 3: Verify build passes with no lint warnings about isPartial**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat(home): attention items use color-coded breakdown, remove redundant PARTIAL badge"
```

---

### Task 6: Bump version

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md` — version + recent changes section

- [ ] **Step 1: Bump version in package.json**

Change `"version"` from `"0.5.9"` to `"0.6.0"`.

- [ ] **Step 2: Update CLAUDE.md**

Change the version header and recent changes:
```markdown
## Current version: 0.6.0

### Recent changes (v0.6.0 — May 17, 2026)
- **Home card payment clarity** — color-coded payment display across all card types: green for paid/pre-paid, supermom pink for owing; hourly jobs show rate math (`$35/hr × 3h = $105`); flat rate labeled; job notes shown on upcoming and scheduled cards (2-line clamp); attention items payment breakdown replaces old PARTIAL badge
```

- [ ] **Step 3: Commit**

```bash
git add package.json CLAUDE.md
git commit -m "chore: bump to v0.6.0"
```
