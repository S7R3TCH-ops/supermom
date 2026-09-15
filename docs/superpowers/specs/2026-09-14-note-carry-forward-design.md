# Client-notes carry-forward (v2)

## Problem

Sandra completes a job, writes a wrap-up note (`jobs.completion_notes`) that's now displayed prominently via the v0.13.61 `NoteCallout` component — but the note dies with that job. If it's flagging something ongoing (a client issue, a blocking access problem, "call before showing up next time"), she currently has no way to carry it to the client's *next* job without manually remembering and retyping it.

## Scope

- One note "in flight" per client at a time (not a history/ledger).
- Trigger: an opt-in checkbox at job completion (`PostJobSheet`), only when she's written a completion note.
- Consumption: auto-appears (visible, editable) in the Notes field the next time she books that client, via any entry point into `NewJobSheet`.
- Out of scope: pre-job notes (`job_notes`) carrying forward, carrying to a specific *chosen* future client visit vs. just "next," multi-note history/audit trail.

## Data model

Two new nullable columns on `clients` (not a new table — this is a single pending value, not a running ledger like `client_credits`):

```sql
alter table clients add column pending_note text;
alter table clients add column pending_note_source_job_id uuid references jobs(id) on delete set null;
```

- `pending_note_source_job_id` is informational only (lets ClientProfile show "from the Sep 14 job" if ever needed) — not used for any logic branch.
- If a client already has a pending note and Sandra completes *another* job with the carry-forward box checked before the first one is consumed, the new note **appends** to the old one, separated by a blank line (`pending_note = coalesce(pending_note || '\n\n', '') || new_note`) — **decided 2026-09-15, switched from an earlier "replace" call** after Gemini's cross-check flagged replace as silent data loss (whichever note completes second wins, first one vanishes with no trace). She can backspace what she doesn't want out of the pre-filled textarea on the next booking. `pending_note_source_job_id` tracks only the most recent contributing job on append (informational, not load-bearing).
  - **Known future idea, not in scope for v2**: since append can now stack multiple notes across multiple collisions before one gets consumed, a later pass could offer an AI summary to condense the pile instead of showing raw concatenated text. Revisit only if stacking turns out to be messy in practice.
  - **Idempotency guard (added during implementation, not in the original reconciliation)**: reachable via a partial-then-final payment re-entering `PostJobSheet`'s completion flow with the checkbox still checked, or Admin's Revert-then-re-complete. First cut was a blind overwrite on same-`sourceJobId`, caught as wrong before commit: that also wipes a *different* job's note if it's still stacked ahead of this job's own segment (unconsumed) — the same silent-data-loss failure append exists to prevent, just triggered from a different angle. Fixed to a narrower rule: same job + text is a verbatim tail-match of what's already stored → no-op skip. Same job + edited text → still appends (a cosmetic near-duplicate line, backspaceable) rather than risk deleting someone else's note. Verified live against the QA Supabase business (Bright Path Concierge, real client + jobs): job A appends, job B appends (A survives), job B's exact repeat is a no-op (A survives), job B's edited repeat appends without touching A, clear works.

## Trigger: PostJobSheet

- Existing completion-notes textarea (`jobNotes` state, `PostJobSheet.jsx:33`) gains a checkbox directly beneath it, rendered only when `jobNotes.trim()` is non-empty: **"✦ Also flag this for [Client]'s next job"**.
- On `handleLogPayment()` (`PostJobSheet.jsx:178`), after `recordPayment(...)` resolves successfully: if the checkbox was checked, call a new `clientsRepo.js` function `setPendingNote(clientId, noteText, sourceJobId)` that writes both columns.
- **Not threaded through `recordPayment`** — that function is already at 10 positional params and is the documented single choke point for money/credit logic (`jobDraftPolicy.js` money-column rule). This is a separate concern, written as its own small repo call right after, mirroring how `creditsRepo.js` was added as its own module for the client-credit feature rather than folded into `recordPayment`.
- If the checkbox is unchecked (or no note was written), nothing changes — existing completion flow is untouched.

## Consumption: NewJobSheet

- `NewJobSheet.jsx` already has a proven pattern for "auto-fill from the selected client, but don't clobber an explicit prefill" — the recurrence auto-fill at line 209-213:
  ```js
  if (selectedClient && selectedClient.id !== lastClientRefId) {
    setLastClientRefId(selectedClient.id);
    if (!prefillData && selectedClient.recurrence) setRecurrence(selectedClient.recurrence);
  }
  ```
  The pending-note fill reuses this exact hook: `if (!prefillData && selectedClient.pendingNote) setBookingNotes(selectedClient.pendingNote)`.
