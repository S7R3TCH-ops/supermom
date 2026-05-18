# Partial Payment UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make partial payment state visible and correct everywhere — PostJobSheet auto-detects partial status, defaults to remaining balance, recalculates silently when costs/hours change, and shows a clear pre-paid callout; JobCard shows 'PARTIAL' badge instead of 'UNPAID'.

**Architecture:** All changes in `src/components/sheets/PostJobSheet.jsx` (logic + UI) and the `JobCard` component inside `src/pages/Home.jsx`. `FinancialMathBreakdown` and the attention zone in Home already show partial info correctly — no changes there. `alreadyPaid` is derived via `useMemo` from the existing `jobPayments` state (already fetched on load).

**Tech Stack:** React hooks, Supabase, existing `FinancialMathBreakdown` component, Tailwind-style inline styles, `T` theme tokens.

---

## File Map

| File | Change |
|---|---|
| `src/components/sheets/PostJobSheet.jsx` | Add `alreadyPaid` useMemo; auto-set `payStatus = 'partial'` on load; modify hours/costs sync effect to track remaining when `alreadyPaid > 0`; add pre-paid callout UI; update section label and placeholder |
| `src/pages/Home.jsx` | `JobCard`: add `isPartial` detection, change status badge from 'UNPAID' → 'PARTIAL' |

---

### Task 1: PostJobSheet — auto-detect partial on load + alreadyPaid useMemo

**Files:**
- Modify: `src/components/sheets/PostJobSheet.jsx`

Context: `jobPayments` state is set in the payments fetch inside the `useEffect` on line 69. `payStatus` defaults to `'paid'` — but when re-opening a partial job, it should default to `'partial'`.

- [ ] **Step 1: Add `alreadyPaid` useMemo after the `liveBreakdownForm` useMemo (~line 67)**

Find:
```jsx
  useEffect(() => {
    if (!jobId) return;
```

Insert before that line:
```jsx
  const alreadyPaid = useMemo(
    () => jobPayments.reduce((s, p) => s + Number(p.amount), 0),
    [jobPayments]
  );
```

- [ ] **Step 2: Auto-set payStatus = 'partial' when job loads with Partial status**

Inside the payments fetch `.then(({ data: pays }) => {` block (~line 92), find:
```jsx
              if (j?.payment_status === 'Partial') {
                const alreadyPaid = records.reduce((s, p) => s + Number(p.amount), 0);
                const remaining = Math.round(Math.max(0, fullTotal - alreadyPaid) * 100) / 100;
                setAmount(String(remaining > 0 ? remaining : fullTotal));
              } else {
                setAmount(String(fullTotal));
              }
```

Replace with:
```jsx
              const paid = records.reduce((s, p) => s + Number(p.amount), 0);
              if (j?.payment_status === 'Partial') {
                setPayStatus('partial');
                const remaining = Math.round(Math.max(0, fullTotal - paid) * 100) / 100;
                setAmount(String(remaining > 0 ? remaining : fullTotal));
              } else {
                setAmount(String(fullTotal));
              }
```

- [ ] **Step 3: Verify in browser**

Open PostJobSheet on a job with `payment_status = 'Partial'`. The payment toggle should open on 'PARTIAL' (not 'PAID'). Amount field should show the remaining balance, not the full total.

- [ ] **Step 4: Commit**
```bash
git add src/components/sheets/PostJobSheet.jsx
git commit -m "feat(post-job): auto-detect partial status on load, default amount to remaining balance"
```

---

### Task 2: PostJobSheet — silent auto-update when liveTotal changes with pre-paid

**Files:**
- Modify: `src/components/sheets/PostJobSheet.jsx`

Context: The existing `useEffect` on ~line 133 syncs amount when hours change for non-partial hourly jobs. We need it to also handle the case where `alreadyPaid > 0` — whenever `liveTotal` changes (hours OR costs), silently update `amount = liveTotal - alreadyPaid`.

- [ ] **Step 1: Modify the existing hours/cost sync effect**

Find:
```jsx
  useEffect(() => {
    if (!hoursInitialized.current) {
      hoursInitialized.current = true;
      return;
    }
    if (!job || !isHourly) return;
    if (payStatus !== 'partial') {
      Promise.resolve().then(() => setAmount(String(Math.round(liveTotal * 100) / 100)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualMinutes, liveTotal, isHourly]);
```

Replace with:
```jsx
  useEffect(() => {
    if (!hoursInitialized.current) {
      hoursInitialized.current = true;
      return;
    }
    if (!job) return;
    if (alreadyPaid > 0) {
      const remaining = Math.max(0, Math.round((liveTotal - alreadyPaid) * 100) / 100);
      Promise.resolve().then(() => setAmount(String(remaining)));
    } else if (isHourly && payStatus !== 'partial') {
      Promise.resolve().then(() => setAmount(String(Math.round(liveTotal * 100) / 100)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualMinutes, liveTotal, isHourly, alreadyPaid]);
```

- [ ] **Step 2: Verify — add a cost on a partial job**

Open PostJobSheet on a partial job (e.g. $50 pre-paid, $120 total = $70 remaining). Add a $30 additional cost. Amount field should silently update to $100 (new remaining = $150 - $50). No prompt.

- [ ] **Step 3: Verify — change hours on a partial hourly job**

On a partial hourly job, adjust the duration slider. Amount should silently update to the new remaining balance.

- [ ] **Step 4: Commit**
```bash
git add src/components/sheets/PostJobSheet.jsx
git commit -m "feat(post-job): auto-update remaining balance when costs/hours change on partial jobs"
```

