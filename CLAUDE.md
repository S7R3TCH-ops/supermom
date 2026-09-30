# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is authoritative project state. Do NOT rely on memory files — they drift.
> **Drift check (every session)**: Run `git log --oneline -10` and verify recent changes are documented here.
> **Second-brain sync (every session, mandatory)**: This repo is tracked in `C:\Projects\second-brain\03-projects\active\supermom\`. Whether this session is running here directly (CLI or Antigravity) or was routed from second-brain, before ending the session update that project's `status.md` (current state) and `tasks.md` (next actions) to match what actually happened — same as if the session had been rooted in second-brain. Don't rely on this repo's own docs (this file, `HANDOFF_NEW_SESSION.md`) as the cross-session source of truth for planning/priorities; second-brain's `status.md`/`tasks.md` are. If you can't reach that folder from this session, say so explicitly instead of silently skipping the update.
> **Gemini handoff routing (standing rule, added 2026-07-15)**: When Joel says "execute the instructions/plan Gemini brainstormed" (or equivalent — no file path given), auto-look in `C:\Projects\second-brain\00-inbox\gemini\`, take the most recently modified `.md` file, read it, and execute — don't ask Joel for the path.
> **Gemini Phase-0 scoped access (2026-07-16)**: Gemini/Antigravity now has scoped access to this repo — read-most, write limited to `tests/` only, no git ops. Rules live in this repo's own `GEMINI.md`. Full reasoning: `second-brain/decisions.md` 2026-07-16.

---

## What we're building

A modular, agentic, mobile-first **Solopreneur Operations Platform** — deployed here as **Supermom for Hire**, the flagship bespoke instance for Sandra's solo personal-life-operations business in Georgetown, ON (organizing, caregiving, decluttering, errands).

**Platform Architecture & Managed Service**:
- **Core Engine**: Generic, multi-tenant agentic OS for 1-person businesses. Highly customizable — features can be toggled, stripped, or augmented per solopreneur niche.
- **Flagship Tenant**: Sandra (Supermom) is Client #1 and live proof-of-concept.
- **Target Persona**: Non-technical solopreneurs (often ADHD/overwhelmed by corporate SaaS) who need simple, zero-friction automation delivered via a trusted implementation partner (Joel).

### Platform Hierarchy
- **Super Admin (Joel)**: `admin` role in DB. Not linked to any business. Switches "Viewpoints" to see any business.
- **Business Owners (Sandra, etc.)**: `owner` role, scoped to their `business_id`.

---

## Design Context

`PRODUCT.md` (strategic) and `DESIGN.md` (visual) are source of truth for all design work — read both before touching UI. Brand personality: **"kick-ass Mary Poppins"** — capable, warm, unflappable. Anti-references: AI-slop look, cartoon-superhero iconography, cold corporate SaaS.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Styling | CSS custom properties via `tokens.js`, inline `style={{}}` (see DESIGN.md) — corrected 2026-09-17, Tailwind is an unused dependency, zero utility classes in the codebase |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (Postgres) |
| Hosting | Vercel (supermom-s7-r3-tch.vercel.app) |
| Performance | `React.lazy` + `Suspense` code-splitting |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context (no Zustand) |
| AI / LLM | Gemini API (`@google/genai`, model `gemini-3.6-flash`, thinking disabled via `thinkingConfig: { thinkingBudget: 0 }`) — switched from Anthropic 2026-09-22. `GEMINI_API_KEY` env var (must be a Cloud Console-issued, service-account-bound Auth key — see Bugs section for why), `api/_lib/gemini.js` is the shared client/helper. Used by `api/ai/[action].js` (enrich-client, estimate-duration, prep-note, summarize-carried-note, client-brief, day-brief, test-persona) and `api/ai/chat.js`. `@anthropic-ai/sdk` removed from `package.json`. |

---

## Common Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start local dev server |
| `node scripts/reset-platform.mjs` | Wipe all client data, keep Super Admin |
| `node scripts/provision-sandra.mjs` | Re-create Sandra's business + account |
| `node scripts/inspect.mjs` | Summary of current DB tables and users |
| `node scripts/dedup-data.mjs` | Merge duplicate clients/jobs/services |

---

## Security & Environment
- **CRITICAL**: Never commit `.env`. Gitignored.
- Client-side vars: `VITE_` prefix. Server-only: no prefix, Vercel env only.
- `api/sync/gcal.js` has **no `INTERNAL_API_SECRET` check** intentionally — `triggerGCalSync` is called client-side; endpoint is write-only to GCal, exposure is low.
- **Local-only dirs** (gitignored): `.agents/`, `skills-lock.json`, `.impeccable/` — never commit these.
- **`VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`** (added v0.13.72, lockscreen push) — Vercel Production + Preview + local `.env`. `VITE_VAPID_PUBLIC_KEY` is client-visible by design (it's the public half). **Rotating the key pair invalidates every existing push subscription** — the client self-heals on next app open (`usePushSubscription.js` compares the subscribed key to the current one and re-subscribes on mismatch), no manual Sandra-side action needed.
- **`GEMINI_API_KEY`** (added 2026-09-22) — server-only, Vercel env only, powers all agentic AI summaries/titles/briefs/chat (`api/_lib/gemini.js`). Google changed key issuance 2026-05-28: only **Auth keys** (`AQ.` prefix, bound to a Google Cloud service account) are issued now — the old `AIzaSy...` Standard-key format is being retired. Must be created via **Cloud Console → Credentials → Create Credentials → API Key**, restricted to Gemini API, explicitly bound to a service account (Joel's project has one: "Default Gemini Key") — an `AQ.` key auto-issued by AI Studio's own flow was found to have a broken/incomplete binding and 401'd (`ACCESS_TOKEN_TYPE_UNSUPPORTED`), a known issue on Google's side at the time, not a code bug. **Auth keys are one-time-reveal** — Cloud Console shows the string only once, no way to view it again after. If `GEMINI_API_KEY` is unset/wrong, `initGemini()` returns `null` and every AI handler silently degrades to its mock/cached/skip fallback path (this was the root cause of "summaries and titles stopped pulling" after Anthropic was pulled out — no hard error, just quiet degradation). `ANTHROPIC_API_KEY` is still present in local `.env` but is dead — nothing in the codebase reads it anymore.

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.** ⚠️ Confirmed stale 2026-09-17 — missing `client_credits`, `job_workers`, `worker_payouts`, `error_logs`, `clients.pending_note*`. Needs a `supabase db dump` refresh (Joel-gated, not a code change).

| Table | Purpose |
|---|---|
| `businesses` | One row per business; `ai_profile` jsonb for persona. `push_alerts_enabled` (boolean, default true) — per-tenant lockscreen-push master switch, added v0.13.72. |
| `users` | `auth.users.id` → `business_id`, role (`owner`/`admin`/`worker`). |
| `clients` | Business-scoped. `ai_context` jsonb, `tags` array. |
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `flat_rate`, `total_amount`, `actual_duration`, `additional_costs_json`, `worker_id`, `worker_pay`, `worker_paid`, `tax_enabled` (nullable), `notes_resolved_at` (nullable timestamptz — NULL = the job's `job_notes` is an open action item, set = marked done; see v0.13.71). |
| `payments` | One row per payment transaction. Source of truth for amounts collected. |
| `services` | Service catalog with `default_price`, `default_duration`, `pricing_type`. |
| `workers` | Business-scoped. `person_type` (`'worker'`/`'staff'`), `deleted_at` (soft-delete). No Supabase Auth — picker only. |
| `skill_types` | Business-scoped skill catalog. |
| `worker_skills` | Junction: `worker_id` → `skill_type_id` + `pay_rate`. |
| `job_workers` | Per-job worker assignment (replaces `jobs.worker_id`/`worker_pay`/`worker_paid`). One row per worker on a job — `pay`, `paid`, `paid_at`, nullable `payout_id` FK to `worker_payouts`. Supports multiple workers per job. Migration run 2026-07-22. |
| `worker_payouts` | One row per disbursement event to a Sidekick/Wingmom — `amount`, `payout_date`, `method`, `notes`. Can settle multiple `job_workers` rows at once (bundled payout). Migration run 2026-07-22. |
| `integrations` | OAuth tokens (Google Calendar). |
| `error_logs` | Client + server error capture (source, severity, message, stack, context). Append-only, admin-viewable in Admin page. Migration run 2026-07-15. |
| `client_requests` | In-app bug/idea intake from Sandra (`kind`, `title`, `body`, `context` jsonb, `status`). `notified_at`/`exported_at` track the email-Joel + pull-to-second-brain pipeline. **`admin_notes` is CLIENT-VISIBLE** (v0.13.77) — renders as "Joel's reply" in the owner's My requests sheet; never put private triage notes there. Migration `20260918010000_add_client_requests.sql`. |
| `request_messages` | Message thread per client request (`request_id`, `business_id`, `author_role`, `author_id`, `body`). Auto-reopens `done` request to `triaged` on owner reply via trigger `trg_reopen_request_on_owner_reply`. Migration `20260927060000_add_request_messages.sql` — **live** (confirmed 2026-09-30). |
| `push_subscriptions` | One row per (user, device/browser) Web Push subscription — `endpoint`/`p256dh`/`auth`, written client-side (RLS insert). `fail_count`/`last_success_at` drive the dead-subscription cleanup in the sweep. Migration `20260918030000_add_push_notifications.sql` **is live**. **RLS fix `20260928070000_fix_push_subscriptions_reclaim.sql`** (2026-09-28, **live**, confirmed 2026-09-30) — splits the old `FOR ALL` modify policy into insert/update/delete; update's `USING` no longer requires the *existing* row's `user_id` to match, so a device re-subscribing under a different logged-in user (no prior unsubscribe) can reclaim its row instead of 401ing. |
| `push_log` | One row per dispatched leave/wrap-up push alert — `kind`, `job_start_at` (reschedule-safe dedupe key), `title`/`body` (exactly what was sent), `sent_count`/`failed_count`. `UNIQUE (job_id, kind, job_start_at)` is also the sweep's double-send guard (claimed via insert before sending). Same migration as `push_subscriptions` — **live**. |
| `ai_briefs` | Cached AI-generated day/client briefs — `content` jsonb is the parsed model output, `inputs_hash` (sha256 of the canonicalised input) skips regeneration when nothing changed, `kind` ('day'/'client') deliberately has no check constraint (handler-validated, code-only to extend). `UNIQUE (business_id, kind, subject_id)`. Migration `20260918050000_add_ai_briefs.sql` — **live** (run in prod by Joel 2026-09-18, per commit `de85446`). |
| `storage.job-assets` | Private bucket for job photos and voice notes. |

### Critical data layer rules
- **Multi-tenancy**: Every query must include `.eq('business_id', businessId)`.
- **Soft deletes only**: Never hard-delete jobs, clients, or workers. Set `deleted_at = now()`.
- **Supabase migrations are NOT auto-applied** — run schema changes manually in Supabase SQL Editor.
- **Supabase project ID**: `lskzzsjmmtsosfneuovt`
- **`client_requests` inserts are a plain client-side RLS write** (`requestsRepo.js`'s `submitRequest`), not routed through any API — same pattern as `error_logs`, so a submission survives even if the API layer is what's being reported broken. The only export path is the pull script (`scripts/export-requests.mjs`), never a push from Vercel.
- **`app_settings.reminders_last_sweep_at` / `reminders_last_sweep_error`** (added v0.13.72) — heartbeat for the `api/reminders/[action].js` `sweep` action (pg_cron, `*/5`). Written first thing every tick, before anything else can throw, so a deliberately-off/misconfigured tick still reads as "checked in" rather than an outage. Tail + heartbeat visible on Admin → Super Admin: Job Alerts (Push).

### Hourly job field conventions — READ THIS
- `flat_rate` stores the **$/hr rate** for Hourly jobs (not a flat fee). This is intentional — NewJobSheet writes it that way.
- `total_amount` is the finalized total written by `recordPayment`. Always use `computeJobFinancials()` for UI math — never read `total_amount` raw.
- `subtotal` = base labor only. `hst_amount` = finalized HST. `total_amount` = final grand total. All three written on completion.
- `additional_costs_json` is the array of cost items. `additional_cost` is a backward-compat scalar sum.
- `toDisplayJob()` in `selectors.js` wraps raw DB rows — use `j.raw.fieldName` to access DB fields from display objects.
- `computeJobTotal(job)` = subtotal + additional costs + HST. Use for Home screen card display, collection math, and all totals Sandra sees.
- `computeJobSubtotal(job)` = subtotal + additional costs (no HST). Use for Finance page revenue display (pre-tax revenue reporting).
- **Never trust caller-supplied `paymentStatus`** — `recordPayment` always re-derives from DB payments sum.
- **Money-column single writer**: `subtotal`/`hst_amount`/`total_amount` are only written from `buildFinancialPatch()` in `src/lib/jobDraftPolicy.js`. Any new job write path must use it. `updateJob` backstop re-derives `payment_status` via `rederivePaymentStatus()` whenever a money field changes without `payment_status` in the patch.
- `jobs.tax_enabled` is nullable: NULL = inherit from `business.tax_enabled`, true/false = explicit per-job override.

### Worker pay data model — READ THIS (added 2026-07-22)
- `jobs.worker_id`/`worker_pay`/`worker_paid` are **dead columns** — code no longer reads or writes them. Worker assignment/pay/paid now lives in `job_workers` (see schema table above). Columns intentionally left in place in the DB, not dropped yet.
- `src/data/jobWorkersRepo.js` is the repo layer: `fetchJobWorkers`, `fetchJobWorkersForJobs` (batch), `setJobWorkers` (replace-set, preserves `paid_at`/`payout_id` when a worker's paid state hasn't changed), `markJobWorkerPaid`, `createWorkerPayout` (bundled-payout plumbing, no UI wired to it yet).
- `src/data/jobsRepo.js`'s `decorateJob` attaches a `workers[]` array to every job row, plus derived convenience fields from `workers[0]` (`worker_id`, `worker_name`, `worker_pay`, `worker_paid`, `assignee_type`) — the UI still only assigns one worker per job, so these singular fields keep every existing screen (JobDetailSheet, PostJobSheet, JobCard, FinancialMathBreakdown) working unchanged.
- **Deliberately avoids PostgREST nested-embed selects** (e.g. `job_workers(worker_id, workers(name))`) on `job_workers.worker_id` — it's a brand-new FK and this codebase already avoids embedding fresh FKs elsewhere (`workersRepo.js`'s `fetchWorkersWithSkills`) since PostgREST's schema cache isn't guaranteed to have picked it up. Batch-fetch + merge in JS instead.
- `computeJobFinancials`'s `workerCost` now sums `pay` across a `job.workers[]` array (was a single `worker_pay` scalar) — still informational only, never added to the client-facing total. `Finance.jsx`'s `workerCostItems` flatMaps over each job's `workers[]`, one line item per worker, preserving the existing accrual semantics (`profit = revenue − expenses − workerCosts`, summed regardless of `paid` status).
- Migration `supabase/migrations/20260722010406_add_worker_pay_model.sql` was run in Supabase SQL Editor 2026-07-22, before the v0.13.29 push — confirmed clean (0 jobs had `worker_id` set in prod at the time, so 0 backfill rows).

### RLS policy state (May 30, 2026)
- All tables RLS-enabled. SECURITY DEFINER helpers: `is_admin()`, `my_business_id()`.
- `businesses_modify` — `USING/WITH CHECK (is_admin() OR id = my_business_id())`
- `services_modify` — `USING/WITH CHECK (is_admin() OR business_id = my_business_id())`
- `workers_select/modify` — scoped to `my_business_id()` or `is_admin()`

---

## Key business rules
- Sandra books all jobs herself — no self-serve client portal yet
- Payment is cash or e-Transfer only — no Stripe
- Timezone is always `America/Toronto` — never system timezone

---

## Sandra's business reference
- **Email**: `sandra@supermomforhire.com` is an alias on the real account `admin@supermomforhire.com` — app-facing/invoice-facing identity is `sandra@`, but GCal OAuth and anything requiring a real (non-alias) Google account is backed by `admin@`. Business calendar lives on `admin@`'s Google Calendar, shared out to Sandra's personal Gmail for toggle-on/off visibility.
- **Phone**: `(416) 738-0309`
- **Location**: Georgetown, ON (home-based — no street address on invoices)
- **HST #**: `777616178 RT0001`

### Invoice architecture
- Public route: `/i/:id` — no auth required (shareable link)
- `src/pages/InvoiceView.jsx` — web preview. "Download PDF" → `GET /api/invoice?id=`. "Print" → `window.print()`.
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`, `settleInvoiceOutstanding()`, `voidInvoiceSettlement()`, `addJobsToInvoice()`
- `api/invoice.js` — GET `?id=<invoiceId>` → PDF download; POST → email send. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Filename: `LastName_Invoice_YYYY-NNN.pdf` or `LastName_Receipt_YYYY-NNN.pdf`.
- `api/_lib/invoicePdf.ts` — react-pdf builder. Address blocks use single `<Text>` with `\n`-joined children — **intentional**; stacked `<Text>` elements each get their own font-metrics line-box.
- Logo files: `logo-banner.png` (app bar) vs `logo-final-white-bg.png` (invoice/email, 492KB, white background) — never mix. `logo-final-tansparent.png` is a separate transparent-bg export, cut for a realtor of Sandra's to use on her own website — not used anywhere in-app.
- Settlement payments tagged `payments.invoice_id = <this invoice>` so `decorateInvoiceWithBalances` finds jobs paid via this invoice. Multi-job invoices supported: `decorateInvoiceWithBalances` aggregates across all `invoice_jobs`; `invoiceJobBalances[]` exposed. Single-job assumption removed in v0.12.67.

