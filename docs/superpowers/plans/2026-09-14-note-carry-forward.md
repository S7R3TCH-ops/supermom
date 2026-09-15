# Note Carry-Forward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Sandra flag a completion note at job-wrap-up to carry forward to that client's next booked job, instead of it dying with the completed job.

**Architecture:** Two new nullable columns on `clients` (`pending_note`, `pending_note_source_job_id`) hold a single in-flight note. `PostJobSheet` writes it via a thin `clientsRepo.setPendingNote()` wrapper around the already-existing `updateClient()`. `NewJobSheet` reads it back through the existing `toDisplayClient()`-wrapped `selectedClient` object and pre-fills the Notes field using the same client-selected effect that already auto-fills recurrence — then clears it on successful booking. `ClientProfile` gets a dismissible tile mirroring the existing account-credit tile.

**Tech Stack:** React (Vite), Supabase/Postgres, Vitest. No new dependencies.

**Deviation from spec's testing section, noted up front:** the spec calls for a "clientsRepo unit test for setPendingNote." This codebase has **zero** existing tests that mock the Supabase client — all 117 existing tests are pure-function/mapping tests (`selectors.test.ts`, `lib/*.test.js`, `hooks/*.test.js`). Every other repo-layer function in this codebase (`creditsRepo.js`, `jobWorkersRepo.js`, `updateClient` itself) is manually QA'd, not unit-tested, because there's no supabase-mock harness to unit-test against. `setPendingNote` is a small wrapper around the already-untested `updateClient`. Inventing a first-of-its-kind supabase mock for one trivial wrapper function would be new test infrastructure, not test coverage for this feature — out of scope. Task 8's manual QA covers it instead, consistent with how `creditsRepo`/`jobWorkersRepo` were verified. The `selectors.test.ts` mapping test (a real, established pattern) IS included below.

**Amendment, 2026-09-15 — replace flipped to append:** every "replaces it" reference below (Task 2's code snippet, Task 8 Step 6, the coverage-map line) describes the *original* design and is now stale. Gemini's cross-check flagged silent replace as a real data-loss risk (whichever job completes second wins, the first flagged note vanishes with no trace) — Joel's call: switch to append-with-blank-line-separator on collision (`pending_note = coalesce(pending_note || '\n\n', '') || new_note`), she backspaces what she doesn't want on the next pre-fill. **This has already been implemented** in `clientsRepo.js`'s `setPendingNote` (reads the client's current `pending_note` first, concatenates if non-empty) — the plan text below was not rewritten line-by-line to avoid re-deriving an already-decided/already-shipped change; treat the spec file (`2026-09-14-note-carry-forward-design.md`) as the current source of truth over this plan doc's original wording. Two more decisions folded in at the same time: the non-transactional consumption-clear gap is an accepted known v1 limitation (already non-fatal in both call sites, no code change needed), and the `ClientProfile` dismiss tile now requires an inline "Remove this note? [Keep] [Remove]" confirm step before clearing (also already implemented, mirrors the existing hard-delete two-step pattern in the same file).

---

### Task 1: Migration file

**Files:**
- Create: `supabase/migrations/20260914010000_add_client_pending_note.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Client note carry-forward: lets Sandra flag a completion note at job
-- wrap-up to carry forward to the client's NEXT booked job instead of it
-- dying with the completed job. Single in-flight value per client, not a
-- ledger — a second carried note before the first is consumed replaces it.
-- pending_note_source_job_id is informational only (which job it came from),
-- not used in any logic branch. No RLS policy needed: `clients` already has
-- RLS enabled and its existing policies are row-level, so they already cover
-- these new columns. See docs/superpowers/specs/2026-09-14-note-carry-forward-design.md.

ALTER TABLE public.clients ADD COLUMN pending_note text;
ALTER TABLE public.clients ADD COLUMN pending_note_source_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Note for Joel — do NOT run this yet**

This project's migrations are never auto-applied (`supermom/CLAUDE.md`'s standing rule). Joel runs this manually in the Supabase SQL Editor once the whole feature is built and reviewed, not before. Flag this explicitly when this task is reported done — don't imply it's live.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260914010000_add_client_pending_note.sql
git commit -m "feat: add clients.pending_note migration (not yet run in Supabase)"
```

---

### Task 2: `clientsRepo.js` — select the new columns, add `setPendingNote`

