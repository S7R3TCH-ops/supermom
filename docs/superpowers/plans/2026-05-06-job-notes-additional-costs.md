# Job Notes + Multiple Additional Costs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `notes is not defined` crash in `recordPayment`, replace the single additional-cost field with a multi-item list (each as its own invoice line), and add separate pre-job (booking) and post-job (wrap-up) notes that feed into the AI command brief.

**Architecture:** All changes are contained to `src/data/jobsRepo.js`, `src/data/ai.js`, two sheet components (`PostJobSheet`, `NewJobSheet`), and two display components (`InvoiceView`, `JobDetailSheet`). One new JSONB column (`additional_costs_json`) is added to the jobs table in Supabase. No new files are created; all logic stays in the existing files.

**Tech Stack:** React (Vite), Supabase (Postgres + JS client), Tailwind-style inline CSS, no unit test framework — manual verification via `npm run dev`.

---

## File Map

| File | What changes |
|---|---|
| `src/data/jobsRepo.js` | Bug fix line 297; `recordPayment` new signature + body; `fetchJobById` secondary query for `client_recent_notes` |
| `src/data/ai.js` | `generateCommandBrief` reads `completion_notes` + `client_recent_notes` |
| `src/components/sheets/PostJobSheet.jsx` | Multi-cost list UI; pre-job notes read-only block; textarea maps to `completion_notes` |
| `src/components/sheets/NewJobSheet.jsx` | Booking notes textarea in Step3Review; `bookingNotes` state threaded to `handleBook` |
| `src/pages/InvoiceView.jsx` | Render `additional_costs_json` items as separate rows; fallback to legacy single row |
| `src/components/sheets/JobDetailSheet.jsx` | Show each cost item from `additional_costs_json`; fallback to legacy single row |
| Supabase dashboard | Run `ALTER TABLE` SQL once |

---

## Task 1: Bug fix — `notes is not defined` in `recordPayment`

**Files:**
- Modify: `src/data/jobsRepo.js:297`

- [ ] **Step 1: Open `src/data/jobsRepo.js` and locate line 297**

The current broken code inside the `if (amount > 0)` block is:
```js
notes: notes,
```

- [ ] **Step 2: Fix the reference**

Change it to:
```js
notes: jobNotes,
```

The surrounding block should now read:
```js
const { data: payData, error: payErr } = await supabase
  .from('payments')
  .insert({
    business_id: businessId,
    job_id: jobId,
    client_id: job.client_id,
    amount: amount,
    payment_method: method,
    payment_date: new Date().toISOString().split('T')[0],
    notes: jobNotes,
  })
  .select();
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`. Open an existing completed job in PostJobSheet, select "Partial", enter an amount, and click Save. Confirm it saves without error.

- [ ] **Step 4: Commit**

```bash
git add src/data/jobsRepo.js
git commit -m "fix: notes is not defined in recordPayment — use jobNotes param"
```

---

## Task 2: Schema — add `additional_costs_json` column

**Files:**
- Supabase dashboard SQL editor

- [ ] **Step 1: Run the following SQL in the Supabase dashboard**

```sql
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS additional_costs_json jsonb DEFAULT '[]';
```

- [ ] **Step 2: Verify**

In the Supabase Table Editor, open the `jobs` table and confirm the `additional_costs_json` column exists with type `jsonb` and default `[]`.

- [ ] **Step 3: No commit needed** (schema-only change managed outside git per project rules)

---

## Task 3: Update `recordPayment` — accept costs array, write new column

**Files:**
- Modify: `src/data/jobsRepo.js` (the `recordPayment` function, ~lines 274–330)

- [ ] **Step 1: Update the function signature**

Change:
```js
export async function recordPayment(jobId, amount, method = 'Cash', paymentStatus = null, duration = null, jobNotes = null, additionalCost = 0, additionalCostNotes = null) {
```

To:
```js
export async function recordPayment(jobId, amount, method = 'Cash', paymentStatus = null, duration = null, jobNotes = null, additionalCosts = [], completionNotes = null) {
```

- [ ] **Step 2: Replace the jobPatch block (starting at `const jobPatch = {`)**

Replace from `const jobPatch = {` through `if (additionalCost > 0) { ... }` with:

