# UI Polish — Design Spec
**Date:** 2026-05-18  
**Status:** Approved

---

## Scope

Four focused improvements before committing the financial math unification:

1. Calendar day/week timeline — dynamic bounds so no job is ever clipped  
2. Home page — "Today" pill to recover from week-navigation drift  
3. Job cancellation — any user can cancel their own jobs with a required reason  
4. Admin hard-delete — admins can soft-delete jobs and archive clients (cascades to jobs)

---

## 1. Calendar Timeline Dynamic Bounds

**File:** `src/pages/Calendar.jsx` → `DayView`

**Problem:** `startH = 6`, `endH = 22` are hardcoded. A job ending at 10:30 PM is partially hidden; a job starting at 5:45 AM is invisible.

**Fix:** Compute `startH` and `endH` from the actual jobs for the selected day.

```
startH = max(6,  floor(earliest job start hour) - 1)   ← never earlier than 5 AM  
endH   = min(23, ceil(latest job end hour) + 1)         ← never later than 11 PM
```

- Default window (no jobs, or all jobs inside 6–22) is unchanged — zero visual diff for normal usage.
- Extra hours render as empty timeline rows so Sandra can see the full context.
- `slotH` stays 50px for Day view.

**Applies to:** `DayView` only. Week view is a grid overview — column height stays fixed.

---

## 2. Home "Today" Pill

**File:** `src/pages/Home.jsx`

**Problem:** When Sandra swipes the WeekStrip forward or backward, there is no way to jump back to the current week without swiping back manually.

**Fix:** Render a `TODAY` pill immediately above (or inline with) the WeekStrip, visible only when `weekStart` is not the current week.

- Pill style: matches the `TODAY` button already in `Calendar.jsx` hero — same font, same ghost-button treatment, consistent across the app.
- On tap: `setWeekStart(getWeekRange(today)[0])` + `setSelectedDate(today)`.
- Condition: `!sameDay(weekStart, getWeekRange(today)[0])` — only renders when off-week.
- Position: Right-aligned above the WeekStrip, using the existing header row space.

---

## 3. Job Cancellation (All Users)

### Data

No schema migration required. Cancellation data stored in `ai_context`:

```json
{
  "cancellation_reason": "Client called to reschedule",
  "cancelled_at": "2026-05-18T14:22:00Z"
}
```

`job_status` → `'Cancelled'`

**Repo function** (`src/data/jobsRepo.js`):
```js
export async function cancelJob(id, reason) {
  // updateJob with status + ai_context merge
}
```

Uses the existing `updateJob` path. `reason` is required — validated in the UI before calling.

### UI — JobDetailSheet

- A **"Cancel Booking"** button appears when `job.status === 'Scheduled'` (or `'Confirmed'`).
- Role: visible to all authenticated users (RLS + `business_id` already scopes to own jobs only).
- On tap: a small inline confirmation section slides open within the sheet — not a separate sheet.
  - Text field: "Reason for cancellation" (required, min 3 chars)
  - Red confirm button: "Cancel This Booking"
  - Ghost dismiss: "Never mind"
- On confirm: calls `cancelJob(id, reason)`, closes the inline section, sheet refreshes.

### Display — Cancelled Jobs

Cancelled jobs remain visible in:
- **Agenda view:** Grey card background, `CANCELLED` badge (grey, no pink), reason shown as italic sub-text below badges.
- **Client profile job history:** Shown with same grey treatment.
- **Day view timeline:** Rendered with a strikethrough or hatched/greyed-out block, not fully hidden.

`enrichDisplayJobs` currently filters `j.status !== 'Cancelled'` — **remove this filter** (or change to only filter `'Deleted'` if that status ever exists). Cancelled jobs should be visible.

Badge: `{ text: 'CANCELLED', bg: '#F3F4F6', fg: '#6B7280' }` — neutral grey, not alarming.

---

## 4. Admin Hard Delete

### Role Gate

```js
const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
```

This condition gates all admin-only destructive UI. Both role strings are accepted.

### 4a. Delete a Job (JobDetailSheet)

- Visible only when `isAdmin === true`.
- Appears below a `──── Admin ────` divider at the bottom of the sheet.
- Button: "Delete Job" in `--pink-mid` (#B01550) text, no fill — clearly destructive but not as loud as a filled red button.
- On tap: `window.confirm('Permanently remove this job from all views? This cannot be undone.')` (simple confirm — no second sheet needed for a job).
- On confirm: calls `softDeleteJob(id)` (already exists in `jobsRepo.js`), closes sheet, triggers `notifyDataChanged()`.

### 4b. Archive Client (ClientProfile)

- Visible only when `isAdmin === true`.
- Appears in a "Danger Zone" section at the bottom of the client profile page, behind a disclosure chevron (collapsed by default, tap to expand). Prevents accidental taps while scrolling.
- Button: "Archive Client & All Jobs" — filled `#B01550` background.
- On tap: opens a confirmation bottom sheet (re-uses bottom-sheet styles from DESIGN.md):
  - Displays client name prominently
  - Lists the number of active jobs that will be archived
  - Two buttons: red "Archive Everything" + ghost "Cancel"
- On confirm: 
  1. `softDeleteClient(id)` (already exists in `clientsRepo.js`)
  2. New `archiveClientJobs(clientId)` function in `jobsRepo.js` — bulk soft-delete all non-deleted jobs for that client.
  3. Navigate back to `/clients`.
  4. `notifyDataChanged()`.

**New repo function** (`src/data/jobsRepo.js`):
```js
export async function archiveClientJobs(clientId) {
  const businessId = await getCurrentBusinessId();
  await supabase
    .from('jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .is('deleted_at', null);
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Calendar.jsx` | DayView: dynamic `startH`/`endH`; Agenda/Day: show Cancelled jobs with grey treatment |
| `src/pages/Home.jsx` | Today pill — conditional, above WeekStrip |
| `src/pages/ClientProfile.jsx` | Admin danger zone — archive client + jobs |
| `src/data/jobsRepo.js` | `cancelJob()`, `archiveClientJobs()` |
| `src/components/sheets/JobDetailSheet.jsx` | Cancel inline UI + Admin delete |

---

## Out of Scope

- Cancellation notifications (email/SMS to client) — Phase 2
- Undo/restore for archived clients — Phase 2
- Cancelled job count in Finance summary — Phase 2
- Any changes to RLS policies (existing `business_id` scoping is sufficient)
