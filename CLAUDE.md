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
| Styling | Tailwind CSS + CSS custom properties (see DESIGN.md) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (Postgres) |
| Hosting | Vercel (supermom-s7-r3-tch.vercel.app) |
| Performance | `React.lazy` + `Suspense` code-splitting |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context (no Zustand) |

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

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.**

| Table | Purpose |
|---|---|
| `businesses` | One row per business; `ai_profile` jsonb for persona. |
| `users` | `auth.users.id` → `business_id`, role (`owner`/`admin`/`worker`). |
| `clients` | Business-scoped. `ai_context` jsonb, `tags` array. |
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `flat_rate`, `total_amount`, `actual_duration`, `additional_costs_json`, `worker_id`, `worker_pay`, `worker_paid`, `tax_enabled` (nullable). |
| `payments` | One row per payment transaction. Source of truth for amounts collected. |
| `services` | Service catalog with `default_price`, `default_duration`, `pricing_type`. |
| `workers` | Business-scoped. `person_type` (`'worker'`/`'staff'`), `deleted_at` (soft-delete). No Supabase Auth — picker only. |
| `skill_types` | Business-scoped skill catalog. |
| `worker_skills` | Junction: `worker_id` → `skill_type_id` + `pay_rate`. |
| `job_workers` | Per-job worker assignment (replaces `jobs.worker_id`/`worker_pay`/`worker_paid`). One row per worker on a job — `pay`, `paid`, `paid_at`, nullable `payout_id` FK to `worker_payouts`. Supports multiple workers per job. Migration run 2026-07-22. |
| `worker_payouts` | One row per disbursement event to a Sidekick/Wingmom — `amount`, `payout_date`, `method`, `notes`. Can settle multiple `job_workers` rows at once (bundled payout). Migration run 2026-07-22. |
| `integrations` | OAuth tokens (Google Calendar). |
| `error_logs` | Client + server error capture (source, severity, message, stack, context). Append-only, admin-viewable in Admin page. Migration run 2026-07-15. |
| `storage.job-assets` | Private bucket for job photos and voice notes. |

### Critical data layer rules
- **Multi-tenancy**: Every query must include `.eq('business_id', businessId)`.
- **Soft deletes only**: Never hard-delete jobs, clients, or workers. Set `deleted_at = now()`.
- **Supabase migrations are NOT auto-applied** — run schema changes manually in Supabase SQL Editor.
- **Supabase project ID**: `lskzzsjmmtsosfneuovt`

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
- `api/_lib/invoicePdf.js` — react-pdf builder. Address blocks use single `<Text>` with `\n`-joined children — **intentional**; stacked `<Text>` elements each get their own font-metrics line-box.
- Logo files: `logo-banner.png` (app bar) vs `logo-final.png` (invoice, 492KB) — never mix.
- Settlement payments tagged `payments.invoice_id = <this invoice>` so `decorateInvoiceWithBalances` finds jobs paid via this invoice. Multi-job invoices supported: `decorateInvoiceWithBalances` aggregates across all `invoice_jobs`; `invoiceJobBalances[]` exposed. Single-job assumption removed in v0.12.67.

### Daily briefing email
- **File**: `api/briefing/daily.js` | **Schedule**: `0 11 * * *` (7 AM EDT, in `vercel.json`) | **Secret**: `CRON_SECRET=supermom_daily_email_updates`
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

## Current version: 0.13.42 — Aug 15, 2026 (LIVE, `e131095`)

App is live, Sandra using it daily. Full version-by-version changelog (v0.12.86 through v0.13.39) lives in `docs/archive/CHANGELOG-v0.13-archive.md` — this section only tracks what's currently open.

- **v0.13.42** (`e131095`, Aug 15) — 2 bugs from Sandra's live use, reported via second-brain (`tasks.md` 2026-08-15). (1) **Cancelled job still triggered overlap warning**: `findConflicts()` in `src/data/jobsRepo.js` filtered out soft-deleted jobs (`deleted_at`) but not `job_status === 'Cancelled'` jobs, so booking a new job over a cancelled one's old slot still threw a false conflict. One-line fix: added `if (j.job_status === 'Cancelled') return false;` to the filter. (2) **"Job/client card click doesn't navigate" — audited, could not reproduce.** Live-tested (QA account, Chrome) every screen named in the report — Home (all job-card sections, the "Needs attention" wrap-up list, the Next-Up hero card), Finance (ledger `TransactionRow`, `FinanceDetailSheet` drill-ins), `JobDetailSheet`'s client-name link, and `ClientProfile`'s Recent History rows — all correctly open the job/client detail sheet already. No dead click targets found in current code. Likely explanation: Sandra hit this on a stale cached PWA build (this project has a known recurring stale-service-worker/cache class of bug, see the v0.13.23–27 white-bar saga) rather than a live code defect — nothing here needed a code change. Flagging closed pending Sandra re-confirming on a fresh reinstall; if it recurs, need the exact screen + element she tapped to keep looking. Build clean, Vitest 111/111.
- **v0.13.41** (Aug 8, not yet committed) — calendar picker now shows day-of-week. `WheelDatePicker.jsx` header gains a live weekday line (`new Date(year, monthIdx, day).toLocaleDateString('en-US', {weekday:'long'})`), recomputed on every wheel change — no 4th wheel column (weekday is derived, not choosable). Related fix in the same pass: `Finance.jsx`'s local `dateFmt` (ledger row dates) was missing `weekday:'short'`, inconsistent with the app's shared `dateBrief()` convention used elsewhere (JobCard/UpcomingCard/Home) — added. Build clean, Vitest 111/111.