```js
const validCosts = (additionalCosts || []).filter(c => Number(c.amount) > 0);
const costSum = validCosts.reduce((s, c) => s + Number(c.amount), 0);
const costNotes = validCosts.map(c => c.description).filter(Boolean).join('; ');

const jobPatch = {
  payment_status: status,
  job_status: 'Completed',
  payment_method: amount > 0 ? method : null,
  actual_duration: duration,
  completion_notes: completionNotes,
};
if (validCosts.length > 0) {
  jobPatch.additional_costs_json = validCosts;
  jobPatch.additional_cost = costSum;
  jobPatch.additional_cost_notes = costNotes || null;
}
```

- [ ] **Step 3: Update the `PostJobSheet` call site to match new signature**

In `PostJobSheet.jsx`, the call is currently:
```js
await recordPayment(jobId, paidAmt, method, ps, totalDuration, jobNotes, extraCost, additionalCostNotes);
```

This will be updated in Task 5. For now just confirm the function body compiles — run `npm run dev` and check the console for errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/jobsRepo.js
git commit -m "feat: recordPayment accepts additionalCosts array and completionNotes"
```

---

## Task 4: Update `fetchJobById` — attach `client_recent_notes`

**Files:**
- Modify: `src/data/jobsRepo.js` (the `fetchJobById` function, ~lines 46–72)

- [ ] **Step 1: Locate the return block at the bottom of `fetchJobById`**

Currently it ends with:
```js
return {
  ...decorateJob(jobRow),
  client_name: clientName,
  client_notes: c?.notes || '',
  client_ai_context: c?.ai_context || {},
  client_tags: c?.tags || [],
};
```

- [ ] **Step 2: Add a secondary query for recent completion notes before the return**

Insert this block immediately before the `return`:

```js
let client_recent_notes = [];
if (data.client_id) {
  const { data: recentNotes } = await supabase
    .from('jobs')
    .select('completion_notes, scheduled_date')
    .eq('client_id', data.client_id)
    .eq('business_id', businessId)
    .eq('job_status', 'Completed')
    .not('completion_notes', 'is', null)
    .neq('id', id)
    .order('scheduled_date', { ascending: false })
    .limit(2);
  client_recent_notes = (recentNotes || []).filter(r => r.completion_notes?.trim());
}
```

- [ ] **Step 3: Add `client_recent_notes` to the return object**

```js
return {
  ...decorateJob(jobRow),
  client_name: clientName,
  client_notes: c?.notes || '',
  client_ai_context: c?.ai_context || {},
  client_tags: c?.tags || [],
  client_recent_notes,
};
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Open any job detail sheet. No console errors expected.

- [ ] **Step 5: Commit**

```bash
git add src/data/jobsRepo.js
git commit -m "feat: fetchJobById attaches client_recent_notes for AI command brief"
```

---

## Task 5: Update `generateCommandBrief` — surface completion notes

**Files:**
- Modify: `src/data/ai.js`

- [ ] **Step 1: Open `src/data/ai.js` and find the section that handles `job_notes` (around line 69–73)**

Currently:
```js
// 6. Job specific notes
const jobNotes = job.job_notes || '';
if (jobNotes) {
  bullets.push({ icon: '📌', text: jobNotes });
  speechText += `Specifically for today: ${jobNotes}. `;
}
```

- [ ] **Step 2: Add blocks for `completion_notes` and `client_recent_notes` immediately after**

```js
// 6. Pre-job booking notes
const jobNotes = job.job_notes || '';
if (jobNotes) {
  bullets.push({ icon: '📌', text: jobNotes });
  speechText += `Pre-job note: ${jobNotes}. `;
}

// 7. This job's completion notes (if reviewing after wrap-up)
if (job.completion_notes?.trim()) {
  bullets.push({ icon: '🗒', text: `Wrap-up note: ${job.completion_notes.trim()}` });
}

// 8. Recent completion notes from past visits for this client
if (Array.isArray(job.client_recent_notes)) {
  job.client_recent_notes.forEach(r => {
    if (r.completion_notes?.trim()) {
      const dateLabel = r.scheduled_date
        ? new Date(r.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Past visit';
      bullets.push({ icon: '📋', text: `${dateLabel}: ${r.completion_notes.trim()}` });
    }
  });
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open a job with `job_notes` populated. Confirm the "📌" bullet still shows. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/ai.js
git commit -m "feat: command brief surfaces completion_notes and client recent visit notes"
```

---

## Task 6: PostJobSheet — multi-cost list UI + pre-job notes + completion_notes

**Files:**
- Modify: `src/components/sheets/PostJobSheet.jsx`

