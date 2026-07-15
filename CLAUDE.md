# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is authoritative project state. Do NOT rely on memory files — they drift.
> **Drift check (every session)**: Run `git log --oneline -10` and verify recent changes are documented here.
> **Second-brain sync (every session, mandatory)**: This repo is tracked in `C:\Projects\second-brain\03-projects\active\supermom\`. Whether this session is running here directly (CLI or Antigravity) or was routed from second-brain, before ending the session update that project's `status.md` (current state) and `tasks.md` (next actions) to match what actually happened — same as if the session had been rooted in second-brain. Don't rely on this repo's own docs (this file, `HANDOFF_NEW_SESSION.md`) as the cross-session source of truth for planning/priorities; second-brain's `status.md`/`tasks.md` are. If you can't reach that folder from this session, say so explicitly instead of silently skipping the update.
> **Gemini handoff routing (standing rule, added 2026-07-15)**: When Joel says "execute the instructions/plan Gemini brainstormed" (or equivalent — no file path given), auto-look in `C:\Projects\second-brain\00-inbox\gemini\`, take the most recently modified `.md` file, read it, and execute — don't ask Joel for the path.

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers organizing, decluttering, caregiving, life coaching, and errands — all self-booked after client calls or texts.

**Managed service product** — Sandra is the first user; architecture supports onboarding other operators.

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
| `integrations` | OAuth tokens (Google Calendar). |
| `error_logs` | Client + server error capture (source, severity, message, stack, context). Append-only, admin-viewable in Admin page. **Migration not yet run** — see Open Items. |
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
- **Email**: `sandra@supermomforhire.com` — canonical for everything (invoices, GCal OAuth, Maps, SMTP)
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

## Current version: 0.13.13 — Jul 13, 2026 (package.json synced)

Sandra's business is live — data wiped and re-provisioned Jun 9. App in active use.

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

### Recent changes (full history in `docs/changelog/` + `git log`)
- **(Jul 14) — WeekStrip continuous day-scrub gesture (calendar variant), phone-tested 2026-07-13.** Dragging the 21-day flat strip now previews and commits a day under the finger in real time instead of only snapping week-to-week: `previewIndex` (derived from the same `dx` driving the transform, never duplicated) tracks the cell under the touch, with per-cell haptic detents and a `touchcancel` handler (iOS fires this on notification-pull/system-gesture takeover mid-drag — previously left the gesture stuck). Ghost click after a touch-commit is swallowed via `suppressClickRef`. `playwright.config.ts` port bumped to 8080 to match the actual dev-server port; `index.css` `-webkit-fill-available` → `100dvh` (the old iOS-only fallback was overriding real dynamic-viewport support). New `tests/calendar-scrub.spec.ts` + `tests/qa-regression.spec.ts`. Build + Vitest 61/61.
- **(Jul 14) — unified job field/validation model across New/Edit/Complete job sheets.** New `src/lib/jobDraftPolicy.js` (+32 Vitest tests): `deriveJobStage`, `getFieldPolicy`, `validateJobDraft`, `buildFinancialPatch`. **Single-writer rule: subtotal/hst_amount/total_amount only ever written from `buildFinancialPatch` (wraps `computeJobFinancials`) — no sheet hand-computes money columns anymore.** Hourly totals are hard-derived (rate × hours); EditMode's free-typed "Amount ($)" replaced by a single `form.rate` field ("Rate ($/hr)" for Hourly, "Amount ($)" for Flat) — this fixed a live bug where hourly `total_amount` could silently diverge from rate×hours, and a second one where Flat-amount edits never updated the live breakdown. Stage lock matrix: scheduled=open, prepaid/invoiced=warn card, Paid=override card + auto re-derive, Cancelled=locked (Edit already hidden). Repo backstops: `jobsRepo.rederivePaymentStatus(jobId)` (payments-sum vs recomputed total; `updateJob` auto-calls it when a money field changes without `payment_status` in the patch), `invoicesRepo.recalcInvoiceTotal(invoiceId)` (extracted from `addJobsToInvoice`; EditMode save resyncs the invoice). PostJobSheet: payment amount validated (>$0 when balance owed), overpay allowed + shown as tip note, already-Paid records can no longer log a duplicate full payment (amount default was `liveTotal` when balance hit 0). NewJobSheet: Additional Costs gated on service pick; booking now writes the full subtotal/hst/total triple (total_amount at booking is now tax-inclusive incl. costs — was pre-tax labor only). Build + Vitest 61/61. Not phone-tested.
- **v0.13.13 (Jul 13) — invoice/PDF/email 500 fix (real production bug, was live since a TS migration), briefing test-account leak, AI error UX, admin password-reset incident fix.**
  1. **Invoice view/PDF/email were completely broken in production** — commit `37a4784` (TS migration) renamed `src/lib/financialMath.js` → `.ts` but never updated two importers (`api/_lib/invoicePdf.js`, `src/lib/invoiceBalances.js`) that hardcoded the `.js` extension. `api/invoice.js` (every invoice view/PDF/email request) 500'd on load since that migration merged — any client viewing/downloading/emailing an invoice hit this. Fixed both imports to point at `.ts` explicitly (extensionless didn't resolve under Vercel's function bundler, unlike Vite's frontend bundler). Fully verified end-to-end: invoice page loads, `/api/invoice?...&format=pdf` returns a real 473KB 1-page PDF, and the actual Send Receipt email flow works.
  2. **Finance page's "Formal Invoices" list had no click handler at all** (dead list) — unlike the identical list on `ClientProfile.jsx`. Wired up the same navigate-to-invoice behavior.
  3. **`api/ai/chat.js` and `api/ai/[action].js` were forwarding raw Anthropic API error JSON straight into user-facing error messages** (e.g. the credit-balance-too-low 400 shown verbatim in the chat UI). Now return a generic "unavailable, try again" message; full error still logged server-side.
  4. **New `businesses.is_test` column** (migration `20260713191258_add_is_test_to_businesses.sql`) + provisioning checkbox in `Admin.jsx`, filtered out of the daily briefing recipient query (`api/briefing/daily.js`) — stops QA/test accounts from being emailed as if they were real clients. ⚠️ Pending: run the migration + `UPDATE businesses SET is_test = true WHERE name = 'Bright Path Concierge (QA TEST)';` in Supabase SQL Editor.
  5. **Real incident, root cause fixed:** `src/pages/Login.jsx` password-reset `redirectTo` used `window.location.origin` — a reset requested from local dev emailed a link pointing at `localhost`, dead everywhere else. This locked Joel out of his own admin login mid-session. Now always redirects to the production URL when requested from dev.
  6. Also includes the 2026-07-12 provisioning error-handling fix (`Admin.jsx` `handleProvision` called `res.json()` unconditionally, crashed with "Unexpected end of JSON input" on non-JSON error responses — now wraps in try/catch).
  Also found, not yet fixed: a live, unrestricted "Generate AI insights" button (`simulateAILearning` in `clientsRepo.js`) writes hardcoded fake data into real clients' profiles — no AI call, no gating. Needs a follow-up fix (gate to `is_test` or remove). Future-dated job completion bug (known, `useBackClose` race) reproduced again during this session's QA pass, now crashing the tab instead of silently no-op'ing — still needs a dedicated debugging session, not another guess. Build + Vitest (29/29) clean.
- **v0.13.12 (Jul 11) — silent-failure fix batch, greenlit from the 2026-07-11 sweep (28 silent/6 partial sites, see `sweep-silent-failures-2026-07-11.md` in second-brain).** Three phases, all build/Vitest-gated:
  1. **Repo layer** (root cause — `{ error }` was never read on secondary/cascade Supabase calls, so no caller-side try/catch could see them): `clientsRepo.hardDeleteClient`, `jobsRepo.hardDeleteJob`, `jobsRepo.revertJobToPreCompletion` (also fixes a read-failure wrongly voiding an invoice — the branch now throws instead of falling through), `jobsRepo.patchJobAiContext`, `invoicesRepo.settleInvoiceOutstanding`, `invoicesRepo.voidInvoiceSettlement`, `invoicesRepo.addJobsToInvoice` now check and throw on every step.
  2. **Lying-success sites**: Settings "Reset all data" now aggregates per-table failures and fails the toast instead of always reporting success on a destructive 12-table delete; `PostJobSheet` bundle-payment empty catches now surface `toast.error`; `WorkerCatalogSheet` skill/pay-rate save no longer fires "Updated!" on a swallowed failure; `InvoiceView` Undo Payment button now renders its `error` state (same set-but-never-consumed shape as the v0.13.11 `mutErr` bug).
  3. **Disabled-button batch** (11 sites) — reused existing reason-in-label/helper-text patterns, no new UI components: `NewJobSheet`/`JobDetailSheet` End-time inputs, `NewClientSheet`/`EditClientSheet` tag Add button, `JobDetailSheet` Cancel Booking reason, `WorkerCatalogSheet` skill-type Add/Save, `Admin` viewpoint Switch + Create Business & Owner, `AiChatSheet` Send (title tooltip), `Settings` Update password.
  `GeofenceContext` auto clock-in/out deferred (workers feature barely used). No items skipped — all three phases completed as scoped in the sweep doc. Build + Vitest (29/29) pass after each phase. Not phone-tested (same fix-forward reasoning as v0.13.10/11 — no client-facing exposure, Sandra has manual fallback).
- **v0.13.11 (Jul 11) — fix silent save failure on job-edit form.** `JobDetailSheet.jsx` `EditMode` was passed `mutErr` but never destructured it — save failures set the error state but nothing rendered, so a missing required field on Save looked like a no-op. Added required-field pre-checks (date/time/service) that jump focus to the bad field, wired the existing red-box error pattern (already used in `ReadMode` and every other sheet) into `EditMode`'s footer, added `toast.error` backstop in `saveEdit`'s catch block. Build + Vitest (29/29) pass. Scoped fix only. *(Note: The lower-severity twin of this bug in `NewJobSheet.jsx`'s step-2 button was subsequently fixed by Gemini on 2026-07-13).*
- **v0.13.10 (Jul 11) — merged `audit-fixes` to main: security hardening, router bump, theme.** Everything previously "deliberately deferred, still only on `audit-fixes`" now on main, not phone-tested at merge time (Joel's call — low blast radius, manual-scheduling fallback exists, fix-forward if issues surface):
  - **Bearer JWT requirement** on AI endpoints (`api/ai/chat.js`, `api/ai/[action].js`) + invoice email POST (SEC-2/SEC-4) — `api/_lib/authGuard.js`; client sends via `authHeaders()` from `src/lib/supabase.js`.
  - **Same-origin Origin/Referer guard** on `api/maps.js` (SEC-3).
  - **react-router-dom 7.14.2→7.18.1** — touches `useBackClose`-adjacent router internals (past regressions here: v0.12.89, v0.12.90). Not yet phone-tested — watch sheet close + Android back behavior.
  - **Theme**: solid-fill unpaid/overdue/partial job cards (`JobCard.jsx`, `Home.jsx`, `tokens.js`) — white text on bold color fill instead of pastel tint, for contrast/urgency.
  - **NewJobSheet** now navigates home (`navigate('/')`) after booking, instead of just closing the sheet.
  - ⚠️ Still pending Joel: run `supabase/migrations/20260703000000_revoke_anon_table_access.sql` in SQL Editor (RLS half of SEC-1 — the anon-read revoke, separate from the already-run `error_logs` migration). Full audit context: `AUDIT_FABLE.md`.
- **v0.13.9 (Jul 10) — error tracking: client + server error capture.** No error tracking service existed anywhere (56 scattered `console.error`/`toast.error` calls, 8 API routes with bare `try/catch`, silent Vercel function logs nobody watches). Lightweight capture, no new serverless function, full Sentry-style tracking deliberately deferred:
  - New `error_logs` table (migration `20260710010000_add_error_logs.sql`, **run and confirmed live** via REST query). RLS: insert own business or null, select `is_admin()` or own business.
  - `src/lib/errorTracking.js` — `logClientError()` + `installGlobalErrorTracking()` (wired in `main.jsx`), catching genuinely unhandled `window.onerror`/`unhandledrejection` — the errors Sandra hits and never reports because she doesn't even see them.
  - `api/_lib/errorLog.js` — `logServerError({ severity, message, stack, context, businessId, alert })`; `alert: true` sends Joel (`ALERT_EMAIL` env, defaults `jlundie@gmail.com`) an email via the existing nodemailer/Gmail setup.
  - Wired into the two most "silent" server failure points: `api/briefing/daily.js` (was **entirely unwrapped** — any uncaught throw crashed the cron with zero notification; now top-level try/catch + per-business sendMail failure both alert) and `api/invoice.js` invoice-email send failure (money-flow action, alerts Joel; guarded `invoiceData?.business_id` in case of a bad `invoiceId`).
  - Admin page (`src/pages/Admin.jsx`, super-admin only) — new "Error Log" section, last 50 rows, expandable stack/context.
- **v0.13.8 (Jul 10) — drive time / leave-by / hero Go button: FIXED**, plus selective cherry-pick of the low-risk half of the `audit-fixes` branch to prod:
  1. **Maps API key restriction** — Joel set Application restrictions to **None** and API restrictions to **Distance Matrix API + Geocoding API only** in Google Cloud Console. Confirmed live via direct curl to prod `/api/maps` — both `type=distance` and `type=geocode` now return `status: "OK"` (previously `REQUEST_DENIED: "API keys with referer restrictions cannot be used with this API."`). This was the root cause of drive time never updating and the urgency pulsate never firing (distance matrix fetch failed silently, `locationDrives` never populated).
  2. **Go button not launching Maps app (`Home.jsx` `handleSupermomGo`)** — separate regression: `window.open('', '_blank')` opened blank, then redirected via `.location.href` ~1.1s later after an async GPS lookup. That delayed-redirect-of-a-blank-window shape is the "tab-under" pattern browsers have tightened anti-abuse heuristics against — likely why it stopped working despite being the v0.13.5 iOS fix. Replaced with same-tab `window.location.href` navigation (immune to popup/tab-under blocking; iOS/Android universal-link interception into the native Maps app still fires on a plain navigation). **Phone-tested on Pixel 10 Pro (Jul 10) — Go button confirmed working.**
  3. **Cherry-picked from `audit-fixes` (self-contained, no coordination needed)**: ClientCard `ReferenceError` crash fix on Lead/overdue pills; sw.js lint fix; public `/i/:id` invoice reads via service-role JSON endpoint instead of browser anon key (SEC-1 code half — RLS migration half still pending, see below); child-table deletes/selects scoped by `business_id` (DATA-1, defense-in-depth); dead-code removal audit sweep; nodemailer 8→9 (clears GHSA-p6gq); Vitest + 29 unit tests on financialMath/invoiceBalances (`npm test`).
- **v0.13.7 (Jun 28)** — Status card color system overhaul: replaced all hardcoded hex in `VSTYLES` (Home.jsx), `JobCard.jsx`, `UpcomingCard.jsx` with semantic `T.status.*` tokens. New jewel-tone palette in `tokens.js`: scheduled=cobalt, attention/wrap-up=mustard, unpaid=crimson-rose, overdue=scarlet, partial=burnt orange, paid=forest green — none are stock Tailwind defaults. Scheduled cards move from pink to cobalt blue, freeing pink for brand identity only. Hero pulse dot now uses `T.pink` (was hardcoded `#FC4693`); hero card box shadow fixed to `T.pinkGlow` (was old pink value).
- **v0.13.6 (Jun 28)** — Light mode color overhaul: align app palette to Sandra's official brand. Primary pink `#E91E6A` → `#FC4693`; warm-brown text (`#4E342E`/`#795548`) → neutral grays (`#2D2D2D`/`#606060`); bg `#FFF0F3` → `#FFEFF4`. Icons were already `#FC4693` — app interior now consistent. LIGHT_PALETTE in `tokens.js` renamed "Brand Rose". CLAUDE.md open items pruned: 8 completed items removed, remaining items renumbered 1–14.
- **v0.13.5 (Jun 28)** — Fix Go button not opening Maps on Sandra's iPhone 16: `window.open()` was called inside `setTimeout` — iOS Safari blocks that as non-user-gesture. Fix: open blank window synchronously on tap, then set `location.href` after GPS resolves.
- **v0.13.4 (Jun 28)** — Navigation audit + fixes: (1) `useBackClose` no longer calls `history.back()` on cleanup when URL already changed — fixes any sheet-→-navigate flow (e.g. JobDetailSheet client name now correctly opens ClientProfile). (2) ClientProfile back button changed from hardcoded `navigate('/clients')` to `navigate(-1)` — returns to true origin. (3) Finance "Top 5 clients" rows are now tappable buttons navigating to `/clients/:id`; computed object now includes `id` field.
- **v0.13.3 (Jun 20)** — BottomNav: FAB merged into center raised + button (Week | Schedule | [+] | Clients | Finance). Tapping + expands options above nav: New Job / New Client / Search (centered, rises from + position). Standalone FAB removed from App.jsx entirely.
- **v0.13.2 (Jun 20)** — BottomNav: 5-item layout with raised pink circle search button as center item (translateY -14px, 46px, white border ring, box shadow); FAB reverts to 2 options (Job + Client).
- **v0.13.1 (Jun 20)** — FAB: add "🔍 Search" as third option in FAB menu (navigates to /search).
- **v0.13.0 (Jun 20)** — LogoBar: remove 🔍 search icon (too cramped; `/search` route still exists, entry point TBD). FAB: `sm-scroll::after` adds 100px bottom clearance in global CSS so last list items always scroll above the FAB button.
- **v0.12.99 (Jun 20)** — LogoBar: remove visible admin `<select>` (was crowding right button row); super-admin business switcher is now a double-tap Easter egg on the Supermom logo — floating picker appears below logo, single-tap still navigates home.
- **v0.12.98 (Jun 20)** — Wave 2 feature batch: (5) **#21 Per-business labels** — `getWorkerLabel(business, personType)` helper in `src/lib/labels.js`; all 16 hardcoded "Sidekick/Wingmom" instances replaced across 9 files; Settings form adds worker/staff label inputs stored in `ai_profile.worker_labels`. (6) **#16 Revenue goal** — Settings form adds monthly goal (stored in `ai_profile.revenue_goal_monthly`); Home hero shows thin progress bar (pink → green at 100%) when goal is set. (7) **#17 Client LTV** — `toDisplayClient` adds `totalBilled` + `avgPerJob` stats; ClientProfile shows LTV row below existing stats; Finance shows "Top 5 clients" card with rank, revenue, job count. (8) **#18 Year-over-year** — Finance: "vs Last Year" toggle button; prior-year chart rendered as second TrendChart with `idPrefix="fc-yoy"` to avoid SVG gradient ID conflicts. (9) **#11 Offline mode** — `OfflineMessage` component with retry button; Home/Clients/Finance/Calendar show it when `error && !data`; App.jsx adds `online` event listener → `queryClient.invalidateQueries()` on reconnect.
- **v0.12.97 (Jun 20)** — Wave 1 feature batch: (1) **#22 Admin quick-switch** — LogoBar gets compact `<select>` for super-admin switching between businesses without page reload (`quickSwitch` in ViewpointContext uses queryClient.invalidateQueries). (2) **#6 Prep note prefetch** — JobDetailSheet prefetches prep note via queryClient when job opens; PrepNoteSheet switches to useQuery so cached result shows instantly. (3) **#8 Client invoice history** — ClientProfile shows "Invoices" section listing all invoices for that client, tap → `/i/:id`. New `fetchInvoicesByClientId` + `useClientInvoices` hook. (4) **#14 Cross-job search** — search icon in LogoBar → `/search` page; `searchJobs(q, dateFrom, dateTo)` does Supabase `.ilike()` on `service_name`+`job_notes`; `useSearchJobs` hook.
- **v0.12.96 (Jun 19)** — Home screen: Sandra wants to see amounts WITH HST. All Home.jsx amounts switched to `computeJobTotal` (HST-inclusive): `displayRevenue`, `collectedThisWeek`, `owingJobs.remaining`, `weekOwed`, `weekUpcoming`, all JobCard/UpcomingCard `total` props, "next job" inline display. `computeJobSubtotal` import removed from Home.jsx. `hstNote` prop removed from all cards (total already includes HST). Finance page remains on subtotal basis.
- **v0.12.95 (Jun 19)** — Fix financial math consistency: all revenue/collected/owing figures now use subtotal (no HST) as primary basis, matching the card displays that show "$X +HST". Home: `collectedThisWeek` changed from `computeJobTotal` to `computeJobSubtotal` for paid jobs (caps partial at subtotal); `owingJobs.remaining` same fix. Finance: `revenueItems`, `outstandingItems`, transaction amounts, chart buckets all switched from `.total` to `computeJobSubtotal`. Previously "collected" used total-with-HST while "This Week" used subtotal — impossible for Sandra to reconcile. HST is still shown as "+HST" annotation on cards; CSV export unchanged (still exports all three: subtotal/HST/total).
- **v0.12.94 (Jun 18)** — iOS PWA height fix: split `html, body, #root` height rule — `html` gets `height: -webkit-fill-available`, `body`/`#root` get `min-height: -webkit-fill-available`. Fixes white strip at bottom where `height: 100%` resolves shorter than actual screen in iOS standalone mode.
- **v0.12.93 (Jun 18)** — iOS PWA safe area fix: LogoBar gets `paddingTop: calc(env(safe-area-inset-top) + 10px)` so logo bar no longer hides behind status bar/notch; BottomNav gets `paddingBottom: calc(env(safe-area-inset-bottom) + 8px)` replacing hardcoded `22px` so white strip below nav disappears on iPhone.
- **v0.12.92 (Jun 18)** — InvoiceView fixes: (1) Scroll restored — `overflow: hidden` → `overflowX: hidden` on scale wrapper; vertical clipping was cutting off invoice content. (2) Record Payment panel now only shows jobs ON this invoice (removed `otherOutstanding` from the settle checklist) — prevents accidental cross-invoice payment assignment and fixes the confusion where jobs with prepayments appeared as settleable on unrelated invoices. (3) Rows with partial payment now show "$X already paid" in green. reload() no longer pre-selects otherOutstanding in `selectedIds`. "Add to Invoice" panel unchanged — still shows `otherOutstanding` as the correct consolidation path.
- **v0.12.91 (Jun 18)** — Home screen "Needs attention" section redesign. (1) Bottom nav "Home" → "Week". (2) Attention section split into 3 visual variants with left-border accent cards: amber WRAP UP (past time, not completed), pink UNPAID (completed, unpaid <48h), red UNPAID (completed, unpaid ≥48h), orange PARTIAL PAID. (3) Cards now show service name + date/time range + recency ("6d ago" / "2h overdue"). (4) Collapse toggle removed — all items always visible. (5) `owingTotal` now excludes wrap-up jobs (not yet billable). Section header: "Needs attention · $X outstanding".
- **v0.12.90 (Jun 18)** — Fix `useBackClose` navigating to wrong page (admin screen) on sheet close. `history.pushState(null, ...)` was wiping React Router's internal state (`idx`/`key`) from the synthetic entry — when cleanup called `history.back()`, React Router's `popstate` listener lost position tracking and jumped to wrong history entry. Fix: `history.pushState(window.history.state, ...)` preserves React Router state in synthetic push.
- **v0.12.89 (Jun 18)** — Fix two bugs introduced in v0.12.66/v0.12.88: (1) `clientsRepo.fetchClientByContact` referenced undefined `SELECT_FULL` (leftover from v0.12.66 narrow-selects refactor) — `ReferenceError` crashed every new-client save with generic "Something went wrong" toast. Fixed: both `.select()` calls use `SELECT_LIST`. (2) `useBackClose` incompatible with React StrictMode — cleanup's `history.back()` fired a popstate AFTER the second effect re-mount, consuming the live stack entry and auto-closing every sheet on open. Fixed: `suppressNextPopState` flag skips the spurious popstate in `handlePopState`.
- **v0.12.88 (Jun 17)** — Bundle optimization: all 7 sheet providers changed from static imports to `lazy()` + `Suspense`. `vite.config.js` adds `manualChunks` vendor split (React + ReactDOM + React Router + TanStack Query → `vendor` chunk). Result: main `index` chunk 487KB → 54KB (89% reduction); vendor chunk (264KB) cached across deploys by SW.
- **v0.12.87 (Jun 17)** — Mobile UX hardening: (1) **Idle session timeout** — 30-min inactivity auto-logout; `useIdleTimeout` hook in `src/hooks/useIdleTimeout.js`. (2) **Android back button closes sheets** — `useBackClose` hook (`src/hooks/useBackClose.js`); wired to 6 sheets. (3) **Swipe-to-wrap-up on Home job cards** — right-swipe `todayUpcoming` cards → opens PostJobSheet. `signOut` now calls `queryClient.clear()` before `supabase.auth.signOut()`.
- **v0.12.86 (Jun 17)** — TanStack Query migration: `useData.js` 383→165 lines. All 9 hooks use `useQuery`. `src/lib/queryClient.js` singleton: `staleTime: Infinity`, `refetchOnWindowFocus/Reconnect: false`. `notifyDataChanged` in `events.js` calls `queryClient.invalidateQueries()` inside 300ms debounce — all mutation invalidation routes here. `QueryClientProvider` added to `App.jsx`.

