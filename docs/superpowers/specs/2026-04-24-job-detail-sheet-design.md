# Job Detail Sheet — Design Spec
**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

A bottom sheet that opens when Sandra taps any job card on the Home or Calendar pages. Provides a full view of job details and all actions she needs: mark complete, mark paid, edit any field, or cancel the job. Replaces the current state where job cards are non-interactive.

---

## Architecture

### New files
- `src/context/JobDetailSheetContext.js` — exports `useJobDetailSheet()` hook: `{ openJob, closeJob }`
- `src/context/JobDetailSheet.jsx` — provider component that holds `jobId` state and renders the sheet
- `src/components/sheets/JobDetailSheet.jsx` — the sheet UI (read mode + edit mode)

### Mounting
The `JobDetailSheet.jsx` provider wraps `AuthedShell` in `App.jsx`, the same way `NewJobSheetProvider` does. The sheet renders at the top of the component tree so it overlays any page.

### Triggering
Home and Calendar job cards each get `onClick={() => openJob(j.id)}`. No other changes to those pages.

### Data flow
- On open: fetch the single job by ID from `jobsRepo` (full raw record, not the display shape)
- Actions call named functions (`markComplete`, `markPaid`, `cancelJob`, `saveEdit`) in the sheet — named explicitly so a future AI voice layer can call the same functions without a rewrite
- On success: `notifyDataChanged()` triggers page refresh, then sheet closes after ~1s green confirmation state

---

## Read Mode

Sheet opens in read mode. Layout top to bottom:

**Header (dark hero strip)**  
Client name (Fraunces serif) + service label pill + `✕` close button. Matches the hero style of all other sheets.

**Status row**  
Two color-coded pill badges:
- `job_status`: Scheduled (blue), Completed (green), Cancelled (grey)
- `payment_status`: Unpaid (pink/red), Partial (amber), Paid (green)

**Time block**  
Date · Time range (start → end) · Estimated hours

**Amount**  
Dollar amount (tabular-nums, Fraunces) + pricing type label (Flat / Hourly)

**Notes**  
Job notes if present; muted placeholder text if empty.

**Action buttons** (pinned to bottom, above safe area)  
Shown conditionally:
- **Mark Complete** — only if `job_status === 'Scheduled'`
- **Mark Paid** — only if `payment_status !== 'Paid'`
- **Edit** — always shown on active jobs (hidden on Cancelled)
- **Cancel Job** — shown in red only if `job_status === 'Scheduled'`; requires a confirm dialog before executing

Past completed or cancelled jobs show a read-only banner ("This job is complete" / "This job was cancelled") and suppress Edit and Cancel buttons.

---

## Edit Mode

Tapping "Edit" replaces the read view in the same sheet (no navigation). All fields are editable:

| Field | Input type | Notes |
|---|---|---|
| Date | Date picker | `scheduled_date` |
| Time | Time input | `scheduled_time` |
| Service type | Dropdown | Service catalog (Deep Clean, Regular, Quick Tidy, Organize, Declutter+Org., Move Out, Custom). Changing service updates the amount automatically if pricing type is Flat. |
| Pricing type | Toggle | Flat / Hourly → `pricing_type` |
| Amount | Dollar input | Manual override always allowed |
| Estimated hours | Number input | `estimated_hours` |
| Payment method | Toggle | Cash / e-Transfer → stored in `ai_context.payment_method` until schema has dedicated column |
| Recurrence | Select | None / Weekly / Biweekly / Monthly → `ai_context.recurrence_rule`. Changing from None to a recurrence sets the rule on this job only (full template engine is a future phase). |
| Notes | Textarea | `job_notes` |

**Bottom buttons:**  
- **Save** — calls `updateJob`, shows green confirmation ~1s, closes sheet  
- **Cancel** (edit) — discards changes, returns to read mode without closing the sheet

Non-editable: client, business. Wrong client = book a new job.

---

## Confirmation & Refresh Pattern

All destructive or state-changing actions follow the same pattern:
1. Button shows loading state (disabled, spinner or opacity)
2. On success: brief green confirmation ("Saved ✓" / "Marked complete ✓" / "Marked paid ✓" / "Job cancelled")
3. `notifyDataChanged()` fires — all pages auto-refresh in background
4. Sheet closes after ~1 second

On error: red inline error message, sheet stays open, Sandra can retry.

---

## Conflict with NewJobSheet

Both sheets can theoretically be open at once (unlikely but possible). No special handling needed — `JobDetailSheet` mounts above `NewJobSheet` in z-index.

---

## What This Does NOT Cover (future phases)

- Writing to the `payments` table on mark-paid (backend audit row — next after this)
- Google Calendar sync on job edit/cancel
- Full recurrence template engine (`job_templates` table)
- AI voice trigger layer (architecture is AI-ready: all actions are named functions)
- Job duplication / "book same again"