**Files:**
- Modify: `src/data/clientsRepo.js:15` (SELECT_LIST), and add a new exported function after `updateClient` (currently ends at line 108)

- [ ] **Step 1: Add the two columns to `SELECT_LIST`**

Current line 15:
```js
const SELECT_LIST = 'id, first_name, last_name, email, phone, street, city, province, postal_code, status, notes, access_info, tags, ai_context';
```

Replace with:
```js
const SELECT_LIST = 'id, first_name, last_name, email, phone, street, city, province, postal_code, status, notes, access_info, tags, ai_context, pending_note, pending_note_source_job_id';
```

- [ ] **Step 2: Add `setPendingNote`, right after `updateClient` (after line 108, before the soft-delete comment)**

```js
// Set (or clear, with null args) the single in-flight carry-forward note on a client.
// A second carried note before the first is consumed replaces it (by design — see spec).
export async function setPendingNote(clientId, noteText, sourceJobId) {
  return updateClient(clientId, {
    pending_note: noteText,
    pending_note_source_job_id: sourceJobId,
  });
}
```

- [ ] **Step 3: Manual sanity check (no automated test — see plan header)**

Run: `npm run build`
Expected: builds clean, no import/reference errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/clientsRepo.js
git commit -m "feat: add clients.pending_note to SELECT_LIST, add setPendingNote()"
```

---

### Task 3: `selectors.ts` — map the new fields, with a test

**Files:**
- Modify: `src/data/selectors.ts` — `ClientRow` interface (after line 25), `DisplayClient` interface (after line 111), `toDisplayClient()` body (after line 249)
- Test: `src/data/selectors.test.ts`

- [ ] **Step 1: Write the failing test — append to `src/data/selectors.test.ts`**

```ts
import { toDisplayClient } from './selectors';