- This covers **every** entry point into `NewJobSheet` (blank FAB where the client is picked mid-wizard, `openFor(clientId)` from ClientProfile/Clients "Book Job," and any future duplication flow) because it fires off `selectedClient` changing, not off how the sheet was opened. `createJob()` (`jobsRepo.js:141`) has exactly one caller (`NewJobSheet.jsx:302`), confirmed — no other job-creation path to cover.
- This is a **visible, editable pre-fill**, not a silent background write — same UX as the recurrence auto-fill. She sees it in the textarea before saving and can edit or clear it. (Considered a fully-silent write straight into `job_notes` at creation time, relying on the note rendering loudly via `NoteCallout` the instant the job exists — rejected because it removes her chance to edit/drop a note that's gone stale, e.g. if she's now booking a *different* service where it doesn't apply.)
- **Recurring bookings**: if she books a recurring series with a carried note still in the field, `createJob()`'s `createRecurringSeries()` path copies `job_notes` onto every generated occurrence (all 4-12 future jobs), same as it does for any manually-typed note today. This is existing, expected behavior for the notes field in general — not new risk introduced by this feature — and it's visible/editable before she saves, same backstop as above.
- On successful `createJob()` when `payload.client_id` had a pending note, clear it: `clientsRepo.setPendingNote(clientId, null, null)`.
- **Known accepted gap (2026-09-15 reconciliation)**: this consumption isn't transactional — `createJob()` succeeds, then a separate `setPendingNote(null, null)` call clears the flag. If that second call fails or drops, the note wrongly pre-fills again next time. Both call sites already treat the clear as non-fatal (logged, not thrown — the job is already booked, don't block on it). Accepted as a known v1 limitation; revisit only if `createJob` ever becomes a single backend RPC that could combine both writes into one transaction.

## Visibility while pending

- Small tile on `ClientProfile.jsx`, same slot/style precedent as the existing account-credit tile (v0.13.49): "✦ Note waiting for next job" showing the note text, with a dismiss (✕) that clears both columns without booking anything.
- Without this, the pending note is invisible state she set once at completion and then can't see or cancel until she happens to rebook — same principle the credit tile already established for a different "something is queued for later" case.
- **Dismiss requires a confirm step (2026-09-15 addition)**: tapping ✕ doesn't delete immediately — it reveals an inline "Remove this note? [Keep] [Remove]" row first. One-tap-deletes-text-no-undo was flagged as too cheap to leave unguarded, mirroring the existing `ClientProfile` hard-delete two-step pattern rather than adding a new confirm-dialog component.

## Data layer changes

1. `src/data/clientsRepo.js` — add `pending_note`, `pending_note_source_job_id` to `SELECT_LIST` (`clientsRepo.js:15`); add `setPendingNote(clientId, noteText, sourceJobId)`.
2. `src/data/selectors.ts` — `toDisplayClient` (`selectors.ts:191`) gains `pendingNote: row.pending_note ?? ''` and `pendingNoteSourceJobId: row.pending_note_source_job_id ?? null`, alongside the existing `note: row.notes ?? ''` mapping (adjacent, unrelated field — see CLAUDE.md correction made alongside this spec).
3. Migration file under `supabase/migrations/`, run manually in Supabase SQL Editor per this project's standing rule (migrations are never auto-applied).

## UI changes

1. `PostJobSheet.jsx` — checkbox under the notes textarea; call `setPendingNote` after successful payment log.
2. `NewJobSheet.jsx` — one-line addition to the existing client-selected effect (line ~212); clear pending note after successful `createJob()`.
3. `ClientProfile.jsx` — new pending-note tile (styled like the credit tile), with dismiss action.

## Testing

- Unit: `clientsRepo.setPendingNote` (write + clear).
- Unit: `selectors.test` — `toDisplayClient` maps the two new fields.
- Manual QA (Bright Path test business, per this project's standing QA-account rule): complete a job with the checkbox checked → confirm `clients.pending_note` set → book a new job for that client → confirm the Notes field pre-fills and is editable → save → confirm `clients.pending_note` cleared and the new job's `job_notes` shows the carried text via the existing `NoteCallout`.
- Manual QA: dismiss from ClientProfile tile → confirm it clears without needing a new booking.