---

### Task 3: PostJobSheet — pre-paid callout UI + label and placeholder changes

**Files:**
- Modify: `src/components/sheets/PostJobSheet.jsx`

Context: Section 3 of the sheet (Payment Method & Amount) needs three UI changes when `alreadyPaid > 0`: (a) amber "Pre-paid" info row above the input, (b) section label becomes "Remaining Balance", (c) input placeholder shows the remaining amount.

- [ ] **Step 1: Update the section label**

Find (~line 298):
```jsx
              <SectionLabel>Payment Method & Amount</SectionLabel>
```

Replace with:
```jsx
              <SectionLabel>{alreadyPaid > 0 ? 'Remaining Balance' : 'Payment Method & Amount'}</SectionLabel>
```

- [ ] **Step 2: Add pre-paid callout above the amount input**

Find the amount input wrapper (the `<div style={{ position: 'relative' }}>` that contains the `$` span and the input, ~line 316). Insert this block directly before that wrapper div:

```jsx
              {alreadyPaid > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(245,158,11,0.10)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    Pre-paid: ${alreadyPaid.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: '#B45309', marginLeft: 'auto' }}>
                    of ${(alreadyPaid + (parseFloat(amount) || 0)).toFixed(2)} total
                  </span>
                </div>
              )}
```

- [ ] **Step 3: Update amount input placeholder**

Find the `<input` for amount (~line 318):
```jsx
                  placeholder="0.00"
```

Replace with:
```jsx
                  placeholder={alreadyPaid > 0 ? `Remaining: $${Math.max(0, liveTotal - alreadyPaid).toFixed(2)}` : '0.00'}
```

- [ ] **Step 4: Update the helper text below the input**

Find (~line 330):
```jsx
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
                {payStatus === 'paid' ? 'Full amount for this job' : 'Partial amount being paid today'}
              </div>
```

Replace with:
```jsx
              <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
                {alreadyPaid > 0
                  ? `Balance after pre-payment of $${alreadyPaid.toFixed(2)}`
                  : payStatus === 'paid'
                    ? 'Full amount for this job'
                    : 'Partial amount being paid today'}
              </div>
```

- [ ] **Step 5: Verify in browser**

Open PostJobSheet on a partial job. Should see:
- Section label: "Remaining Balance"
- Amber callout: "✓ Pre-paid: $X.XX · of $Y.YY total"
- Input pre-filled with remaining balance
- Helper text: "Balance after pre-payment of $X.XX"

Open on a fresh unpaid job. Should see default behaviour — no callout, label "Payment Method & Amount", placeholder "0.00".

- [ ] **Step 6: Commit**
```bash
git add src/components/sheets/PostJobSheet.jsx
git commit -m "feat(post-job): pre-paid callout, Remaining Balance label, dynamic placeholder"
```

---

### Task 4: JobCard — PARTIAL badge instead of UNPAID

**Files:**
- Modify: `src/pages/Home.jsx` — `JobCard` component (~line 89)

Context: `isUnpaid = isCompleted && !isPaid` catches both partial and fully unpaid jobs. The status badge says 'UNPAID' for both. Partial jobs should show 'PARTIAL' in amber — the colour and Row 3 display are already correct.

- [ ] **Step 1: Add isPartial and fix statusLabel**

Find (~line 90):
```jsx
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isUnpaid = isCompleted && !isPaid;

  const urgencyColor = isUnpaid ? '#F59E0B' : isCompleted ? '#16A34A' : T.pink;
  const urgencyBg = isUnpaid ? 'rgba(245,158,11,0.12)' : isCompleted ? 'rgba(22,163,74,0.08)' : T.pinkGlow;
  const statusLabel = isUnpaid ? 'UNPAID' : isCompleted ? 'PAID ✓' : 'SCHEDULED';
```

Replace with:
```jsx
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

  const urgencyColor = isUnpaid ? '#F59E0B' : isCompleted ? '#16A34A' : T.pink;
  const urgencyBg = isUnpaid ? 'rgba(245,158,11,0.12)' : isCompleted ? 'rgba(22,163,74,0.08)' : T.pinkGlow;
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isCompleted ? 'PAID ✓' : 'SCHEDULED';
```

- [ ] **Step 2: Verify in browser**

A completed job with `payment_status = 'Partial'` should show amber 'PARTIAL' badge (not 'UNPAID'). Row 3 already shows `$X paid · $Y owing`. A fully unpaid completed job still shows 'UNPAID'. Paid job still shows 'PAID ✓'.

- [ ] **Step 3: Commit**
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): JobCard shows PARTIAL badge for partially paid jobs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Clear everywhere how much was partially paid → Task 3 (pre-paid callout), Task 4 (PARTIAL badge), attention zone already shows `$X paid · $Y owing`
- ✅ Default amount = remaining balance, labelled as such → Tasks 1 + 3
- ✅ Additional costs recalculate remaining silently → Task 2
- ✅ Pre-paid amount clearly displayed → Task 3 amber callout
- ✅ Always defaults to remaining based on pre-paid + current total → Tasks 1 + 2
- ✅ FinancialMathBreakdown already correct — no change needed
- ✅ Attention zone already correct — no change needed

**Type consistency:** `alreadyPaid` defined in Task 1 useMemo, used in Tasks 2 and 3. `liveTotal` already defined in the component. `jobPayments` already state. All consistent.

**Placeholder scan:** No TBDs. All code blocks complete.