---

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

0. **PRIORITY — phone-test the v0.13.10 merge** (JWT auth on AI/invoice endpoints, router bump 7.14.2→7.18.1, maps origin check, theme). Router bump is the main risk — watch sheet close + Android back button. Merged untested (Joel's call); fix-forward if issues surface.
1. **Device verification** — v0.12.32–v0.12.68 not phone-tested. Test Home page + invoice flow on Pixel 10 Pro + Sandra's iPhone before next feature push. (v0.13.8 Go button fix already phone-tested and confirmed working on Pixel 10 Pro.)
2. **Live, unrestricted "Generate AI insights" button fabricates fake client data** — `handleSimulateFuture` in `ClientProfile.jsx` calls `simulateAILearning` (`clientsRepo.js`), which writes a hardcoded template (fake session count, fake behavioral flags like "Gate code usually 1234") into a real client's `ai_context`, no AI call, no gating. Any user can trigger it on any real client. Fix: gate to `is_test` businesses only, or remove and wire the real `enrich-client` endpoint instead.
3. **Future-dated job completion crashes the tab** — marking a job Complete/Paid via "Yes, continue" on a future date, previously a silent no-op, now reproduces as a full renderer crash (2026-07-13). Same root cause as before: likely a race in `useBackClose` between `JobDetailSheet` unmounting and `PostJobSheet` mounting. Two prior fix attempts reverted as unverified. Needs a dedicated debugging session, not another guess.
4. **AI local-fallback gap** — `api/ai/[action].js`'s local-heuristic fallback (`estimate-duration`, `prep-note`) only triggers when no `ANTHROPIC_API_KEY` is set at all. With a key configured but zero credits (current state), it hard-fails instead of falling through to the same good local logic. ~20-line fix — wrap the Anthropic call in try/catch, fall through on any error. Makes AI features fully functional at $0 spend.

> **Constraint**: Vercel at 9/12 serverless function slots. Defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

5. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
6. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
7. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

8. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
9. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
10. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
11. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
12. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

13. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

17. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.
