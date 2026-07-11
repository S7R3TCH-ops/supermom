# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is authoritative project state. Do NOT rely on memory files — they drift.
> **Drift check (every session)**: Run `git log --oneline -10` and verify recent changes are documented here.

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

## Current version: 0.13.8 — Jul 10, 2026 (package.json synced)

Sandra's business is live — data wiped and re-provisioned Jun 9. App in active use.

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

### Recent changes (full history in `docs/changelog/` + `git log`)
- **v0.13.9 (Jul 10) — error tracking: client + server error capture.** No error tracking service existed anywhere (56 scattered `console.error`/`toast.error` calls, 8 API routes with bare `try/catch`, silent Vercel function logs nobody watches). Lightweight capture, no new serverless function, full Sentry-style tracking deliberately deferred:
  - New `error_logs` table (migration `20260710010000_add_error_logs.sql`, **run and confirmed live** via REST query). RLS: insert own business or null, select `is_admin()` or own business.
  - `src/lib/errorTracking.js` — `logClientError()` + `installGlobalErrorTracking()` (wired in `main.jsx`), catching genuinely unhandled `window.onerror`/`unhandledrejection` — the errors Sandra hits and never reports because she doesn't even see them.
  - `api/_lib/errorLog.js` — `logServerError({ severity, message, stack, context, businessId, alert })`; `alert: true` sends Joel (`ALERT_EMAIL` env, defaults `jlundie@gmail.com`) an email via the existing nodemailer/Gmail setup.
  - Wired into the two most "silent" server failure points: `api/briefing/daily.js` (was **entirely unwrapped** — any uncaught throw crashed the cron with zero notification; now top-level try/catch + per-business sendMail failure both alert) and `api/invoice.js` invoice-email send failure (money-flow action, alerts Joel; guarded `invoiceData?.business_id` since main's `handleEmail` — unlike `audit-fixes` — has no null-check on a bad `invoiceId`).
  - Admin page (`src/pages/Admin.jsx`, super-admin only) — new "Error Log" section, last 50 rows, expandable stack/context.
- **v0.13.8 (Jul 10) — drive time / leave-by / hero Go button: FIXED**, plus selective cherry-pick of the low-risk half of the `audit-fixes` branch to prod:
  1. **Maps API key restriction** — Joel set Application restrictions to **None** and API restrictions to **Distance Matrix API + Geocoding API only** in Google Cloud Console. Confirmed live via direct curl to prod `/api/maps` — both `type=distance` and `type=geocode` now return `status: "OK"` (previously `REQUEST_DENIED: "API keys with referer restrictions cannot be used with this API."`). This was the root cause of drive time never updating and the urgency pulsate never firing (distance matrix fetch failed silently, `locationDrives` never populated).
  2. **Go button not launching Maps app (`Home.jsx` `handleSupermomGo`)** — separate regression: `window.open('', '_blank')` opened blank, then redirected via `.location.href` ~1.1s later after an async GPS lookup. That delayed-redirect-of-a-blank-window shape is the "tab-under" pattern browsers have tightened anti-abuse heuristics against — likely why it stopped working despite being the v0.13.5 iOS fix. Replaced with same-tab `window.location.href` navigation (immune to popup/tab-under blocking; iOS/Android universal-link interception into the native Maps app still fires on a plain navigation). **Phone-tested on Pixel 10 Pro (Jul 10) — Go button confirmed working.**
  3. **Cherry-picked from `audit-fixes` (self-contained, no coordination needed)**: ClientCard `ReferenceError` crash fix on Lead/overdue pills; sw.js lint fix; public `/i/:id` invoice reads via service-role JSON endpoint instead of browser anon key (SEC-1 code half — RLS migration half still pending, see below); child-table deletes/selects scoped by `business_id` (DATA-1, defense-in-depth); dead-code removal audit sweep; nodemailer 8→9 (clears GHSA-p6gq); Vitest + 29 unit tests on financialMath/invoiceBalances (`npm test`).
  4. **Deliberately deferred, still only on `audit-fixes`**: Bearer JWT requirement on AI endpoints + invoice email POST (SEC-2/SEC-4 — needs coordinated client+server phone test); same-origin Origin/Referer guard on `api/maps.js` (SEC-3 — avoided touching the exact endpoint just fixed today, same day, untested); react-router-dom 7.14.2→7.18.1 bump (touches `useBackClose`-adjacent router internals, explicitly flagged "phone-test required"); in-progress theme WIP checkpoint. ⚠️ Still pending Joel: run `supabase/migrations/20260703000000_revoke_anon_table_access.sql` in SQL Editor (RLS half of SEC-1); export live RLS state to a committed migration. Full status: `AUDIT_FABLE.md`.
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

1. **Device verification** — v0.12.32–v0.12.68 not phone-tested. Test Home page + invoice flow on Pixel 10 Pro + Sandra's iPhone before next feature push. (v0.13.8 Go button fix already phone-tested and confirmed working on Pixel 10 Pro.)

> **Constraint**: Vercel at 9/12 serverless function slots. Defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

2. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
3. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
4. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

5. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
6. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
7. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
8. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
9. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

10. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
11. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
12. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
13. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

14. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.
