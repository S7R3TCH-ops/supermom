# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is authoritative project state. Do NOT rely on memory files — they drift.
> **Drift check (every session)**: Run `git log --oneline -10` and verify recent changes are documented here.
> **Second-brain sync (every session, mandatory)**: This repo is tracked in `C:\Projects\second-brain\03-projects\active\supermom\`. Whether this session is running here directly (CLI or Antigravity) or was routed from second-brain, before ending the session update that project's `status.md` (current state) and `tasks.md` (next actions) to match what actually happened — same as if the session had been rooted in second-brain. Don't rely on this repo's own docs (this file, `HANDOFF_NEW_SESSION.md`) as the cross-session source of truth for planning/priorities; second-brain's `status.md`/`tasks.md` are. If you can't reach that folder from this session, say so explicitly instead of silently skipping the update.
> **Gemini handoff routing (standing rule, added 2026-07-15)**: When Joel says "execute the instructions/plan Gemini brainstormed" (or equivalent — no file path given), auto-look in `C:\Projects\second-brain\00-inbox\gemini\`, take the most recently modified `.md` file, read it, and execute — don't ask Joel for the path.
> **Gemini access (updated 2026-10-19)**: Gemini/Antigravity started tests-only (Phase-0, 2026-07-16) and has been a branch-writer since 2026-09-25. Current write surface and git rules live in this repo's `GEMINI.md`; history in `second-brain/03-projects/active/supermom/decisions.md`.
> **One project, no "v2" (2026-10-10, Joel)**: This repo is the only Supermom app. There is no Supermom v2. `C:\Projects\supermom2` is a parked Next.js rewrite scaffold (frozen 2026-07-07, also the creator-ops fork origin), not a second version of the app; describe it as "the rewrite scaffold", never "v2". The `supermom-v2.vercel.app` hostname is just the Vercel project's default domain for this same app.

---

## What we're building

Multi-tenant solopreneur operations platform, deployed as **Supermom for Hire** for Sandra (Georgetown, ON; Client #1). Roles: `admin` (Joel, no business, switches "Viewpoints") and `owner` (scoped to `business_id`). Full detail: `docs/reference/platform-overview.md`.

---

## Design Context

`PRODUCT.md` (strategic) and `DESIGN.md` (visual) are source of truth for all design work — read both before touching UI. Brand personality: **"kick-ass Mary Poppins"** — capable, warm, unflappable. Anti-references: AI-slop look, cartoon-superhero iconography, cold corporate SaaS.

---

## Tech Stack

React (Vite), Supabase (Auth + Postgres), Vercel, React Context state, inline styles via `tokens.js` (no Tailwind classes). AI is Gemini (`@google/genai`, `gemini-3.6-flash`, thinking disabled) through `api/_lib/gemini.js`; `GEMINI_API_KEY` is Vercel-env only (see Security & Environment). Full table: `docs/reference/tech-stack.md`.

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
Public route `/i/:id` (no auth). **Every change to `api/_lib/invoicePdf.ts` must be mirrored in `InvoiceView.jsx`.** Never mix `logo-banner.png` (app bar) with `logo-final-white-bg.png` (invoice/email). Full detail: `docs/reference/invoice-architecture.md`.

### Daily briefing email
**PAUSED 2026-10-19 (Joel): no `vercel.json` cron entry; nobody uses the briefing yet. Resume = restore `"crons": [{ "path": "/api/briefing/daily", "schedule": "0 11 * * *" }]` in `vercel.json`.** `api/briefing/daily.js` kept, cron was `0 11 * * *`. **The stale-`client_requests` backstop (`daily.js:322-342`) and the send-failure alert ran on the same cron, so they are off while paused.** Auth is `Authorization: Bearer $CRON_SECRET` (Vercel env only, never write the value in any doc). **⚠️ (When the cron is active) DO NOT rapid-redeploy:** every prod deploy re-registers the cron and resets the next-run clock; deploy once from a clean committed tree. Full detail: `docs/reference/daily-briefing-email.md`.

### Drive time architecture
`locationDrives` in `Home.jsx` is ephemeral, never persisted; `updateDailyRoutes()` in `maps.js` persists the pre-calc to `ai_context.drive_to`. Full detail: `docs/reference/drive-time-architecture.md`.

---

## App Icons & Web App Config

PWA manifest lives in `vite.config.js` (VitePWA plugin); icons have `#FC4693` pink baked in, generated via `scripts/generate-icons.mjs`. Full detail: `docs/reference/app-icons-and-web-app-config.md`.

---


## Current version: 0.13.119 - Oct 24, 2026 (iOS PWA invoice PDF share)

**v0.13.119** (branch `fix/sandra-invoice-pdf-onepage`, **NOT pushed / not live**): Sandra's iOS installed-PWA "Download PDF" navigated the whole window to the attachment PDF (no back/save, had to kill the app). `InvoiceView.jsx` now, in an iOS home-screen PWA only (`navigator.standalone`), fetches the PDF and opens the native share sheet (`navigator.share({files})`); Android/desktop, browser tabs and `/i/:id` keep the plain anchor. Helper + tests: `src/lib/pdfShare.js`. **UNVERIFIED on a real iPhone** (share-sheet path, user-activation "Ready - tap to share" fallback). Full: `docs/changelog/v0.13.119.md`.

