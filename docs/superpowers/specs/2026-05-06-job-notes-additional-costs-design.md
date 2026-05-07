# Job Notes + Multiple Additional Costs — Design Spec
Date: 2026-05-06

## Problem

1. **Bug**: `recordPayment` in `jobsRepo.js` references `notes` (undefined) instead of `jobNotes`, crashing any save that inserts a payment row (partial pay, full pay with a payment entry).
2. **Additional costs**: Only one additional cost can be added per job. Sandra needs multiple line items (e.g. cleaning supplies + lock box fee), each appearing as its own line on the invoice.
3. **Job notes**: No way to attach notes at booking time. Post-job notes overwrite the same field as booking notes. The AI doesn't distinguish pre-job context from post-job observations.

---

## 1. Bug Fix

**File**: `src/data/jobsRepo.js:297`

Change `notes: notes` → `notes: jobNotes`.

---

## 2. Multiple Additional Costs

### Schema (manual SQL in Supabase dashboard)
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_costs_json jsonb DEFAULT '[]';
```

`additional_cost` (numeric) and `additional_cost_notes` (text) are kept for backward compat. They get derived from the array on every save: sum → `additional_cost`, joined descriptions → `additional_cost_notes`.

### Data shape
```json
[
  { "amount": 15, "description": "Cleaning supplies" },
  { "amount": 8,  "description": "Lock box fee" }
]
```

### `recordPayment` (jobsRepo.js)
Signature change: replace `additionalCost, additionalCostNotes` params with `additionalCosts: [{amount, description}]`.

On save:
- `additional_costs_json` ← the array (filtered to items where amount > 0)
- `additional_cost` ← sum of amounts
- `additional_cost_notes` ← descriptions joined with "; "

### PostJobSheet
Replace the single `$amount + description` row with a dynamic list:
- One empty row shown by default (or pre-populated from `additional_costs_json` if editing)
- "＋ Add cost" button appends a new empty row
- Each row has a × remove button (hidden when only one row and both fields are empty)
- On save, build the array from non-empty rows and pass to `recordPayment`

### InvoiceView
When `additional_costs_json` is non-empty (parsed array with at least one entry with amount > 0), render each as its own `<tr>` with the description and amount. Falls back to the legacy single-row path for old jobs that only have `additional_cost`.

### JobDetailSheet
Same pattern: iterate `additional_costs_json` if present and non-empty, otherwise show the legacy single `Row` for `additional_cost`.

---

## 3. Job Notes — Pre-job vs Post-job

### DB
`completion_notes text` already exists in the jobs schema — it's unused. No migration needed.

### Field mapping
| Field | When set | Set by |
|---|---|---|
| `job_notes` | At booking | NewJobSheet Step 3 |
| `completion_notes` | At wrap-up | PostJobSheet |

### NewJobSheet — Step 3 (Step3Review)
Add an optional "Notes for this job" textarea at the bottom of the review card. Value flows into `createJob` as `job_notes`. Replace the current `job_notes: selectedClient?.note || ''` with `job_notes: bookingNotes || ''`.

### PostJobSheet
- If `job.job_notes` is non-empty, show it as a read-only "Pre-job notes" block (labeled, styled as a pill/inset) above the textarea, so Sandra sees her booking context without being able to overwrite it.
- Rename "After-Job Intel (Updates System)" → "Post-Job Notes".
- Initialize textarea from `j?.completion_notes || ''` (not `j?.job_notes`).
- `recordPayment` writes `completion_notes: jobNotes` (not `job_notes`).

### `recordPayment` (jobsRepo.js)
Add `completionNotes` parameter. Patch writes `completion_notes: completionNotes`.

### AI — `generateCommandBrief` (src/data/ai.js)
- `job_notes` → existing `📌` bullet (no change to icon/copy).
- `completion_notes` → add `🗒` bullet if present on the job ("Wrap-up note: …").
- `client_recent_notes` → if the job object carries recent completion notes from past visits (see below), add a `📋` bullet per item ("Past visit: …"), capped at 2.

### `fetchJobById` (jobsRepo.js)
After fetching the job row, run a secondary query:
```sql
SELECT completion_notes, scheduled_date
FROM jobs
WHERE client_id = <client_id>
  AND business_id = <business_id>
  AND job_status = 'Completed'
  AND completion_notes IS NOT NULL
  AND id != <job_id>
ORDER BY scheduled_date DESC
LIMIT 2
```
Attach results as `client_recent_notes: [{completion_notes, scheduled_date}]` on the returned job object.

---

## Affected Files

| File | Change |
|---|---|
| `src/data/jobsRepo.js` | Bug fix; `recordPayment` signature + body; `fetchJobById` secondary query |
| `src/components/sheets/PostJobSheet.jsx` | Multi-cost list UI; pre-job notes read-only block; post-job notes → `completion_notes` |
| `src/components/sheets/NewJobSheet.jsx` | Step 3 booking notes textarea; pass to `createJob` |
| `src/data/ai.js` | `generateCommandBrief` reads `completion_notes` + `client_recent_notes` |
| `src/pages/InvoiceView.jsx` | Multi-cost line items |
| `src/components/sheets/JobDetailSheet.jsx` | Multi-cost display |
| Supabase dashboard | Run `ALTER TABLE` for `additional_costs_json` |

---

## Out of Scope
- Editing additional costs after initial save (future)
- AI bulk-learning from all past `completion_notes` across all clients (future)
- JobDetailSheet edit form for `completion_notes` (future)