- [ ] **Step 1: Replace the two existing cost state vars with a costs array**

Find and remove:
```js
const [additionalCost, setAdditionalCost] = useState('');
const [additionalCostNotes, setAdditionalCostNotes] = useState('');
```

Replace with:
```js
const [costs, setCosts] = useState([{ amount: '', description: '' }]);
```

- [ ] **Step 2: Update the `useEffect` that loads job data**

Find the two lines inside the `.then(j => { ... })` block:
```js
if (j?.additional_cost > 0) setAdditionalCost(String(j.additional_cost));
if (j?.additional_cost_notes) setAdditionalCostNotes(j.additional_cost_notes);
```

Replace with:
```js
if (j?.additional_costs_json?.length > 0) {
  setCosts(j.additional_costs_json.map(c => ({ amount: String(c.amount), description: c.description || '' })));
} else if (j?.additional_cost > 0) {
  setCosts([{ amount: String(j.additional_cost), description: j.additional_cost_notes || '' }]);
}
```

Also update the `jobNotes` initialization line:
```js
setJobNotes(j?.completion_notes || '');
```
(Change from `j?.job_notes` to `j?.completion_notes`.)

- [ ] **Step 3: Update `handleLogPayment` to build the costs array and use new `recordPayment` signature**

Find:
```js
const extraCost = parseFloat(additionalCost) || 0;
const ps = payStatus === 'paid' ? 'Paid' : payStatus === 'partial' ? 'Partial' : '';

await recordPayment(jobId, paidAmt, method, ps, totalDuration, jobNotes, extraCost, additionalCostNotes);
```

Replace with:
```js
const ps = payStatus === 'paid' ? 'Paid' : payStatus === 'partial' ? 'Partial' : '';
const validCosts = costs
  .filter(c => parseFloat(c.amount) > 0)
  .map(c => ({ amount: parseFloat(c.amount), description: c.description }));

await recordPayment(jobId, paidAmt, method, ps, totalDuration, jobNotes, validCosts, jobNotes);
```

Wait — `jobNotes` is being passed as both the last two args here. The 7th arg is `additionalCosts` (the array), and the 8th is `completionNotes`. Fix:

```js
const ps = payStatus === 'paid' ? 'Paid' : payStatus === 'partial' ? 'Partial' : '';
const validCosts = costs
  .filter(c => parseFloat(c.amount) > 0)
  .map(c => ({ amount: parseFloat(c.amount), description: c.description }));

await recordPayment(jobId, paidAmt, method, ps, totalDuration, null, validCosts, jobNotes);
```

Note: `jobNotes` is the post-job / completion notes textarea value; the 6th param (`jobNotes` legacy field on payments row) is now passed as `null` since we no longer write it there.

- [ ] **Step 4: Replace the "Additional Costs" JSX section**

