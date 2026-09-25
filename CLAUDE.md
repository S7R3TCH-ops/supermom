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
| `push_subscriptions` | One row per (user, device/browser) Web Push subscription — `endpoint`/`p256dh`/`auth`, written client-side (RLS insert). `fail_count`/`last_success_at` drive the dead-subscription cleanup in the sweep. Migration `20260918030000_add_push_notifications.sql` — **NOT YET RUN**, Joel runs it manually. |
| `push_log` | One row per dispatched leave/wrap-up push alert — `kind`, `job_start_at` (reschedule-safe dedupe key), `title`/`body` (exactly what was sent), `sent_count`/`failed_count`. `UNIQUE (job_id, kind, job_start_at)` is also the sweep's double-send guard (claimed via insert before sending). Same migration as `push_subscriptions` — **NOT YET RUN**. |
| `ai_briefs` | Cached AI-generated day/client briefs — `content` jsonb is the parsed model output, `inputs_hash` (sha256 of the canonicalised input) skips regeneration when nothing changed, `kind` ('day'/'client') deliberately has no check constraint (handler-validated, code-only to extend). `UNIQUE (business_id, kind, subject_id)`. Migration `20260918050000_add_ai_briefs.sql` — **NOT YET RUN**, Joel runs it manually. |
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
- `api/_lib/invoicePdf.js` — react-pdf builder. Address blocks use single `<Text>` with `\n`-joined children — **intentional**; stacked `<Text>` elements each get their own font-metrics line-box.
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


## Current version: 0.13.80 — Sep 25, 2026 (LIVE on main; Statler voice booking)

**v0.13.80 (this session)**: Fixed a bug where invalid 12-hour times (e.g. "13pm") were silently parsed into valid 24-hour times ("13:00") by `supermom_schedule_job` instead of being rejected. Added a bounds check (1-12) to the AM/PM parser so out-of-range times fall through to the strict `HH:MM` format validation and return a 400 error.

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

> **Sync rule**: every change to `api/_lib/invoicePdf.js` must be mirrored in `InvoiceView.jsx` before commit.
> Vercel Hobby: **11 of 12** serverless functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `ai/chat`, `admin/provision`, `admin/ai-toggle`, `reminders/[action]`. (2026-09-18, v0.13.72 — added `reminders/[action]` for lockscreen push; named generically because the separately-approved SMS-reminders design is built to ride this same function once its own Twilio Phase-0 is done, at no additional slot cost.)
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock).

### ✅ Recent Changes

- **2026-09-25**: Added `supermom_add_client` and `supermom_mark_paid` AI handlers to `api/ai/[action].js` for the Statler voice bridge integration.

### 🔴 Bugs / Active issues

- **`todayJobs`'s daily drive-time chain includes Completed jobs, not just Scheduled ones (found 2026-09-18, live-tested).** `Home.jsx:131`'s filter is `j.status !== 'Cancelled'` — a Completed job still counts as a stop in `updateDailyRoutes()`'s Home→Job1→Job2→... chain (`maps.js`), so completing an earlier job does NOT remove it from later jobs' drive-time math the way you'd expect (it correctly *does* drop out of the reminders-sweep query, which filters to `Scheduled` only — those two behaviors are inconsistent). Repro: completed a 6am test job, a 9:30am job still computed "Previous Job, 1 min" (i.e., still chained off the completed 6am job's address) until the 6am job was set to `Cancelled` instead. Fix should scope the chain's job list to `Scheduled` only, matching the sweep's own filter. Not yet fixed — found live while device-testing lockscreen push, low urgency (Sandra completes jobs retroactively, rarely mid-day with more jobs still pending after).