describe('toDisplayClient — pending note', () => {
  it('maps pending_note and pending_note_source_job_id from the raw row', () => {
    const d = toDisplayClient({
      id: 'c1',
      first_name: 'Ann',
      last_name: 'Rae',
      pending_note: 'Call before showing up next time',
      pending_note_source_job_id: 'j99',
    } as any)!;
    expect(d.pendingNote).toBe('Call before showing up next time');
    expect(d.pendingNoteSourceJobId).toBe('j99');
  });

  it('defaults to empty/null when there is no pending note', () => {
    const d = toDisplayClient({ id: 'c1', first_name: 'Ann' } as any)!;
    expect(d.pendingNote).toBe('');
    expect(d.pendingNoteSourceJobId).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/data/selectors.test.ts`
Expected: FAIL — `d.pendingNote` is `undefined`, not `'Call before showing up next time'` / `''`.

- [ ] **Step 3: Add the two fields to `ClientRow` — after line 25 (`notes?: string | null;`)**

```ts
  notes?: string | null;
  pending_note?: string | null;
  pending_note_source_job_id?: string | null;
```

- [ ] **Step 4: Add the two fields to `DisplayClient` — after line 111 (`note: string;`)**

```ts
  note: string;
  pendingNote: string;
  pendingNoteSourceJobId: string | null;
```

- [ ] **Step 5: Add the mapping in `toDisplayClient()` — after line 249 (`note: row.notes ?? '',`)**

```ts
    note: row.notes ?? '',
    pendingNote: row.pending_note ?? '',
    pendingNoteSourceJobId: row.pending_note_source_job_id ?? null,
```

- [ ] **Step 6: Run the test again to confirm it passes**

Run: `npx vitest run src/data/selectors.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 7: Run the full suite to check nothing else broke**

Run: `npx vitest run`
Expected: PASS, 119/119 (117 existing + 2 new from this task).

- [ ] **Step 8: Commit**

```bash
git add src/data/selectors.ts src/data/selectors.test.ts
git commit -m "feat: map clients.pending_note fields in toDisplayClient, with tests"
```

---

### Task 4: `PostJobSheet.jsx` — carry-forward checkbox

**Files:**
- Modify: `src/components/sheets/PostJobSheet.jsx` — imports (line 18), state (after line 33), textarea section (lines 728-742), `handleLogPayment` (lines 178-199)

- [ ] **Step 1: Add the import — after line 18 (`import { getClientCreditBalance } from '../../data/creditsRepo';`)**

```js
import { getClientCreditBalance } from '../../data/creditsRepo';
import { setPendingNote } from '../../data/clientsRepo';
```

- [ ] **Step 2: Add state — after line 33 (`const [jobNotes, setJobNotes] = useState('');`)**

```js
  const [jobNotes, setJobNotes] = useState('');
  const [carryNoteForward, setCarryNoteForward] = useState(false);
```

- [ ] **Step 3: Add the checkbox — replace the notes `<div>` block, lines 728-742**

Current:
```jsx
          {/* Section 7: Completion Notes */}
          <div>
          <SectionLabel>Post-job notes</SectionLabel>
          <textarea
            className="sm-input"
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            placeholder="Anything special happen? Client wasn't home, dog was extra cute..."
            style={{
              width: '100%', height: 80, padding: '12px', borderRadius: 12,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.ink, fontSize: 13, resize: 'none', fontFamily: T.font
            }}
          />
          </div>
```

Replace with:
```jsx
          {/* Section 7: Completion Notes */}
          <div>
          <SectionLabel>Post-job notes</SectionLabel>
          <textarea
            className="sm-input"
            value={jobNotes}
            onChange={e => setJobNotes(e.target.value)}
            placeholder="Anything special happen? Client wasn't home, dog was extra cute..."
            style={{
              width: '100%', height: 80, padding: '12px', borderRadius: 12,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.ink, fontSize: 13, resize: 'none', fontFamily: T.font
            }}
          />
          {jobNotes.trim() && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={carryNoteForward}
                onChange={e => setCarryNoteForward(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: T.pink, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: T.inkSub, fontFamily: T.font }}>
                ✦ Also flag this for {job?.client_name || 'their'}'s next job
              </span>
            </label>
          )}
          </div>
```

- [ ] **Step 4: Write the note after a successful payment log — in `handleLogPayment`, after line 199 (`await recordPayment(...)`)**

Current:
```js
      await recordPayment(jobId, paidAmt, method, ps, totalDuration, null, validCosts, jobNotes, job?.worker_name ? workerPaid : null, taxEnabled);

      const { data } = await supabase
```

Replace with:
```js
      await recordPayment(jobId, paidAmt, method, ps, totalDuration, null, validCosts, jobNotes, job?.worker_name ? workerPaid : null, taxEnabled);

      if (carryNoteForward && jobNotes.trim() && job?.client_id) {
        try {
          await setPendingNote(job.client_id, jobNotes.trim(), jobId);
        } catch (e) {
          console.warn('setPendingNote failed (non-fatal — payment already recorded):', e);
        }
      }

      const { data } = await supabase
```

(Wrapped in its own try/catch, deliberately non-fatal — the payment is already recorded by this point; a failed carry-forward write shouldn't roll back or block the wrap-up flow the way a payment failure would.)

- [ ] **Step 5: Verify `job.client_name` and `job.client_id` actually exist on the fetched job object**

Run: `grep -n "client_name\|client_id" src/components/sheets/PostJobSheet.jsx | head -20`
Expected: confirms both fields are already read elsewhere in this file (they come from `fetchJobById`, which uses the same `toDisplayJob` shape documented in `selectors.ts` — `client_id` and `client_name` are both on `DisplayJob`). If either name doesn't match what's actually used elsewhere in the file, fix Step 3/4's JSX and Step 4's code to match the real field name before continuing.

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/sheets/PostJobSheet.jsx
git commit -m "feat: add carry-forward-note checkbox to PostJobSheet completion flow"
```

---

### Task 5: `NewJobSheet.jsx` — pre-fill from pending note, clear on booking

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx` — imports (line 6), auto-fill effect (lines 208-213), `handleBook` (lines 248-312)

- [ ] **Step 1: Add the import — line 6**

Current:
```js
import { fetchClients } from '../../data/clientsRepo';
```

Replace with:
```js
import { fetchClients, setPendingNote } from '../../data/clientsRepo';
```

- [ ] **Step 2: Extend the auto-fill effect — lines 208-213**

Current:
```js
  // Auto-select recurrence from client usual if available
  const [lastClientRefId, setLastClientRefId] = useState(null);
  if (selectedClient && selectedClient.id !== lastClientRefId) {
    setLastClientRefId(selectedClient.id);
    // Don't overwrite if we have specific prefillData for a duplication
    if (!prefillData && selectedClient.recurrence) setRecurrence(selectedClient.recurrence);
  }
```

Replace with:
```js
  // Auto-select recurrence from client usual if available; pre-fill a carried-forward note
  const [lastClientRefId, setLastClientRefId] = useState(null);
  if (selectedClient && selectedClient.id !== lastClientRefId) {
    setLastClientRefId(selectedClient.id);
    // Don't overwrite if we have specific prefillData for a duplication
    if (!prefillData && selectedClient.recurrence) setRecurrence(selectedClient.recurrence);
    if (!prefillData && selectedClient.pendingNote) setBookingNotes(selectedClient.pendingNote);
  }
```

- [ ] **Step 3: Clear the pending note after a successful booking — in `handleBook`, after line 302 (`await createJob(payload);`)**

Current:
```js
      await createJob(payload);
      notifyDataChanged();
```

Replace with:
```js
      await createJob(payload);
      if (selectedClient?.pendingNote) {
        try {
          await setPendingNote(clientId, null, null);
        } catch (e) {
          console.warn('Clearing pending note failed (non-fatal — job already booked):', e);
        }
      }
      notifyDataChanged();
```

(Same non-fatal pattern as Task 4 — the job is already booked at this point; a failed clear shouldn't roll that back. Worst case the note lingers and gets replaced or dismissed later.)

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Manual QA note for Task 8 — recurring-booking behavior is intentionally unhandled here**

Per the spec: if she books a recurring series while a carried note sits in `bookingNotes`, `createJob()`'s `createRecurringSeries()` path (`jobsRepo.js:165-220`) copies `job_notes` onto every generated occurrence — same as any manually-typed note would today. This is not a bug to fix in this task; it's called out for the Task 8 QA pass to confirm it behaves as expected (visible/editable before save, same as any other note), not to be "fixed."

- [ ] **Step 6: Commit**

```bash
git add src/components/sheets/NewJobSheet.jsx
git commit -m "feat: pre-fill carried-forward note in NewJobSheet, clear on booking"
```

---

### Task 6: `ClientProfile.jsx` — pending-note tile with dismiss

**Files:**
- Modify: `src/pages/ClientProfile.jsx` — around the existing account-credit tile, lines 293-308

- [ ] **Step 1: Add dismiss handler — near the other handlers in the component body (e.g. after the `useEffect` that loads credit balance, around line 63)**

```js
  const [dismissingPendingNote, setDismissingPendingNote] = useState(false);
  const handleDismissPendingNote = async () => {
    if (!id || dismissingPendingNote) return;
    setDismissingPendingNote(true);
    try {
      await setPendingNote(id, null, null);
      await refresh();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setDismissingPendingNote(false);
    }
  };
```

- [ ] **Step 2: Add the import — alongside the existing `clientsRepo` import (line 11)**

Current:
```js
import { updateClient, softDeleteClient, hardDeleteClient } from '../data/clientsRepo';
```

Replace with:
```js
import { updateClient, softDeleteClient, hardDeleteClient, setPendingNote } from '../data/clientsRepo';
```

- [ ] **Step 3: Add the tile — directly after the existing account-credit block, i.e. after line 308's closing `)}`**

Insert this new block right after the credit tile's `)}` (line 308):
```jsx
        {/* Pending carry-forward note */}
        {client.pendingNote && (
          <div style={{
            background: T.pinkTint, border: `1.5px solid ${T.pink}`, borderRadius: 12,
            padding: '11px 13px', marginBottom: 12, position: 'relative',
          }}>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 6 }}>
              ✦ Note waiting for next job
            </div>
            <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', paddingRight: 24 }}>
              {client.pendingNote}
            </div>
            <button
              type="button"
              onClick={handleDismissPendingNote}
              disabled={dismissingPendingNote}
              aria-label="Dismiss pending note"
              style={{
                position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%',
                border: 'none', background: 'transparent', color: T.inkMuted, fontSize: 14,
                cursor: dismissingPendingNote ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        )}
```

- [ ] **Step 4: Verify `client.pendingNote` is the right variable — reads off `useClient(id)`'s `client` object**

Run: `grep -n "useClient(id)" src/pages/ClientProfile.jsx`
Expected: confirms `client` (not `raw`) is the `toDisplayClient()`-wrapped object already destructured at line 38 (`const { client, raw, loading, error, refresh } = useClient(id);`) — Task 3 added `pendingNote` to exactly that mapping, so `client.pendingNote` is correct. If `useClient` turns out to wrap something other than `toDisplayClient`, trace it (`src/data/useData.js`) and adjust before continuing.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ClientProfile.jsx
git commit -m "feat: add dismissible pending-note tile to ClientProfile"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (117 existing + 2 new from Task 3 = 119/119).

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: clean build, no warnings beyond the pre-existing `inlineDynamicImports` deprecation notice (unrelated, already present before this feature).

- [ ] **Step 3: Version bump**

Modify `package.json`'s `"version"` field per this project's standing rule ("Increment version on every meaningful release") — bump to the next patch version above whatever is live on `main` at the time this plan is executed (check `git log origin/main -1 -- package.json` or just read the current live value, don't assume it's still 0.13.61 from when this plan was written).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: version bump for note carry-forward feature"
```

---

### Task 8: Manual QA (Bright Path Concierge QA test business — never the real superadmin/Sandra account, per this project's standing rule)

**Files:** none (manual verification only)

- [ ] **Step 1: Complete a job with a note, check the box**

In the QA business, open any scheduled job → PostJobSheet → type a completion note → confirm the "✦ Also flag this for [Client]'s next job" checkbox appears (only once text is present) → check it → Save & log payment.
Expected: no errors, normal completion flow (receipt screen, etc.) proceeds exactly as before.

- [ ] **Step 2: Confirm the pending note landed on the client**

Open that client's `ClientProfile`.
Expected: new "✦ Note waiting for next job" tile appears showing the exact note text, positioned near/below the existing account-credit tile if both are present.

- [ ] **Step 3: Book a new job for that same client**

Tap "Book Job" from ClientProfile (or the client-selection step of a blank `+New Job`), pick that client, proceed to the Notes field.
Expected: Notes field is pre-filled with the carried text; it's a normal editable textarea (can be changed/cleared before saving).

- [ ] **Step 4: Save the new job**

Expected: job books normally; new job's `job_notes` shows the carried text via the existing `NoteCallout` (pink callout) on `JobDetailSheet`/`JobCard`/`UpcomingCard`. Re-open `ClientProfile` for that client — the pending-note tile is gone (cleared).

- [ ] **Step 5: Dismiss without booking**

Repeat step 1-2 to create a fresh pending note on a (different or the same) client. On `ClientProfile`, tap the ✕ on the tile.
Expected: tile disappears immediately, no new job needed. Reload the page to confirm it's actually cleared server-side, not just hidden client-side.

- [ ] **Step 6: Replace-on-conflict**

Create a pending note (step 1-2). Before booking a new job for that client, complete a *second* job for the same client with a *different* note, box checked.
Expected: `ClientProfile`'s tile now shows the second note's text, not the first — confirms replace-not-append behavior matches the spec.

- [ ] **Step 7: Recurring-booking behavior (documented as expected, not a bug — see Task 5 Step 5)**

With a pending note showing in the Notes field, set a recurrence (e.g. Weekly) before saving the new job.
Expected: the note carries onto every generated occurrence in the series — confirm this matches the spec's called-out, accepted behavior, not a surprise.

- [ ] **Step 8: Report results to Joel**, including explicit confirmation the migration (Task 1) still has NOT been run against production Supabase until he does it himself, and that Task 8's QA above was run entirely against the Bright Path QA business, not Sandra's real data.

---

## Self-review (spec coverage check)

- Storage (2 columns, no ledger) — Task 1. ✓
- Trigger checkbox in PostJobSheet, only when note is non-empty — Task 4. ✓
- Non-fatal write, not threaded through `recordPayment` — Task 4 Step 4. ✓
- Visible/editable pre-fill in NewJobSheet, reusing the recurrence-autofill pattern, covers every entry point via `selectedClient` — Task 5 Steps 2-3. ✓
- Replace-not-append on conflict — inherent in `setPendingNote`'s plain overwrite (no append logic anywhere) — Task 2, verified in QA Task 8 Step 6. ✓
- ClientProfile dismissible tile, styled like the credit tile — Task 6. ✓
- Recurring-booking edge case — explicitly documented as accepted behavior, not silently ignored — Task 5 Step 5, QA Task 8 Step 7. ✓
- Migration never auto-applied — Task 1 Step 2, restated in QA Task 8 Step 8. ✓
- Data-layer test coverage — `selectors.ts` mapping tested (Task 3); `setPendingNote` deliberately NOT unit-tested with a rationale matching this codebase's actual established pattern (see plan header), not a gap silently left uncovered.