Find the existing section:
```jsx
<SectionLabel>Additional Costs</SectionLabel>
<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.card, border: `1.5px solid ${additionalCost ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', width: 110, flexShrink: 0 }}>
    <span style={{ fontFamily: T.serif, fontSize: 16, color: T.inkSub }}>$</span>
    <input type="number" placeholder="0" value={additionalCost} onChange={e => setAdditionalCost(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 16, color: T.ink }} />
  </div>
  <input type="text" placeholder="e.g. cleaning supplies, lock box" value={additionalCostNotes} onChange={e => setAdditionalCostNotes(e.target.value)} style={{ flex: 1, background: T.card, border: `1.5px solid ${additionalCostNotes ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', color: T.ink, fontFamily: T.font, fontSize: 12, outline: 'none' }} />
</div>
<div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 18 }}>Supplies or extra costs — included on the invoice</div>
```

Replace with:
```jsx
<SectionLabel>Additional Costs</SectionLabel>
{costs.map((cost, idx) => (
  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.card, border: `1.5px solid ${cost.amount ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', width: 110, flexShrink: 0 }}>
      <span style={{ fontFamily: T.serif, fontSize: 16, color: T.inkSub }}>$</span>
      <input
        type="number"
        placeholder="0"
        value={cost.amount}
        onChange={e => setCosts(prev => prev.map((c, i) => i === idx ? { ...c, amount: e.target.value } : c))}
        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 16, color: T.ink }}
      />
    </div>
    <input
      type="text"
      placeholder="e.g. cleaning supplies"
      value={cost.description}
      onChange={e => setCosts(prev => prev.map((c, i) => i === idx ? { ...c, description: e.target.value } : c))}
      style={{ flex: 1, background: T.card, border: `1.5px solid ${cost.description ? T.pink : T.cardBorder}`, borderRadius: 10, padding: '8px 12px', color: T.ink, fontFamily: T.font, fontSize: 12, outline: 'none' }}
    />
    {(costs.length > 1 || cost.amount || cost.description) && (
      <button
        onClick={() => setCosts(prev => prev.length === 1 ? [{ amount: '', description: '' }] : prev.filter((_, i) => i !== idx))}
        style={{ background: 'none', border: 'none', color: T.inkMuted, cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
      >×</button>
    )}
  </div>
))}
<button
  onClick={() => setCosts(prev => [...prev, { amount: '', description: '' }])}
  style={{ background: 'transparent', border: `1.5px dashed ${T.cardBorder}`, borderRadius: 10, padding: '7px 14px', fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.pink, cursor: 'pointer', marginBottom: 8, width: '100%' }}
>＋ Add another cost</button>
<div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 18 }}>Supplies or extra costs — each appears as its own line on the invoice</div>
```

- [ ] **Step 5: Add the pre-job notes read-only block and rename the post-job notes section**

Find:
```jsx
<SectionLabel>After-Job Intel (Updates System)</SectionLabel>
<textarea
  placeholder="Any specific notes for this job? (e.g. key location, client mood, issues found)"
  value={jobNotes}
  onChange={e => setJobNotes(e.target.value)}
  style={{ width: '100%', minHeight: 80, padding: '12px', borderRadius: 14, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontFamily: T.font, fontSize: 13, resize: 'none', outline: 'none', marginBottom: 18 }}
/>
```

Replace with:
```jsx
{job?.job_notes?.trim() && (
  <div style={{ background: mode === 'dark' ? 'rgba(233,30,106,0.07)' : '#FFF0F7', border: `1px solid ${T.pink}30`, borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.pink, letterSpacing: '0.5px', marginBottom: 5 }}>📌 Pre-job notes</div>
    <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.job_notes}</div>
  </div>
)}
<SectionLabel>Post-Job Notes</SectionLabel>
<textarea
  placeholder="What happened? Key entry, client mood, issues found, follow-ups…"
  value={jobNotes}
  onChange={e => setJobNotes(e.target.value)}
  style={{ width: '100%', minHeight: 80, padding: '12px', borderRadius: 14, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontFamily: T.font, fontSize: 13, resize: 'none', outline: 'none', marginBottom: 18 }}
