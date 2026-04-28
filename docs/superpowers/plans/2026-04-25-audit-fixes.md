# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix multiple bugs and inconsistencies identified in the Claude Code Audit for Supermom v2.0.

**Architecture:** Surgical fixes to existing components and repositories. Standardizes DST logic, ensures complete GCal sync for recurring series, fixes missing imports, and corrects payment status logic.

**Tech Stack:** React (Vite), Supabase (Postgres), Google Calendar API.

---

### Task 1: Fix Home.jsx Crashes (Missing Imports)

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Add missing imports to Home.jsx**

Modify `src/pages/Home.jsx` to include `useBusiness` in the `useData.js` import and `generatePrepNote` in the `ai.js` import.

```javascript
// src/pages/Home.jsx

// Around line 6
import { useJobs, useBusiness } from '../data/useData';

// Around line 11
import { generateCommandBrief, generatePrepNote, speakBrief, stopSpeaking } from '../data/ai';
```

- [ ] **Step 2: Verify Home.jsx loads without ReferenceError**

Since I can't run a browser, I'll check for lint errors if available or just ensure the file is syntactically correct.

Run: `npx eslint src/pages/Home.jsx`

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "fix: add missing imports to Home.jsx to prevent ReferenceError"
```

---

### Task 2: Fix NewJobSheet Smart Estimate (Prop Destructuring)

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Destructure aiDuration in Step2What**

Modify `src/components/sheets/NewJobSheet.jsx` to destructure `aiDuration` in the `Step2What` component.

```javascript
// src/components/sheets/NewJobSheet.jsx

/* ============= STEP 2 ============= */
function Step2What({
  T, mode, client, serviceKey, onPickService,
  date, setDate, time, setTime, duration, setDuration,
  recurrence, setRecurrence, aiDuration, // Add this
}) {
```

- [ ] **Step 2: Verify Step2What uses aiDuration**

Read the file to ensure `aiDuration` is used in the JSX (the audit says it is, but let's be sure).

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/NewJobSheet.jsx
git commit -m "fix: destructure aiDuration in Step2What to enable Smart Estimate panel"
```

---

### Task 3: Fix Recurring Series GCal Sync

**Files:**
- Modify: `src/data/jobsRepo.js`

- [ ] **Step 1: Update createRecurringSeries to sync all jobs**

Modify `src/data/jobsRepo.js` to loop through all results and trigger GCal sync for each.

```javascript
// src/data/jobsRepo.js

// Around line 132
  const results = data.map(decorateJob);
  // Sync all occurrences to GCal
  results.forEach(job => {
    triggerGCalSync(job.id, 'upsert');
  });
  
  return results[0];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/jobsRepo.js
git commit -m "fix: sync all recurring job occurrences to Google Calendar"
```

---

### Task 4: Fix recordPayment Logic (Partial vs Paid)

**Files:**
- Modify: `src/data/jobsRepo.js`

- [ ] **Step 1: Update recordPayment to check for partial payments**

Modify `recordPayment` in `src/data/jobsRepo.js` to fetch the job's `total_amount` and set `payment_status` based on the total paid.

```javascript
// src/data/jobsRepo.js

export async function recordPayment(jobId, amount, method = 'Cash', notes = null) {
  const businessId = await getCurrentBusinessId();

  // 1. Get job info (we need client_id and total_amount)
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('client_id, business_id, total_amount') // added total_amount
    .eq('id', jobId)
    .single();
  if (getErr) throw getErr;

  // 2. Insert into payments
  // ... (existing code for insert)

  // 3. Calculate status
  // For now, simple check: if amount >= total_amount, it's Paid.
  // Note: This doesn't account for multiple payments yet, but it's better than hardcoding 'Paid'.
  const status = amount >= (job.total_amount || 0) ? 'Paid' : 'Partial';

  // 4. Update job status
  return updateJob(jobId, {
    payment_status: status,
    job_status: 'Completed',
    payment_method: method
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/jobsRepo.js
git commit -m "fix: set payment_status to Partial if amount is less than total in recordPayment"
```

---

### Task 5: Standardize DST Logic

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`
- Reference: `src/data/jobsRepo.js`

- [ ] **Step 1: Export composeTorontoISO from jobsRepo.js**

Modify `src/data/jobsRepo.js` to export `composeTorontoISO` so it can be reused.

```javascript
// src/data/jobsRepo.js
export function composeTorontoISO(dateStr, timeStr) { // add export
```

- [ ] **Step 2: Use composeTorontoISO in NewJobSheet.jsx**

Modify `src/components/sheets/NewJobSheet.jsx` to import and use `composeTorontoISO` instead of its own `torontoISO`.

```javascript
// src/components/sheets/NewJobSheet.jsx

import { composeTorontoISO } from '../../data/jobsRepo';

// Remove the local torontoISO function
// Update calls to torontoISO to use composeTorontoISO
```

- [ ] **Step 3: Commit**

```bash
git add src/data/jobsRepo.js src/components/sheets/NewJobSheet.jsx
git commit -m "refactor: standardize DST logic by reusing composeTorontoISO in NewJobSheet"
```

---

### Task 6: Fix Stale TODAY in Calendar.jsx

**Files:**
- Modify: `src/pages/Calendar.jsx`

- [ ] **Step 1: Replace TODAY constant with NOW() function**

Modify `src/pages/Calendar.jsx` to use a function for the current date.

```javascript
// src/pages/Calendar.jsx

const NOW = () => new Date();

// Update references from TODAY to NOW()
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Calendar.jsx
git commit -m "fix: use dynamic NOW() function in Calendar.jsx to avoid stale date"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run linting**

Run: `npm run lint`

- [ ] **Step 2: Manual code review of changes**
