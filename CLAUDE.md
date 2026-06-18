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
- `computeJobTotal(job)` = subtotal + additional costs + HST. Use for collection math (what client owes).
- `computeJobSubtotal(job)` = subtotal + additional costs (no HST). Use for card/revenue display.
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

## Current version: 0.12.92 — Jun 18, 2026 (package.json synced)

Sandra's business is live — data wiped and re-provisioned Jun 9. App in active use.

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

### Recent changes (full history in `docs/changelog/` + `git log`)
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

1. **Device verification** — v0.12.32–v0.12.68 not phone-tested. v0.12.67 crash fix deployed but unverified on real devices. Test Home page + invoice flow on Pixel 10 Pro + Sandra's iPhone before next feature push.
2. **Vercel function slot** — 9/12 used. Three slots left before limit. Options: consolidate or upgrade to Pro.

### 🤖 AI features (HIGH PRIORITY)

3. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
4. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
5. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
6. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
7. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

8. **Client invoice history** — "Invoices" tab in ClientProfile listing all invoices per client, each tappable to `/i/:id`.
9. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
10. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
11. **Offline mode** — app crashes if Supabase unreachable on first load. Per-page `ErrorBoundary` + "tap to reload" fallbacks needed.
12. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### ✨ UX / product nice-to-haves

13. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.
14. **Cross-job search** — find "all jobs containing 'basement'" or "all October jobs". One search endpoint serves this.
15. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
16. **Revenue goal progress bar** — Sandra sets a monthly target in Settings; Home hero shows progress ring.
17. **Client lifetime value** — ClientProfile shows total paid. Add "avg per visit" + "top 5 by revenue" card to Finance.
18. **Year-over-year comparison** — Finance page: toggle "vs last year" for tax planning context.
19. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
20. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).

### 🏢 Multi-tenant / future

21. **Per-business label config** — "Sidekick/Wingmom" are hardcoded in UI. Must be configurable before tenant #2 onboards.
22. **Super Admin viewpoint quick-switch** — dropdown to switch businesses without manual ID entry.
23. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.