### Daily briefing email
- **File**: `api/briefing/daily.js` | **Schedule**: `0 11 * * *` (7 AM EDT, in `vercel.json`) | **Secret**: `CRON_SECRET`, stored in Vercel env only — never write the actual value into this file or any other tracked doc (a prior plaintext copy here was the finding that triggered its 2026-09-15 rotation). Auth is header-only (`Authorization: Bearer $CRON_SECRET`, sent automatically by Vercel Cron); the old `?secret=`/`?to=` query-param path was removed 2026-09-15 — it was request-logged and let anyone who'd read the secret exfiltrate every business's data to an arbitrary email.
- **Sender**: `admin@supermomforhire.com` via nodemailer + `GMAIL_APP_PASSWORD` | **Reply-To**: `noreply@supermomforhire.com`
- **⚠️ DO NOT rapid-redeploy** — every prod deploy re-registers the cron and resets next-run clock. Deploy once from a clean committed tree.

### Drive time architecture
- `locationDrives` state in `Home.jsx`: `{ [jobId]: { duration: string, durationValue: number } }` — ephemeral, never persisted
- `formatLeaveBy(durationValue, jobStart, nowDate)` — pure helper in Home.jsx
- `fetchLocationDrives()` — batch GPS + Distance Matrix, auto-triggered on load via `locationFetchedRef` guard
- `updateDailyRoutes()` in `maps.js` — persists pre-calc to `ai_context.drive_to` in DB