### Previous: 0.13.118 - Oct 22, 2026 (invoice email deliverability)

**Receipt email pink + date of service (LIVE 2026-10-23, `6f8c5a8`, no version bump):** invoice/receipt email (`api/invoice.ts`) receipt header + button now brand pink, same as invoice (was green since v0.12.20; only the "Paid in Full" line stays green); email shows Date(s) of Service under the number (helper `formatServiceDates` in `api/_lib/invoiceEmail.js`) and in the subject + plain-text part. **PDF and `InvoiceView.jsx` receipt title also pink, plus out-of-range-month guard in `formatServiceDate` (LIVE 2026-10-24, `847cb63`):** email, PDF and web receipts now match; only paid-in-full cues stay green.

**v0.13.118** (LIVE 2026-10-22, `e8d1c0c`, with v0.13.117): invoice email gets a text part, same-domain "View online" link + logo, BCC, recipient validation (typo domains + MX), no fake success when Gmail creds missing. **DNS is the bigger cause and is Joel's (Wix DNS):** two SPF records, no DKIM (`google._domainkey`), no DMARC; see `docs/changelog/v0.13.118.md` and second-brain `tasks.md` 2026-10-22.

### Previous: 0.13.117 - Oct 21, 2026 (invoice email button verifies sent-at; round logo badge in emails)

**v0.13.117** (LIVE 2026-10-22 with v0.13.118): Sandra's `142fec00`. `InvoiceView.jsx` `handleEmail` re-reads sent-at stamps after any failure (needs `invoice_sent_at`/`receipt_sent_at` in `handleJsonRead`'s jobs select, added; changed = sent; no response + no change = "Couldn't confirm - check Sent mail", helper `src/lib/invoiceEmailOutcome.js`) and logs to `error_logs`. Email logo `<img>` now `border-radius:50%` in `api/invoice.ts`, `api/_lib/brandedEmail.js`, `api/briefing/daily.js`. Needs a real-iPhone check. Full: `docs/changelog/v0.13.117.md`.

**v0.13.116** (LIVE 2026-10-14, `fe3890e`): one Google event per job (`docs/changelog/v0.13.116.md`).
- **Open:** Joel runs the Katie repair `--apply` for Sandra's business; delete QA event `rcg8f94t` by hand; smoke-check (move a QA job, expect one event).
- **Do not run** `scripts/sync-upcoming-gcal.mjs` until it reuses the deterministic id.

Older versions: docs/changelog/v0.13.97-to-v0.13.115.md, docs/changelog/, docs/archive/CHANGELOG-v0.13-archive.md; full history: git log -- CLAUDE.md

**Open items (not yet device-confirmed):**
- v0.13.74's rewritten command-brief card — needs a real-device pass (drive time + prefs + unpaid balance + watch_for all present, worst-case height).
- v0.13.72 lockscreen push + v0.13.71 note-visibility pills — Joel's own device test still outstanding (tracked in second-brain `today.md`).

## Standing rules

**⚠️ STANDING RULE (2026-07-17, added after an autonomous subagent push): before running `git push` on `main` in this repo, stop and get Joel's explicit confirmation first — and state it unambiguously as "this deploys directly to LIVE PRODUCTION" (name the domain), never generic language like "ready to commit and push?". Joel wants push-to-main to keep deploying live (that's confirmed, desired behavior) — he wants a clear, un-skippable moment where he consciously says yes to *that specific* production push, every time, including from dispatched subagents. Bake this into any subagent prompt that could reach a push step; don't assume it infers this.**

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

Model tiering and Opus use: see the global ~/.claude/CLAUDE.md 'Model usage' section (changed 2026-10-18). Do not duplicate it here.

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
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock, once the briefing cron is restored).

### ✅ Recent Changes

Dated log: `docs/changelog/open-items-done-2026-10.md`.
- **2026-10-19, live:** daily briefing email paused (see Daily briefing email). Unverified: no email 10-20 11:00 UTC; `OnboardingWalkthrough.jsx` step 3 still promises it. Full: `docs/changelog/open-items-done-2026-10.md`.
- **Open QA, Statler voice (from the 2026-10-05 entry):** no result yet for `supermom_get_job` read-aloud, `supermom_text_me_contact` (bridge `.env` needs `TWILIO_FROM_NUMBER`), delete refusal. Leftover test data to delete by hand: Oscar Grouch 10-07 12:00 Assist job in the Clocked.IN AI business. v0.13.115 voice booking and v0.13.108 voice edit passed in prod.

### 🔴 Bugs / Active issues

No open bugs. Resolved items: `docs/changelog/open-items-done-2026-10.md`.

> **Constraint**: Vercel at 11/12 serverless function slots. One slot left — defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

0. ~~Live-GPS drive time feeding the leave-alert push~~ — **BUILT v0.13.88** (see version notes). Needs a real-device check: open Home before a job, confirm `drive_to_live` is written and the leave alert timing follows it.

3. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
4. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
5. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

Items 6–10 (voice scheduling, smart scheduling, weekly debrief, prep notes, invoice-from-voice): `docs/reference/deferred-ai-features.md`.

### 📱 Phase 2 features

14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

17. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.

### 🧹 Housekeeping (surfaced from second-brain reconciliation, Jul 16)

Done items: `docs/changelog/open-items-done-2026-10.md`.