/>
```

- [ ] **Step 6: Verify manually**

Run `npm run dev`. Open PostJobSheet on a job:
- Confirm the multi-cost list renders with one empty row.
- Add two costs — both rows show.
- Click × on one row — it removes.
- Click "＋ Add another cost" — new row appears.
- If the job has `job_notes`, the pink pre-job block renders above the textarea.
- Save with partial pay — no "notes is not defined" error.

- [ ] **Step 7: Commit**

```bash
git add src/components/sheets/PostJobSheet.jsx
git commit -m "feat: multi-cost list UI, pre-job notes block, post-job notes → completion_notes"
```

---

## Task 7: NewJobSheet — booking notes in Step 3

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Add `bookingNotes` state to the component**

Near the other `useState` declarations (around line 108), add:
```js
const [bookingNotes, setBookingNotes] = useState('');
```

- [ ] **Step 2: Pass `bookingNotes` to `handleBook`**

In `handleBook`, find:
```js
job_notes: selectedClient?.note || '',
```

Replace with:
```js
job_notes: bookingNotes || '',
```

- [ ] **Step 3: Pass `bookingNotes` / `setBookingNotes` into `Step3Review`**

Find the `{step === 3 && (` render block:
```jsx
<Step3Review
  T={T} mode={mode} privacyOn={privacyOn}
  client={selectedClient}
  service={selectedService}
  date={date}
  time={time}
  duration={duration}
  recurrence={recurrence}
  priceStr={priceStr}
  conflicts={conflicts}
  clientLookup={getDisplayClient}
  confirmText={confirmText}
  setConfirmText={setConfirmText}
  onFixTime={() => setStep(2)}
/>
```

Add two props:
```jsx
<Step3Review
  T={T} mode={mode} privacyOn={privacyOn}
  client={selectedClient}
  service={selectedService}
  date={date}
  time={time}
  duration={duration}
  recurrence={recurrence}
  priceStr={priceStr}
  conflicts={conflicts}
  clientLookup={getDisplayClient}
  confirmText={confirmText}
  setConfirmText={setConfirmText}
  onFixTime={() => setStep(2)}
  bookingNotes={bookingNotes}
  setBookingNotes={setBookingNotes}
/>
```

- [ ] **Step 4: Update `Step3Review` function signature and add the textarea**

Find the `Step3Review` function signature:
```js
function Step3Review({
  T, mode, privacyOn, client, service, date, time, duration, recurrence, priceStr,
  conflicts, clientLookup, confirmText, setConfirmText, onFixTime,
}) {
```

Add the new props:
```js
function Step3Review({
  T, mode, privacyOn, client, service, date, time, duration, recurrence, priceStr,
  conflicts, clientLookup, confirmText, setConfirmText, onFixTime,
  bookingNotes, setBookingNotes,
}) {
```

At the bottom of the `Step3Review` return, before the closing `</>`, add:
```jsx
<SectionLabel>Notes for this job</SectionLabel>
<textarea
  placeholder="Optional — key entry, special instructions, reminders…"
  value={bookingNotes}
  onChange={e => setBookingNotes(e.target.value)}
  rows={3}
  style={{
    width: '100%', padding: '12px', borderRadius: 14,
    background: T.card, border: `1.5px solid ${bookingNotes ? T.pink : T.cardBorder}`,
    color: T.ink, fontFamily: T.font, fontSize: 13, resize: 'none', outline: 'none',
    marginBottom: 10,
  }}
/>
```

- [ ] **Step 5: Verify manually**

Run `npm run dev`. Start a new job booking. On Step 3, scroll to the bottom — a "Notes for this job" textarea should appear. Type something, complete the booking, then open the job in JobDetailSheet — `job_notes` should show the text under the Notes section.

- [ ] **Step 6: Commit**

```bash
git add src/components/sheets/NewJobSheet.jsx
git commit -m "feat: booking notes textarea in Step 3 of new job flow"
```

---

## Task 8: InvoiceView — multi-cost line items

**Files:**
- Modify: `src/pages/InvoiceView.jsx`

- [ ] **Step 1: Find the existing single additional-cost row in InvoiceView**

Locate:
```jsx
{Number(job.additional_cost) > 0 && (
  <tr style={{ borderBottom: '1px solid #eee' }}>
    <td style={{ padding: '12px 15px' }}>
      <div style={{ fontWeight: 500 }}>Additional Costs</div>
      {job.additional_cost_notes && <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{job.additional_cost_notes}</div>}
    </td>
    <td colSpan={2} style={{ textAlign: 'center', padding: '12px 15px' }}>—</td>
    <td style={{ textAlign: 'right', padding: '12px 15px', fontWeight: 500 }}>
      ${Number(job.additional_cost).toFixed(2)}
    </td>
  </tr>
)}
```

- [ ] **Step 2: Replace with multi-item renderer**

```jsx
{(() => {
  const items = Array.isArray(job.additional_costs_json) && job.additional_costs_json.length > 0
    ? job.additional_costs_json.filter(c => Number(c.amount) > 0)
    : (Number(job.additional_cost) > 0 ? [{ amount: job.additional_cost, description: job.additional_cost_notes || 'Additional Costs' }] : []);
  return items.map((item, idx) => (
    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '12px 15px' }}>
        <div style={{ fontWeight: 500 }}>{item.description || 'Additional Cost'}</div>
      </td>
      <td colSpan={2} style={{ textAlign: 'center', padding: '12px 15px' }}>—</td>
      <td style={{ textAlign: 'right', padding: '12px 15px', fontWeight: 500 }}>
        ${Number(item.amount).toFixed(2)}
      </td>
    </tr>
  ));
})()}
```

- [ ] **Step 3: Update the summary totals section**

Find the summary block that currently shows:
```jsx
{Number(job.additional_cost) > 0 && (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 15px', fontSize: 13 }}>
    <div>Services</div>
    ...
  </div>
)}
```

Locate line ~164–172 and update the total calculation. Find:
```jsx
<div className="fraunces" style={{ fontSize: 20, fontWeight: 600 }}>${(Number(invoice.total_amount) + Number(job.additional_cost || 0)).toFixed(2)}</div>
```

The total is already derived from `additional_cost` (which `recordPayment` now keeps in sync as the sum). No change needed here — the existing `job.additional_cost` already holds the correct sum.

- [ ] **Step 4: Verify manually**

Run `npm run dev`. Open an invoice for a job that has `additional_costs_json` with two items. Both should appear as separate rows. Open an old job with only `additional_cost` — it should fall back to showing one row.

- [ ] **Step 5: Commit**

```bash
git add src/pages/InvoiceView.jsx
git commit -m "feat: invoice renders each additional cost as its own line item"
```

---

## Task 9: JobDetailSheet — multi-cost display

**Files:**
- Modify: `src/components/sheets/JobDetailSheet.jsx`

- [ ] **Step 1: Find the current additional_cost display row (around line 338)**

Currently:
```jsx
{job.additional_cost > 0 && (
  <Row T={T} label="Additional costs" value={`$${Number(job.additional_cost).toFixed(0)}${job.additional_cost_notes ? ` · ${job.additional_cost_notes}` : ''}`} />
)}
```

- [ ] **Step 2: Replace with multi-item renderer**

```jsx
{(() => {
  const items = Array.isArray(job.additional_costs_json) && job.additional_costs_json.length > 0
    ? job.additional_costs_json.filter(c => Number(c.amount) > 0)
    : (Number(job.additional_cost) > 0 ? [{ amount: job.additional_cost, description: job.additional_cost_notes }] : []);
  return items.map((item, idx) => (
    <Row key={idx} T={T} label={idx === 0 ? 'Additional cost' : ''} value={`$${Number(item.amount).toFixed(0)}${item.description ? ` · ${item.description}` : ''}`} />
  ));
})()}
```

- [ ] **Step 3: Add `completion_notes` display below the existing `job_notes` block**

Find the existing notes card:
```jsx
{job.job_notes && (
  <InfoCard T={T}>
    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Notes</div>
    <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.job_notes}</div>
  </InfoCard>
)}
```

Replace with:
```jsx
{job.job_notes && (
  <InfoCard T={T}>
    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Pre-job Notes</div>
    <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.job_notes}</div>
  </InfoCard>
)}
{job.completion_notes && (
  <InfoCard T={T}>
    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 6 }}>Post-Job Notes</div>
    <div style={{ fontFamily: T.font, fontSize: 12.5, color: T.inkSub, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{job.completion_notes}</div>
  </InfoCard>
)}
```

- [ ] **Step 4: Verify manually**

Run `npm run dev`. Open a job with multiple additional costs — each should show as its own row. Open a job with `job_notes` and `completion_notes` — both should show in separate cards with correct labels.

- [ ] **Step 5: Commit**

```bash
git add src/components/sheets/JobDetailSheet.jsx
git commit -m "feat: job detail shows per-item additional costs, pre/post-job notes separately"
```

---

## Task 10: Final smoke test

- [ ] **Full flow test — new job with booking notes**
  1. Book a new job (Step 3 → enter "Bring the blue key bin")
  2. Open the job in JobDetailSheet → "Pre-job Notes" card shows "Bring the blue key bin"
  3. Open the job in PostJobSheet → pink "📌 Pre-job notes" block shows the text; textarea is empty

- [ ] **Full flow test — post-job wrap-up**
  1. In PostJobSheet, add two additional costs: "$12 / Cleaning supplies" and "$5 / Parking"
  2. Add post-job notes: "Client mentioned she wants the basement next time"
  3. Select "Partial", enter an amount, save → no error
  4. Open InvoiceView → two separate "Cleaning supplies" and "Parking" rows appear
  5. Open JobDetailSheet → two cost rows, "Post-Job Notes" card shows the note

- [ ] **AI command brief test**
  1. Book a second job for the same client
  2. Open the job before it starts (Home screen → "What's Next Today")
  3. The command brief "📋" bullet should reference the post-job note from the previous job

- [ ] **Update CLAUDE.md** — add to the Core features list:
  ```
  - [x] Multi-item additional costs (v0.4.3) — each cost is its own invoice line; stored as additional_costs_json
  - [x] Pre-job + post-job notes (v0.4.3) — job_notes at booking, completion_notes at wrap-up; both surface in AI command brief
  ```

- [ ] **Bump version in `package.json`** to `0.4.3`

- [ ] **Final commit**

```bash
git add package.json CLAUDE.md
git commit -m "chore: bump to v0.4.3; multi-cost, job notes, bug fix"
```