---

## App Icons & Web App Config

PWA manifest lives in `vite.config.js` (VitePWA plugin) → builds to `/manifest.webmanifest`.
- **Maskable icons** (192, 512) — OS applies rounding (Android 12+, iOS 16.4+)
- **Non-maskable `any` icons** (192, 512) — app drawer + home screen shortcut
- **Fallback sizes** (96, 144, 180, 256, 384) — older devices
- All icons use `#FC4693` pink background baked in. Generated via `scripts/generate-icons.mjs`.

---


## Current version: 0.13.105 - Sep 30, 2026 (Finance outstanding now tax-inclusive, task 7)

**v0.13.105**: `Finance.jsx` `outstandingItems`: owing was `computeJobSubtotal` (pre-tax) minus `amount_paid` (payments include HST), so on a taxed job it understated owing by the unpaid HST share (e.g. $100 + $13 HST job with $100 paid showed $0 owing, really $13; a $50 payment showed $50, really $63). Now `computeJobTotal(j) − paid`. Confirmed by code reading, not by a prod data query. Side effect to know about: the Revenue card stays pre-tax (by design) while Outstanding is now tax-inclusive, so the two aren't on the same basis. 301/301 tests, build clean.

## Previous version: 0.13.104 - Sep 30, 2026 (top-bar AI chat schedule context, task 4c)

**v0.13.104**: `api/ai/chat.js`: when the chat has a business scope but no client/job subject (the top-bar ✦ button, `LogoBar.jsx` calls `openChat()` with no context), the system prompt now includes that business's Scheduled jobs for today + tomorrow (Toronto dates via `api/_lib/torontoTime.js`, business-scoped, max 20, client name/time/service/open note). Server-side rather than the blueprint's client-side snapshot: no client-trusted data in the prompt, no `LogoBar`/`AiChatSheet` change, same filters as `api/briefing/daily.js`. Admin with no viewpoint and no subject still gets no schedule (scope is null; deliberate per v0.13.87). **tasks.md #4b (briefing shows yesterday as today) code-checked: NOT a bug** — `api/briefing/daily.js` and `day-brief` both use `torontoDateStr` and `scheduled_date = today`, and `day-brief` only surfaces `job_status = 'Scheduled'`; nothing reproduces. Not exercised live (preview API has no env; `api/ai/*` has no unit tests): verify after deploy by asking the top-bar chat "what's on today?". 301/301 tests, lint clean on the file.

## Previous version: 0.13.103 - Sep 30, 2026 (carried-note label on new-job sheet, task 10)