**Currently awaiting real-device verification** (both are UI/CSS-only, cleanly revertible, no schema changes — not blockers, just unverified):
- **v0.13.40** (`584b73f`, Aug 8) — sheet scroll-region dead-space fix, round 2: v0.13.39's fix only covered JobDetailSheet; this closes the gap between short content and footer buttons on the other sheets with the same header/scroll/footer shape — ServiceCatalogSheet, NewExpenseSheet, PostJobSheet, NewJobSheet. Same technique (`flex:1` → `flex:'0 1 auto', minHeight:0` on the scroll region) applied only where a separate footer sibling exists; skipped WorkerCatalogSheet/FinanceDetailSheet (scroll is the last child), EditClientSheet/NewClientSheet (buttons scroll with the form), PrepNoteSheet (no footer), AiChatSheet (chat input correctly wants flex:1 to stay pinned). Investigated Admin.jsx's similar-looking gap above the bottom nav — confirmed by flex-math trace it's normal underfill on a full-height page (not the sheet bug), left as-is per Joel's call.
- **v0.13.39** (`77b79ee`, Aug 6) — sheet dead-space fix, Invoice/Receipt badge moved to header, Mark Paid/Edit Job row merge, GrabBar safe-area-inset-top padding + top-margin nudge on all 10 height-capped sheets. Needs Sandra's phone-test (notch/Dynamic Island clearance especially — she's back ~2026-08-10). Revert via `git revert 77b79ee` if needed.
- **v0.13.36** (`49adf9e`, Aug 3) — JobDetailSheet admin actions (Revert/Delete) collapsed behind a closed-by-default toggle. Needs confirming the toggle is discoverable in real use.

**⚠️ STANDING RULE (2026-07-17, added after an autonomous subagent push): before running `git push` on `main` in this repo, stop and get Joel's explicit confirmation first — and state it unambiguously as "this deploys directly to LIVE PRODUCTION" (name the domain), never generic language like "ready to commit and push?". Joel wants push-to-main to keep deploying live (that's confirmed, desired behavior) — he wants a clear, un-skippable moment where he consciously says yes to *that specific* production push, every time, including from dispatched subagents. Bake this into any subagent prompt that could reach a push step; don't assume it infers this.**

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

## Critical rules — read before every build
- **Read `DESIGN.md` before writing any component** — all tokens, typography, component anatomy defined there
- **Mobile-first** — design for 390px iPhone viewport first
- **Keyboard aware** — use `useKeyboardFocus` hook to adjust padding in bottom sheets
- **Increment version** in `package.json` on every meaningful release
- **Test on both** Joel's Pixel 10 Pro (Android) and Sandra's iPhone

---

## Open items

> **Sync rule**: every change to `api/_lib/invoicePdf.js` must be mirrored in `InvoiceView.jsx` before commit.
> Vercel Hobby: **9 of 12** serverless functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `ai/chat`, `admin/provision`.
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock).

### 🔴 Bugs / Active issues

None currently open. Everything shipped through v0.13.39 is either live-verified or awaiting Sandra's routine phone-test (see Current version section above) — not tracked here as a blocker. Resolved-bug history lives in `docs/archive/CHANGELOG-v0.13-archive.md`.

> **Constraint**: Vercel at 9/12 serverless function slots. Defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

3. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
4. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
5. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

6. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
7. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
8. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
9. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
10. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

13. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

17. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.

### 🧹 Housekeeping (surfaced from second-brain reconciliation, Jul 16)

18. **Anthropic API credits exhausted on the app's key** — not a code fix, needs a top-up before AI features work at all (the v0.13.15 local-fallback fix means the app degrades gracefully at $0 credits, but real AI output needs the top-up).
19. **Ask Sandra what specifically confused her about the old Schedule page** — the clarity-revamp shipped without ever confirming the actual complaint.
20. **Backup zip refresh** — `C:\Projects\_archive\` last backup is pre-July.

~~Check for residual fake `ai_context.learned` data on real clients~~ — **DONE 2026-08-07.** Queried `clients` table directly: 2 clients (Ann Rae, Maria Nguyen) had identical templated fake data from the removed `simulateAILearning` button ("After 10 sessions, I've learned that X prefers the back entrance..."). Cleared `ai_context.learned` on both, verified 0 remaining across all 75 clients.