**Resolved 2026-09-22**: agentic AI summaries/titles had silently stopped generating after Joel pulled `ANTHROPIC_API_KEY` (freeing budget for Gemini's Twilio/live-agent-assist work elsewhere) — every AI handler degrades to a mock/skip fallback when its LLM client is `null`, no hard error. Fixed by porting `api/ai/[action].js`/`api/ai/chat.js` from `@anthropic-ai/sdk` to `@google/genai`. Took two real wrong turns to land: Google changed Gemini key issuance 2026-05-28 to service-account-bound "Auth keys" (`AQ.` prefix) — an AI-Studio-auto-issued one had a broken binding and 401'd, fixed by creating the key explicitly via Cloud Console bound to an existing service account; and `gemini-2.5-flash` 404s on new-format keys, its replacement `gemini-3.6-flash` defaults to internal "thinking" that silently ate the whole output-token budget, fixed with `thinkingConfig: { thinkingBudget: 0 }`. Confirmed live: hit the deployed Vercel endpoint directly (QA-account Supabase auth) and got a real Gemini-generated response back. Full detail: Tech Stack / Security & Environment sections above, and `second-brain/03-projects/active/supermom/tasks.md` 2026-09-22 entry.

**Resolved 2026-09-18**: pg_cron reminders sweep was scheduled correctly (`select * from cron.job` confirmed active, `*/5 * * * *`, hitting the right URL) but every tick 401'd — the vault secret `reminders_sweep_secret` didn't match Vercel's `CRON_SECRET` (likely never matched from the original migration run). Fixed by rotating `CRON_SECRET` to a fresh value in both places (Vercel env + redeploy, then `vault.update_secret(...)` to match) rather than trying to recover the old one — Vercel had it marked sensitive/unrecoverable. Confirmed end-to-end: a real scheduled tick at 11:10 UTC returned 200 and wrote the heartbeat. This also rotates the same secret `api/briefing/daily.js`'s cron uses (shared var) — no separate action needed there, Vercel Cron reads the env var fresh each invocation. Also rotated the VAPID keypair (old one had appeared twice in a build-session transcript, not committed/public but cheap to rotate) — Production + local `.env` updated, client self-heals per `usePushSubscription.js`'s existing rotation-detection logic. The carried-forward client note persistence bug (found 2026-09-16) was fixed in v0.13.68 — see above. Resolved-bug history lives in `docs/archive/CHANGELOG-v0.13-archive.md`.

> **Constraint**: Vercel at 11/12 serverless function slots. One slot left — defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

0. **Live-GPS drive time feeding the leave-alert push notification, scoped 2026-09-18, not yet built.** Today the lockscreen leave-alert reads `ai_context.drive_to`, which is a static Home→Job1→Job2→... chain computed once (`updateDailyRoutes`, `maps.js`) — never touches live GPS/traffic. Meanwhile `Home.jsx`'s `fetchLocationDrives()` (the on-screen "Leave in X mins" text) already does real GPS + live traffic every ~10min while the app's open, but only sets React state, never persists — so the actual push alert never benefits from it. Design agreed with Joel + advisor pass:
   - Priority order: **live GPS (if fresh) → static chain → home-address-only-for-job-1**. Live wins whenever present regardless of job order/position in the day — solves "jobs close together, definitely not coming from Georgetown" without any explicit detection logic.
   - **3-hour staleness cutoff** — a live reading older than that falls back to the static chain/home estimate rather than trusting a stale GPS snapshot.
   - Store live under a **new key**, `ai_context.drive_to_live = { durationValue, duration, computed_at }` — do NOT overwrite `drive_to` (the static chain's own recompute logic only fires when `drive_to === undefined`, so overwriting it there would permanently kill the fallback tier).
   - Persist live data only for the **next job she's actually driving to** (`j.start > now`, not `end > now`), not every remaining job today — GPS-now→job-3 while still at job-1 is worse than the chain's job-2→job-3 estimate.
   - **Do NOT hardcode Sandra's street address** (`6 Edwin Ln`) anywhere in source — this repo is public (`S7R3TCH-ops/supermom`), same reason CLAUDE.md already says "no street address on invoices." Pull from `businesses.address` (column exists, check it's populated for Sandra's row) instead, passed as a param into `updateDailyRoutes(jobsForDay, homeAddress)`, falling back to the current town-level constant if empty.
   - The "which number wins" logic belongs as a pure `resolveDriveSeconds(aiContext, now)` function in `api/_lib/pushAlerts.js`, tested like its existing 37 cases — not inline in the sweep handler.
   - The sweep already recomputes `leave_at` fresh from the DB every 5-min tick, so once persisted, a live update automatically corrects an alert's timing **as long as it lands before the alert has actually sent** (push_log's dedupe means an already-sent alert can't be recalled/corrected).
   - Also flagged the `todayJobs` Completed-job bug above as adjacent/related — worth fixing in the same pass since both touch the same drive-time chain.
   - Scope: `Home.jsx` (persist call + pass `business.address`), `maps.js` (signature + fallback param), `pushAlerts.js` (new selector + tests), `api/reminders/[action].js` (one-line call-site swap). No schema change, no new serverless function.

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