**v0.13.103**: `NewJobSheet.jsx`: a note pre-filled from the client's carried-forward `pending_note` now shows a pink "Carried from last visit" tag with a "Clear" link above the notes box (tag drops as soon as she types; Clear empties the field). Root cause of Joel's "notes bleed over" report (tasks.md #10): not a copy-from-last-job bug. The pre-fill only ever comes from `pending_note`, which is written only when Sandra opts in at wrap-up, but it landed unlabelled in the plain notes box. UI-only; booking still consumes `pending_note` as before, so Clear needs no DB write. `Home.jsx`'s `handleDuplicateJob` is dead code (never called). 301/301 tests pass, build clean. Two pre-existing lint errors in this file (unused `setDate`, set-state-in-effect) left alone.

## Previous version: 0.13.102 - Sep 29, 2026 (line-detail invoice entries task 11f + admin request/error panel rework task 12)

**v0.13.102**: Made invoice/receipt line entries descriptive (tasks.md #11f):
- **scheduled_time on Invoices & PDF**: Added `scheduled_time` to queries in `api/invoice.ts` (download, json read, email) and `src/lib/invoiceBalances.ts` (`decorateInvoiceWithBalances`). Restores start-end time rendering on invoices and PDFs via `formatJobTime(job)` which was previously unpopulated.
- **Shared Job Calc Helper**: Added pure helper `describeJobCalc(job, business)` in `src/lib/invoiceBalances.ts` (safe for Vercel PDF import chain). Formats hourly calculations (`${hours.toFixed(1)} hrs × ${rate.toFixed(2)}/hr` + extras) and flat rates (`Flat rate` + extras) with NaN/null safety.
- **Descriptive Secondary Lists**: Updated "Other unpaid jobs" and "This payment also covered" on both web (`src/pages/InvoiceView.jsx`) and PDF (`api/_lib/invoicePdf.ts`) into compact 2-3 line blocks: (1) Date · Time range (if present) with owing/applied amount on right, (2) Service · <calc>, (3) Part-paid breakdown (`Job total $X.XX incl. HST · paid $Y.YY · owing $Z.ZZ`) when part-paid. Updated "Payments Received" on multi-job invoices to include time range after date.
- **Tests & Build**: Added unit tests for `describeJobCalc` in `src/lib/invoiceBalances.test.js`. Extended `src/lib/invoicePdfRender.test.js` to assert `scheduled_time` and part-paid lines render cleanly to PDF buffer. Verified with temporary real-data check against live QA invoices. 285/285 tests pass, build clean.

## Current version: 0.13.100 - Sep 29, 2026 (invoice UX rework: consolidated money section, due date = invoice date, retitled other unpaid jobs, task 11 b/c/d/e/g)

**v0.13.100**: Invoice/receipt UX rework per Joel QA feedback on v0.13.90/91 (tasks.md #11 b/c/d/e/g):
- **Task D + E (Consolidated money block directly under line items)**: Deleted redundant gray 'Total · Paid · Still owing' bar above table line items in `InvoiceView.jsx`. Consolidated totals, payments received, balance/paid in full, credit note, and alsoPaid into ONE clear, unified block directly below line items with identical layout on web (`src/pages/InvoiceView.jsx`) and PDF (`api/_lib/invoicePdf.ts`): (1) Subtotal, (2) HST when > 0, (3) Invoice Total, (4) Payments Received (date · method · amount with job details for multi-job invoices), (5) Balance still owing (red) or Paid in full ✓ (green), (6) Credit remaining note, (7) alsoPaid items ('This payment also covered: <date · service · $amount>'). Print CSS, `.invoice-scale-wrap`, and `.invoice-footer` preserved intact.
- **Unified Per-Job Badges**: Added pure helper `getJobPaymentBadge(invoice, jobId)` in `src/lib/invoiceBalances.ts` returning `{ kind, text, paid, owing }` with identical text (`Paid in full ✓` / `Paid $X · Owing $Y`) used by both `InvoiceView.jsx` and `invoicePdf.ts` to eliminate text drift. Complies strictly with Vercel PDF import chain constraint (no JS imports in `api/_lib/invoicePdf.ts`).
- **Task B (Retitle customer-facing 'other jobs' section)**: Retitled section in both `InvoiceView.jsx` and `invoicePdf.ts`: heading 'Other unpaid jobs', sub-line 'These are not part of this invoice\'s total. Shown so you can see everything still owing.', and total row 'Total still owing, all jobs'.
- **Task C (Owner panel add-jobs count)**: Fixed button count and enable condition in `InvoiceView.jsx` and `PostJobSheet.jsx` to derive strictly from addable jobs (`otherUnpaidJobs` intersected with checked IDs), preventing stale button counts or showing 'Add 0 jobs to invoice'.
- **Task G (Invoice due date = invoice date)**: Removed Net-7 terms math (+7 days) in `src/data/invoicesRepo.js` (`generateInvoiceForJob`) and extracted `computeInvoiceDueDate(scheduledDate)`. Due date now defaults to the invoice/scheduled date on both insert and update. Added unit test in `src/data/invoiceDueDate.test.js`. Existing invoices will pick up the new rule upon update.
- **Tests & Build**: Extended `src/lib/invoicePdfRender.test.js` to verify real `renderToBuffer` on unpaid invoice with partial payment, paid-in-full receipt with alsoPaid, and invoice with otherOutstanding. Added unit tests for `getJobPaymentBadge` in `src/lib/invoiceBalances.test.js`. 280/280 tests pass, build clean.

**v0.13.101**: Admin request intake + error log UX rework (tasks.md #12). Finished requests (`done`/`declined`) with no activity for 72h are no longer fetched at all (a query filter on `client_requests.updated_at`: no flag, no cron, no migration). Admin requests are split into a sorted "Needs attention" list (new, triaged, planned; oldest first) and a collapsed "Finished (N)" group; every row header has a status pill; an "Older finished" button loads older ones on demand only. `saveRequestAdmin` now also bumps `updated_at` when it only inserts a reply, so a reply restarts the 72h clock. The `context` jsonb is dropped from list queries and fetched on row expand (`fetchRequestContext`). Error Log is collapsed by default with a count-only mount query, lists only unresolved errors on expand (grouped by source+message via `src/lib/errorGrouping.js`), has a per-group Resolve button (sets `resolved_at`) and a lazy Resolved sub-section. Migration `supabase/migrations/20260929010000_add_error_logs_resolved.sql` (adds `error_logs.resolved_at` + an admin-only UPDATE policy) is live (confirmed 2026-09-30). 284/284 tests pass, build clean.


## Current version: 0.13.99 - Sep 28, 2026 (surplus-credit screen copy fix, task 11a)


**v0.13.99**: Reworded `src/components/sheets/PostJobSheet.jsx`'s surplus-spillover screen (the phase shown after an overpaid job completion — around line 542-645). Root cause of the "it asked to apply the credit again" confusion (Joel, forward-queue item 11a — checked the live `payments`/`client_credits` data first, confirmed no actual double-charge exists): `recordPayment()` in `src/data/jobsRepo.js` (line 810-818) already silently auto-issues the surplus as account credit the instant the job is saved; this screen then immediately asks what to do with that already-existing credit, but the old copy ("Apply $X to these jobs" / "Keep $X as credit instead") read like a fresh apply-or-not decision instead of a routing choice for money that's already credit. New copy states the credit already exists up front ("{client}'s account now has $X in credit... already saved as credit"), and both buttons now say "Send"/"Leave" instead of "Apply"/"Keep... instead". No logic change — money flow is untouched, this is copy-only. 268/268 tests pass, build clean.

## Current version: 0.13.98 - Sep 28, 2026 (request/bug-report email subject + close-copy fix, task 9a)

**v0.13.98**: Built `tasks.md` item 9a (Joel, found sending the v0.13.95/96 close emails): request/bug-report notification email subject + copy quality.
- **Subject line** (both directions — the new-submission email to Joel via `notifyRequest`, the done/reply email to the submitter via `handleNotifyRequest`, and the reopened alert to Joel via `notifyRequestReopened`): was `row.title`, which is `deriveTitle()`'s raw first-line-truncated-to-79-chars headline (`src/lib/requestFormatting.js`) — read as a mechanical repeat-and-cut sitting right next to the email body's own "Request: {title}" callout. New `summarizeSubject(gemini, title, body)` helper in `api/ai/[action].js` rewrites it to a short (≤8 words) plain-English fragment via Gemini; non-fatal, falls back to the raw title on any failure or missing key so a notification email is never blocked by this. `client_requests.title` itself (DB column, in-app UI) is untouched — only the email subject changed, no extra latency risk on the synchronous client-side submit path.
- **Copy** ("Fixed…" emails read as plain status-flip text): root cause was that `buildRequestEmailHtml`'s "Joel's Reply" block already renders fully when `replyBody` is non-empty — it just had nothing to render when Joel closed a request without typing anything (exactly what happened for the 4 closes on 2026-09-27). Added `DEFAULT_DONE_BODY` (`"We looked into this and it's fixed now — thanks for flagging it!"`) — applied only when `variant === 'done'` and no reply was typed. Deliberately generic/non-AI-generated: inventing "what was fixed" from the title alone in a customer-facing email risks a false claim Joel never confirmed. `'reply'` variant is untouched — an empty reply there is an admin-UI mistake, not something to paper over.
- 268/268 tests pass, build clean. No new serverless function, no schema change — `api/ai/[action].js` only.

## Current version: 0.13.97 - Sep 28, 2026 (push_subscriptions RLS reclaim fix, migration only)

**v0.13.97**: Scoped and fixed forward-queue item 8a (`push_subscriptions` RLS insert blocked, seen twice 2026-09-27 in a bug-report's auto-captured error log). Root cause: `usePushSubscription.js`'s `upsertSubscription()` does `.upsert(..., {onConflict:'endpoint'})`, but `endpoint` is globally `UNIQUE` while the old `push_subscriptions_modify` policy (`FOR ALL`, `USING (user_id = auth.uid())`) required the CURRENT user to already own the row before it could be updated — so a device re-subscribing under a different logged-in user (account switch on the same browser, no prior unsubscribe — exactly the QA-account testing pattern) always 401'd instead of reclaiming its own row. New migration `supabase/migrations/20260928070000_fix_push_subscriptions_reclaim.sql` splits the policy into separate insert/update/delete: update's `USING` is relaxed to `true` (any authenticated user may take over a device's subscription row, which is the wanted behavior — the endpoint identifies whoever most recently subscribed) while `WITH CHECK` still pins the row to `auth.uid()`/`my_business_id()`; delete keeps the original ownership check. Split into 3 policies instead of reusing `FOR ALL` on purpose — a `FOR ALL` policy's `USING` also gates `SELECT` (permissive policies OR together), so `USING(true)` there would have let any authenticated user read every business's push credentials (`endpoint`/`p256dh`/`auth`) through the existing `push_subscriptions_select` policy's OR. **Migration is live (confirmed 2026-09-30).** No app code changed, no deploy needed for this fix; only the DB policy.

**v0.13.96**: QA on v0.13.95 (real device test, `jlundie+test@gmail.com`) surfaced a gap: an owner's reply auto-reopens `done → triaged` but Joel had no way to know it happened short of checking Admin. Added `notify-request-reopened` to `api/ai/[action].js`'s `NON_AI_ACTIONS`/router — a plain-text alert email to `ALERT_EMAIL` (same style as the existing `notify-request` new-submission email), fired from `replyToRequest` in `src/data/requestsRepo.js` (fire-and-forget, only ever called from a `done` request's reply box, so every call is a reopen). Does not touch the owner-facing notify rule from `decisions.md` 2026-09-27 (her own reply is still never re-emailed to her — that was deliberate, not this gap).

**v0.13.95**: Bug-report reply loop, thread table, and branded notifications (task 9):
- Added migration `supabase/migrations/20260927060000_add_request_messages.sql`: `request_messages` table for request conversation threads with RLS (`is_admin()` or `my_business_id()`), explicit Data API grants, and security definer trigger `trg_reopen_request_on_owner_reply` auto-reopening requests from `done` to `triaged` on owner reply. Includes commented `-- DOWN:` block. (Live, confirmed 2026-09-30).
- Updated `api/_lib/mailer.js`: `sendMail` accepts optional `from` address, defaulting to `"Supermom Alerts" <${gmailUser}>`.
- Added `api/_lib/brandedEmail.js`: `buildRequestEmailHtml` generates clean branded HTML emails matching `api/invoice.ts` aesthetic (`#FC4693`, logo) for `done` ("Your bug report / idea is fixed") and `reply` ("Joel replied to your request") notifications.
- Updated `api/ai/[action].js`: added `notify-request-done` and `notify-request-reply` to `NON_AI_ACTIONS` and router. Sends branded email `From: "Supermom Support" <support@supermomforhire.com>` to the submitter and dispatches lockscreen push to owner subscriptions.
- Updated `src/data/requestsRepo.js`: added `listRequestMessages(requestId)`, `replyToRequest(requestId, businessId, body)`, and combined `saveRequestAdmin(id, businessId, { status, oldStatus, replyBody })` which updates status, appends reply to thread, and fires exactly one notification (`done` or `reply`).
- Updated `src/components/sheets/MyRequestsSheet.jsx`: lazy-loads and renders thread messages chronologically under request body, preserving historical `admin_notes` at the top; displays reply box with Send reply button only on `done` requests, auto-refreshing list to `triaged` upon send.
- Updated `src/pages/Admin.jsx`: renders read-only thread messages above reply textarea; Save button executes `saveRequestAdmin`, updates local status, clears draft, and refreshes thread.
- Added unit tests in `src/data/requestsRepo.test.js` validating `saveRequestAdmin` notify dispatch branching (all 19 test files pass).

**v0.13.94**: Home card money clarity, louder notes, and louder credit button:
- Wrap-up job cards on Home now show the amount owing (`remaining`, or `total` if uncomputed). If hourly without actual duration recorded yet, prefixes `~` and appends `est.` (`computeJobFinancials` falls back to `estimated_hours`).
- Moved paid/credit breakdown into a right-aligned vertical stack directly beneath the amount in Row 2 of `JobCard` (`$X paid · incl. $Y credit`). Removed legacy separate left-aligned paid line.
- Exposed `credit_paid` on `DisplayJob` (queried from `payments` where `payment_method = 'Credit' && !is_void` in `useJobs` via `selectors.ts` `toDisplayJob`). Added unit tests in `selectors.test.ts`.
- Made `NoteCallout` in compact mode (on cards) more prominent: increased font size to 12.5px, weight to 600, with full ink color contrast (`T.ink` or white on dark cards).
- Styled "Change back to credit" button in `JobDetailSheet.jsx` with prominent pink outline (`1.5px solid #FC4693`), bold text, and bold pink header ("Paid $X from {client}'s credit").
- UI-only update: no DB writes, no alterations to payment/credit math.

**v0.13.93**: Unwind spent credit on job revert to eliminate ledger deficit:
- Updated `revertJobToPreCompletion` in `jobsRepo.js`: fetches `client_id` before mutation; after voiding payments and deleting this job's credit ledger rows, checks client credit balance. If balance is in deficit (< -$0.009), iteratively unwinds newest applied credit rows via `moveCreditBackFromJob` until deficit is eliminated (capped at 50 iterations); returns `{ unwoundJobIds }`.
- Updated `JobDetailSheet.jsx`'s `handleRevertJob` to display an info toast when credit from other jobs was unwound (`Also removed credit from N other job(s) — it came from this job's payment.`).
- Enhanced mock Supabase builder in `creditsSpillover.test.js` to support `.order(col, opts)` and `.limit(n)`.
- Added unit tests for unwinding spent credit on revert (single job unwind, balance >= 0 no-op, and newest-first multi-job unwind with overshoot).

**v0.13.92**: Clean up credit on job revert and cap spillover to available balance:
- Updated `revertJobToPreCompletion` in `jobsRepo.js` to void payments (`is_void: true`) instead of hard-deleting, and delete all associated `client_credits` ledger rows (`issued`, `applied`, `reclassified_to_tip`) keyed to the reverted job.
- Added immediate `notifyDataChanged()` call in `JobDetailSheet.jsx` on revert and clarified confirm text ("Void payments and revert this job to Scheduled? The invoice will be voided.").
- Capped spillover in `PostJobSheet.jsx` to fresh `getClientCreditBalance` via `calculateSpilloverAmount(surplus, creditBalance)` so negative or zero credit balance never offers phantom spillover or displays surplus notices; all spillover copy, helper calls, and button labels strictly use `surplusAmount`.
- Added unit tests for `calculateSpilloverAmount` in `paymentPreview.test.js` and `revertJobToPreCompletion` in `creditsSpillover.test.js`.

**v0.13.91**: Overpayment at completion spills over to client's next unpaid job(s) per Joel's decision (automatic spillover with option to keep as credit):
- Added `applyCreditToJobs` and `moveCreditBackFromJob` in `creditsRepo.js`: atomic payments insertion with `payment_method = 'Credit'`, ledger tracking with `client_credits` (`kind: 'applied'`), and dynamic status re-derivation from non-void payments.
- Added `splitSurplusToJobs` in `paymentPreview.js`: allocates surplus across older unpaid jobs first with human-readable preview lines and leftover credit calculation.
- Replaced completion bundling tickbox on Paid/Partial in `PostJobSheet.jsx` with an automatic surplus spillover panel allowing one-tap allocation or keeping as client credit. Added receipt banner with "Change to credit instead" undo.
- Added credit return card in `JobDetailSheet.jsx` (`ReadMode`) with two-tap confirmation to reverse applied credit back to client balance via `moveCreditBackFromJob`.

**v0.13.90**: Payment clarity and bundling UX improvements:
- Live payment breakdown preview under amount input showing exactly how payments allocate per job.
- Persistent post-settlement receipt box on the invoice screen detailing the payment breakdown per job with dismiss button.
- Plain invoice summary row (`Total · Paid · Still owing`) at the top of line items, and persistent per-job status badges (`Paid in full ✓` / `Paid $X · Owing $Y`) visible even when fully paid.
- Replaced generic "Tap again to undo" with exact dollar amount and date (`Undo the $X.XX payment recorded Mmm D?`) via `getLastPaymentRound`.
- Clarified completion bundle copy in `PostJobSheet.jsx` (unpaid vs paid/partial) with feedback toast on add.
- Clarified other unpaid jobs section on invoice with client-specific heading and auto-hide when empty.

**v0.13.89**: Fixed bug where newly added clients wouldn't immediately appear in the client list by adding missing `notifyDataChanged` call in `NewClientSheet.jsx`.

**v0.13.88**: Three builds + one `/code-review high` pass on them (10 findings, all fixed before commit).
1. **Invoice partial payments (Phase 4 Item 9, rebuilt by Claude — Gemini's branch was not merged).** InvoiceView's Record Payment panel has an optional amount (blank = full). `src/lib/paymentWaterfall.js` (`allocatePayment`, integer cents, **oldest job first**, **overpayment rejected per Joel** — overpay→credit still only via `recordPayment`). `settleInvoiceOutstanding(invoiceId, method, jobIds, paymentAmount)` does **one bulk `payments` insert per call** (rows share `created_at` = one "round"), then batched status writes (`applySettlementStatuses`): jobs Paid/Partial; an invoice flips to Paid only when **every** job on it is paid (current and bundled invoices alike); invoices never get `'Partial'` (CHECK constraint). If status writes fail after payments saved, it throws `err.paymentRecorded` and the UI reloads + clears the amount instead of offering a double-charging retry. `voidInvoiceSettlement(..., { lastRoundOnly: true })` backs the toolbar's "↩ Undo last payment" (legacy row-by-row settles grouped by a 10s window); undo never flips an invoice *to* Paid. PAID / PARTIAL line-item badges in web + PDF via shared `jobPaymentBadge()` in `invoiceBalances.ts` (payments-derived, never `jobs.payment_status`).
2. **Live-GPS leave alerts (was Next-up #0).** Home persists the live GPS+traffic reading for the next job she's driving to as `ai_context.drive_to_live {durationValue, duration, computed_at}` (separate key — `drive_to` untouched). Sweep uses pure `resolveDriveSeconds()` in `pushAlerts.js`: live if < 3h old → static chain → `DEFAULT_DRIVE_MIN`. `isLeaveDue` takes `gateLeaveAt` (static estimate) for the late-booking gate so a *longer* live drive still fires instead of being suppressed. `updateDailyRoutes(jobs, homeAddress)` takes the home address from `businesses.address` (+city/province/postal), fallback `DEFAULT_HOME_ADDRESS` town-level — **check Sandra's `businesses.address` is populated**, otherwise the chain still starts from "Georgetown, ON". Reschedules (JobDetailSheet and Statler `supermom_edit_schedule`) clear both `drive_to` and `drive_to_live`. `patchJobAiContext` is now serialized per job (it's read-merge-write; concurrent drive_to/drive_to_live writes clobbered each other).
3. **Drive-chain staleness.** The Scheduled-only chain filter had already landed in `97b2b22`, but auto-recompute only fired when `drive_to` was undefined, so completing job 1 left job 2's "Previous Job" leg stale (and the leave alert read it). `drive_to` now records `from_job_id` (+ `from_home` on leg 1); Home recomputes when either no longer matches, and waits for the business row before computing.

**v0.13.87**: Merged `gemini/phase4` (Phase 4 Item 8) plus a fix-up. Gemini's patch inferred `scopeBusinessId` for a global admin (no viewpoint → `businessId: null`) but the business-details block still read the raw `businessId` param, so owner name/persona never reached the prompt — the fix did nothing. Now `api/ai/chat.js` infers scope from the client (via `assertClientAccess`) or job, and the business block keys off `scopeBusinessId` (non-admins also now always get their own business's persona). Gemini's QA-business fallback for subject-less admin chat was **dropped per Joel** — generic admin chat stays persona-less (unlike `dayBrief`, which keeps its `is_test` fallback). `[action].js` untouched. `gemini/phase4-item9-invoice-waterfall` (partial-payment waterfall) **reviewed and bounced back to Gemini, NOT merged** (later rebuilt by Claude in v0.13.88) — 10 findings incl. broken Email (dropped `authHeaders` import), overpayment credit insert violating `client_credits` schema, `invoices.status='Partial'` violating the CHECK, amount input never wired, and a v0.13.67 regression in InvoiceView's date/time helpers. Handoff: `docs/handoffs/2026-09-27-item9-invoice-waterfall-review.md`.

**v0.13.86**: Fixed the geolocation timeout race in `Home.jsx` (`fetchLocationDrives`) that was causing native valid fixes to get rejected by an overly aggressive JS fallback timer.

**v0.13.85 (this session)**: Fixed 5 small UI bugs reported by Sandra captures:
1. `LogoBar.jsx`: Added `flexShrink: 0` to prevent the AI chat button from pushing the avatar out of bounds on smaller screens.
2. `Home.jsx`: Changed weekly revenue logic to explicitly check `weekOwed <= 0` instead of `collectedThisWeek >= displayRevenue`.
3. `Home.jsx`: Added timeout fallbacks to `navigator.geolocation.getCurrentPosition` calls in `handleSupermomGo` and `fetchLocationDrives` to prevent infinite hangs. (Note: `fetchLocationDrives` fallback removed in v0.13.86).
4. `InvoiceView.jsx`: Moved the `handleUndo` button inside the main toolbar flex container to fix misalignment.
5. `NewJobSheet.jsx`: Updated the duration stepper to use 15-minute increments instead of 30.

**v0.13.84**: Fixed unclosed CSS grid wrapper divs and dangling syntax in Admin.jsx requests lists. Wired up the Nudge feature in MyRequestsSheet.jsx to correctly append follow-ups for requests older than 48 hours.

**v0.13.83 — Sep 26, 2026 (Statler schedule edits)

**v0.13.83**: Added `supermom_edit_schedule` to `api/ai/[action].js` so Statler can edit existing jobs. Also patched `supermom_schedule_job` to trigger Google Calendar sync.

**v0.13.82 — Sep 26, 2026 (LIVE on main; Statler voice booking)

**v0.13.82 (this session)**: Fixed a follow-up issue with recurring series edits in `jobsRepo.js` where unrelated `ai_context` fields from the edited job (e.g. custom keys) would overwrite those of other jobs in the series. The series update now diffs the incoming `ai_context` patch against the fresh DB state of the job being edited, only propagating keys whose values actually changed, safely avoiding hardcoded exclusions.

**v0.13.81**: Fixed two critical phase-2 review findings and performed cleanup:
1. `jobsRepo.js` series updates now use a read-then-merge per-job approach to prevent wiping out job-specific `ai_context` fields like `gcal_event_id`.
2. `JobDetailSheet.jsx`'s `drive_to` clear logic now correctly normalizes time strings (e.g. `HH:MM` vs `HH:MM:SS`) for comparison, and properly deletes the `drive_to` key instead of setting it to `null`.
3. Guarded `limit` argument in `api/ai/[action].js`'s `supermom_read_schedule` with a fallback to the documented default `10` if out-of-range or NaN.
4. Deleted dead `patch.js` root file and removed unused `roundToHalfHour` functions from detail/new job sheets.

**v0.13.80**: Fixed a bug where invalid 12-hour times (e.g. "13pm") were silently parsed into valid 24-hour times ("13:00") by `supermom_schedule_job` instead of being rejected. Added a bounds check (1-12) to the AM/PM parser so out-of-range times fall through to the strict `HH:MM` format validation and return a 400 error.

**v0.13.79**: Statler-tool candidate-disambigation UX hardening. When `supermom_schedule_job` hits multiple clients matching a name, response now includes `total: <count>` and caps `candidates[]` to the first 5 (prevents oversized payloads if a name is very common). The `result` message is now dynamic (`"${clients.length} clients match — ask the user which one."`), informing the caller how many were found. This is a backend-only change to `api/ai/[action].js`'s `statlerTool` handler, no schema migration, no new serverless function.

**v0.13.78**: Mobile layout fixes for v0.13.77. Fixed iPhone PWA bottom nav disappearing by adding `minHeight: 0` to flex layout and 0px fallback to `env()`. Fixed MyRequestsSheet / RequestSheet swipe-to-close by replacing dummy handle with `GrabBar`.

**v0.13.77**: "My requests" support-ticket view (Sandra's ask: where do replies to "Tell Joel" show up). New `MyRequestsSheet.jsx` (status badges for all 5 statuses in plain words via `REQUEST_STATUS_BADGES` in `requestFormatting.js`, "Joel's reply" block from `admin_notes`), mounted from the existing `RequestSheetProvider` (`openMine`). Entry points: "📬 My requests" in BottomNav's + menu (both option arrays) and a ToolRow in Admin → Tools. Compose sheet opens **stacked on top** of the list (not swapped — close+open in one tick races `useBackClose`), list refetches via a `refreshToken` prop (not a React `key` — remount would re-run the hook's history pop/push). `listMyRequests()` filters by `business_id` (so "view as" works), `updateRequestAdmin()` saves status + reply together (blank → null). Admin → Super Admin: Requests now has a per-row reply textarea + one Save button (replaced the old immediate-write status select). No migration, no new serverless function. Verified: Playwright against a **production build** (`vite preview`, SW blocked for route mocks) — list, badges, reply block, stacked compose, refetch, Back-close all pass; also a real QA-account read rendered the empty state (RLS ok). **Not verified at all:** the Admin reply editor was never rendered, only built and linted. The section is `isSuperAdmin`-gated and update RLS is `is_admin()` only, so QA can't reach it. Joel tests it on his own account. Push-to-submitter on reply deferred (would need a server action).

**v0.13.76**: Anthropic→Gemini AI provider swap — see Bugs section above for full detail. `api/ai/[action].js` and `api/ai/chat.js` ported from `@anthropic-ai/sdk` to `@google/genai` (new shared helper `api/_lib/gemini.js`, model `gemini-3.6-flash` with thinking disabled). Confirmed live against the deployed Vercel app.

Agentic-AI-summary rebuild (`second-brain/00-inbox/2026-09-18-supermom-agentic-ai-summary-design.md`) is live through v0.13.75, including Stage D (Home hero day-brief line, dropped "See full schedule" link — landed after v0.13.75's tag, package version wasn't bumped for it at the time): new `ai_briefs` table + `client-brief`/`day-brief` actions (v0.13.73), `JobDetailSheet` command-brief card rewrite + `PrepNoteSheet` retirement (v0.13.74), `enrichClient()` client-name bug fix + prod `synthesis_note` cleanup (v0.13.75), Stage D + version/commit-hash footer + changelog trim (untagged commits between v0.13.75 and v0.13.76). Rebuild is now complete, all four stages shipped.

**Also live and stable** (v0.13.41–v0.13.70, all pushed; device-test backlog CLOSED 2026-09-17): lockscreen push notifications (v0.13.72, heartbeat confirmed end-to-end), job-note visibility v2 (v0.13.71), "Tell Joel" in-app request pipeline (v0.13.69), client account credit (v0.13.49), carried-forward client notes (v0.13.62/68), keyboard/viewport fix series (F1–F4, closed), plus security/data-integrity fixes (RLS self-escalation, invoice PII whitelist, payments void filter, stale-model 404 fix).

**Open items (not yet device-confirmed):**
- v0.13.74's rewritten command-brief card — needs a real-device pass (drive time + prefs + unpaid balance + watch_for all present, worst-case height).
- v0.13.72 lockscreen push + v0.13.71 note-visibility pills — Joel's own device test still outstanding (tracked in second-brain `today.md`).

Full version-by-version history (v0.13.41 through this version): `git log -- CLAUDE.md` in this repo. Earlier history (v0.12.86–v0.13.39): `docs/archive/CHANGELOG-v0.13-archive.md`.

**⚠️ STANDING RULE (2026-07-17, added after an autonomous subagent push): before running `git push` on `main` in this repo, stop and get Joel's explicit confirmation first — and state it unambiguously as "this deploys directly to LIVE PRODUCTION" (name the domain), never generic language like "ready to commit and push?". Joel wants push-to-main to keep deploying live (that's confirmed, desired behavior) — he wants a clear, un-skippable moment where he consciously says yes to *that specific* production push, every time, including from dispatched subagents. Bake this into any subagent prompt that could reach a push step; don't assume it infers this.**

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

**⚠️ STANDING RULE (2026-09-14, sharpened 2026-09-20): Opus needs Joel's go-ahead first, every time — weekly Claude usage is tight.** Don't auto-escalate to Opus (`Agent(model:"opus")`, `/model opus`) on a judgment call the way Sonnet/Haiku get used freely — ask first. Any mechanical/rote task (typo fixes, renames, formatting, boilerplate, bounded simple edits) is **mandatory** Haiku delegation (`Agent(model:"haiku")`) — no "faster inline" exception — or route to Gemini Pro (Antigravity) if that's the better fit, when a task doesn't clearly need Sonnet-or-above reasoning. State one line every time either way: "Routed to Haiku: `<what>`" or "Kept inline: `<why it wasn't actually mechanical>`." Same flag-first treatment for Claude-in-Chrome browser automation (expensive, not restriction-gated the same way, but call it out). Full detail: `second-brain/05-systems/tool-routing.md` and `second-brain/02-dashboard/decisions-log.md` 2026-09-14 and 2026-09-20.

## Critical rules — read before every build
- **Read `DESIGN.md` before writing any component** — all tokens, typography, component anatomy defined there
- **Mobile-first** — design for 390px iPhone viewport first
- **Keyboard aware** — use `useKeyboardFocus` hook to adjust padding in bottom sheets
- **Increment version** in `package.json` on every meaningful release
- **Test on both** Joel's Pixel 10 Pro (Android) and Sandra's iPhone

---

## Open items

> **Sync rule**: every change to `api/_lib/invoicePdf.ts` must be mirrored in `InvoiceView.jsx` before commit.
> Vercel Hobby: **11 of 12** serverless functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `ai/chat`, `admin/provision`, `admin/ai-toggle`, `reminders/[action]`. (2026-09-18, v0.13.72 — added `reminders/[action]` for lockscreen push; named generically because the separately-approved SMS-reminders design is built to ride this same function once its own Twilio Phase-0 is done, at no additional slot cost.)
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock).

### ✅ Recent Changes

- **2026-09-26**: Fixed Phase 1 High-Friction UI Bugs: Removed time picker snapping to :00/:30 increments in `NewJobSheet.jsx`/`JobDetailSheet.jsx`; fixed a `gcal_event_id` copying bug during series edits in `jobsRepo.js` that caused orphaned duplicates on Google Calendar; ensured `drive_to` is cleared on time/date changes to force recalculation and prevent stale push reminders; fixed "Calculating drive time..." getting stuck indefinitely in `Home.jsx` when location fails by falling back to "Drive time unavailable".
- **2026-09-26**: Added stopword filter ("and", "the", "for", etc.) to the fuzzy client-search fallback to stop connector words causing false-positive matches (e.g. "and" matching "Alexander").
- **2026-09-25**: Fixed fuzzy client search in `supermom_schedule_job` and `supermom_mark_paid` to check all name tokens instead of just the first, fixing edge cases with complex names.
- **2026-09-26**: Added `supermom_read_schedule` AI handler to `api/ai/[action].js` for the Statler voice bridge integration to allow schedule reading.
- **2026-09-25**: Added `supermom_add_client` and `supermom_mark_paid` AI handlers to `api/ai/[action].js` for the Statler voice bridge integration.

### 🔴 Bugs / Active issues

- ~~**Fixed + live (confirmed 2026-09-30)**~~: `push_subscriptions` insert/update blocked by RLS on account-switch-same-device re-subscribe — see v0.13.97 above. Migration `20260928070000_fix_push_subscriptions_reclaim.sql` applied.
- ~~`todayJobs` drive-time chain included Completed jobs~~ — **FIXED** (filter in `97b2b22`, stale-leg recompute via `from_job_id` in v0.13.88).

**Resolved 2026-09-22**: agentic AI summaries/titles had silently stopped generating after Joel pulled `ANTHROPIC_API_KEY` (freeing budget for Gemini's Twilio/live-agent-assist work elsewhere) — every AI handler degrades to a mock/skip fallback when its LLM client is `null`, no hard error. Fixed by porting `api/ai/[action].js`/`api/ai/chat.js` from `@anthropic-ai/sdk` to `@google/genai`. Took two real wrong turns to land: Google changed Gemini key issuance 2026-05-28 to service-account-bound "Auth keys" (`AQ.` prefix) — an AI-Studio-auto-issued one had a broken binding and 401'd, fixed by creating the key explicitly via Cloud Console bound to an existing service account; and `gemini-2.5-flash` 404s on new-format keys, its replacement `gemini-3.6-flash` defaults to internal "thinking" that silently ate the whole output-token budget, fixed with `thinkingConfig: { thinkingBudget: 0 }`. Confirmed live: hit the deployed Vercel endpoint directly (QA-account Supabase auth) and got a real Gemini-generated response back. Full detail: Tech Stack / Security & Environment sections above, and `second-brain/03-projects/active/supermom/tasks.md` 2026-09-22 entry.

**Resolved 2026-09-18**: pg_cron reminders sweep was scheduled correctly (`select * from cron.job` confirmed active, `*/5 * * * *`, hitting the right URL) but every tick 401'd — the vault secret `reminders_sweep_secret` didn't match Vercel's `CRON_SECRET` (likely never matched from the original migration run). Fixed by rotating `CRON_SECRET` to a fresh value in both places (Vercel env + redeploy, then `vault.update_secret(...)` to match) rather than trying to recover the old one — Vercel had it marked sensitive/unrecoverable. Confirmed end-to-end: a real scheduled tick at 11:10 UTC returned 200 and wrote the heartbeat. This also rotates the same secret `api/briefing/daily.js`'s cron uses (shared var) — no separate action needed there, Vercel Cron reads the env var fresh each invocation. Also rotated the VAPID keypair (old one had appeared twice in a build-session transcript, not committed/public but cheap to rotate) — Production + local `.env` updated, client self-heals per `usePushSubscription.js`'s existing rotation-detection logic. The carried-forward client note persistence bug (found 2026-09-16) was fixed in v0.13.68 — see above. Resolved-bug history lives in `docs/archive/CHANGELOG-v0.13-archive.md`.

> **Constraint**: Vercel at 11/12 serverless function slots. One slot left — defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

0. ~~Live-GPS drive time feeding the leave-alert push~~ — **BUILT v0.13.88** (see version notes). Needs a real-device check: open Home before a job, confirm `drive_to_live` is written and the leave alert timing follows it.

3. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
4. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
5. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

6. **Voice scheduling** — `transcribe-voice-note` action already exists in `api/ai/[action].js` (not a separate file, corrected 2026-09-17). Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
7. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
8. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
9. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
10. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

17. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.

### 🧹 Housekeeping (surfaced from second-brain reconciliation, Jul 16)

~~Anthropic API credits exhausted~~ — **DONE 2026-08-16.** $5 topped up per Joel.
~~Ask Sandra what confused her about old Schedule page~~ — **CLOSED 2026-08-16, Joel's call.** Long resolved, not worth chasing.
~~Backup zip refresh~~ — **CLOSED 2026-08-16, Joel's call.**

~~Check for residual fake `ai_context.learned` data on real clients~~ — **DONE 2026-08-07.** Queried `clients` table directly: 2 clients (Ann Rae, Maria Nguyen) had identical templated fake data from the removed `simulateAILearning` button ("After 10 sessions, I've learned that X prefers the back entrance..."). Cleared `ai_context.learned` on both, verified 0 remaining across all 75 clients.
- v0.13.79: Hardened statler-tool endpoint auth and job scheduling constraints
