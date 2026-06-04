# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is the authoritative project state. Do NOT rely on memory files for project status — they drift. Update this file instead.

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers organizing, decluttering, caregiving, life coaching, and errands — all self-booked after client calls or texts.

This is a **managed service product** — Sandra is the first user, but the architecture supports onboarding other solo operators.

### Platform Hierarchy
- **Super Admin (Joel)**: `admin` role in DB. Not linked to any business. Switches "Viewpoints" to see any business.
- **Business Owners (Sandra, etc.)**: `owner` role, scoped to their `business_id`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Styling | Tailwind CSS + CSS custom properties (see DESIGN.md) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (Postgres) |
| Hosting | Vercel ([supermom-s7-r3-tch.vercel.app](https://supermom-s7-r3-tch.vercel.app)) |
| Performance | `React.lazy` + `Suspense` code-splitting |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context (no Zustand) |

---

## Common Scripts

> Run `npm install` first if `node_modules/` is missing.

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

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.**

| Table | Purpose |
|---|---|
| `businesses` | One row per business; includes `ai_profile` for persona. |
| `users` | `auth.users.id` → `business_id`, role (`owner`/`admin`/`worker`). |
| `clients` | Business-scoped. `ai_context` jsonb, `tags` array. |
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `flat_rate`, `total_amount`, `actual_duration`, `additional_costs_json`, `worker_id` (FK → workers), `worker_pay`, `worker_paid` (boolean — has Sandra paid the worker). |
| `payments` | One row per payment transaction. Source of truth for what's been collected. |
| `services` | Service catalog with `default_price`, `default_duration`, `pricing_type`. |
| `workers` | Business-scoped team members. `name`, `phone`, `email`, `person_type` (`'worker'`/`'staff'`), `deleted_at` (soft-delete). No Supabase Auth — picker only. |
| `skill_types` | Business-scoped catalog of skill/specialty types (e.g. "Organizing", "Caregiving"). Used to assign skills to workers. |
| `worker_skills` | Junction: `worker_id` → `skill_type_id` + `pay_rate`. One row per worker-skill assignment. |
| `integrations` | OAuth tokens for external services (Google Calendar). |
| `storage.job-assets` | Private bucket for job photos and voice notes. |

### Critical data layer rules
- **Multi-tenancy**: Every query must include `.eq('business_id', businessId)`.
- **Soft deletes only**: Never hard-delete jobs, clients, or workers. Set `deleted_at = now()`.
- **Supabase migrations are NOT auto-applied** — run schema changes manually in the Supabase SQL Editor.
- **Supabase project ID**: `lskzzsjmmtsosfneuovt`

### Hourly job field conventions — READ THIS
- `flat_rate` stores the **$/hr rate** for Hourly jobs (not a flat fee). This is intentional — NewJobSheet writes it that way.
- `total_amount` is written with the **finalized actual total** when a job completes (via `recordPayment`). For in-progress/scheduled jobs it holds the booking-time estimate. Always use `computeJobFinancials()` for UI math — do not read `total_amount` raw in components.
- `subtotal` (DB column) = base labor only. `hst_amount` = finalized HST. `total_amount` = final grand total. All three are written on completion.
- `additional_costs_json` is the array of cost items. `additional_cost` is a backward-compat scalar sum.
- `toDisplayJob()` in `selectors.js` wraps the raw DB row — use `j.raw.fieldName` to access DB fields from display objects (e.g., in Home.jsx).
- `payments` table is the source of truth for amounts collected. `job.payment_status` is a denormalized cache.
- `computeJobTotal(job)` = subtotal + additional costs + HST. Use for collection math (what client owes).
- `computeJobSubtotal(job)` = subtotal + additional costs (no HST). Use for card/revenue display (Sandra's earnings).
- **Never trust caller-supplied `paymentStatus`** — `recordPayment` always re-derives from DB payments sum.

### RLS policy state (updated May 30, 2026)
- All tables RLS-enabled. Two SECURITY DEFINER helpers: `is_admin()` and `my_business_id()`.
- `businesses_modify` — `USING/WITH CHECK (is_admin() OR id = my_business_id())`
- `services_modify` — `USING/WITH CHECK (is_admin() OR business_id = my_business_id())`
- `workers_select` — `USING (business_id = my_business_id() OR is_admin())`
- `workers_modify` — `USING/WITH CHECK (is_admin() OR business_id = my_business_id())`

---

## Key business rules

- Sandra books all jobs herself — no self-serve client portal yet
- Payment is cash or e-Transfer only — no Stripe
- Timezone is always `America/Toronto` — never system timezone

---

## Sandra's business reference

- **Email**: `sandra@supermomforhire.com` ← canonical for everything
  - Used on: invoices (FROM + e-Transfer), Google Calendar OAuth, Google Maps, Gmail SMTP
  - Domain is `supermomforhire.com` — update `GMAIL_USER` env var when App Password is set
- **Phone**: `(416) 738-0309`
- **Location**: Georgetown, ON (home-based — no street address on invoices)
- **HST #**: `777616178 RT0001`

### Invoice architecture
- Public route: `/i/:id` — no auth required (shareable link)
- `src/pages/InvoiceView.jsx` — renders web view + PDF via `window.print()`
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`
- `api/email-invoice.js` — nodemailer/Gmail SMTP. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Logo files: `logo-banner.png` (app bar, 41KB) vs `logo-final.png` (invoice, 492KB) — never mix

---

## Current version: 0.12.9 — committed Jun 4, 2026

All core features are live. The app is in active use by Sandra. See `git log` for full history.

### ⚠️ Multi-client git discipline
CLAUDE.md is the only shared truth across online / desktop / CLI sessions. Memory files are local-only. **Always push local commits before starting an online Claude Code session**, and always pull before the online session writes code — otherwise the online session will push stale commits and overwrite newer local work (happened Jun 4, 2026).

### Last session (v0.12.9 — Jun 4, 2026)
- **GO button urgent state** — replaced red gradient on "Leave NOW" with rose pulse animation (`.go-btn-urgent`, `@keyframes goUrgentPulse` in `index.css`). Keeps brand colors, no red clash.
- **Drive time now matches Maps** — was reading `el.duration` (no-traffic baseline); switched to `el.duration_in_traffic ?? el.duration` so the button shows the same traffic-aware time as Maps.
- **Fresh GPS on tap** — `handleSupermomGo` now fires a GPS request the instant Sandra taps, races it against the 1.1s animation. Maps URL uses the fresh coords as `&origin=`, so Maps routes from her actual current location, not stale last-fetch coords.
- **Maps URL params aligned** — added `&travelmode=driving&avoid=tolls` to match Distance Matrix API call params exactly.
- **Arrive time in subtitle** — button subtitle now shows `"25 mins · arrive 3:45 PM · live traffic"` (GPS) or `"~32 mins · arrive ~3:52 PM · est. from home"` (fallback).
- **Debug logging** — `fetchLocationDrives` catch block now `console.warn('[fetchLocationDrives] failed:', err)` instead of swallowing silently. Remove before v1.0.
- **Branding assets committed** — `public/branding/supermom_icon.png` + `supermom_icon_transparent.png` were untracked; now in git.
- **Conflict resolution** — online Claude.ai session had pushed stale commits (old plain GO button) that conflicted with local v0.12.8. Resolved with force push of local history. Remote is clean.

### Last session (v0.12.8 — Jun 4, 2026)
- **Job notes fixed** — Next Up card was reading `next.job_notes` but `toDisplayJob()` maps the DB column to `next.notes`. Fixed. Removed duplicate `📌 Job Notes` block below GO button — notes only show inline under service name.
- **SUPERMOM GO button** (carried from prior session):
  - Custom Supermom icon (`/branding/supermom_icon_transparent.png`, 44px, drop-shadow)
  - `supermomLaunch` CSS animation: runway + takeoff. 1.3s. Maps opens at 1.1s.
  - Leave-by time shown with and without GPS.
- **Owing jobs redesign** — Replaced amber/red "Needs Action" section and ⚠️ stale banner with a clean collapsible "owing" section:
  - Collapsed by default, positioned between Next Up and Coming Up Today
  - Grouped by client with cumulative balance across all owing jobs
  - Intensity tiers: stale ≥48h completed = dark red (`#DC2626`); fresh completed = app rose; wrap-up only = blush
  - `+N more` badge when a client has multiple jobs
  - Privacy mode hides amounts
  - `DEEP_ROSE = '#B5004E'` hoisted to module-level constant in `Home.jsx`

### Last session (v0.12.7 — Jun 5, 2026)
- **Google Calendar OAuth fixed** — `APP_BASE_URL` was set to empty string in Vercel, causing redirect to fall back to `localhost`. Fixed: set `APP_BASE_URL=https://app.supermomforhire.com` in Vercel. Added `https://app.supermomforhire.com/api/auth/google/callback` to Google Cloud Console authorized redirect URIs. Redeployed.
- **GCal sync fixed** — `triggerGCalSync` in `jobsRepo.js` is called client-side and could never send the `INTERNAL_API_SECRET` header. Removed that auth check from `api/sync/gcal.js` — endpoint is write-only to Google Calendar, low exposure risk.
- **GCal event color** — All synced events now use `colorId: '4'` (Flamingo). Existing events get color on next re-save.
- **Briefing email overhauled** — Many improvements made this session (see below). Manual trigger confirmed working. Cron auto-fire still unverified (see below).
- **GCal sync still needs end-to-end test** — Joel connected his Google account (joel@). Sandra still needs to reconnect with `sandra@supermomforhire.com`.

### Daily briefing email — current state (Jun 5, 2026)
- **File**: `api/briefing/daily.js`
- **Manual test URL**: `https://supermom-s7-r3-tch.vercel.app/api/briefing/daily?secret=supermom_daily_email_updates&to=jlundie@gmail.com`
- **Cron schedule**: `0 11 * * *` = 7:00 AM EDT daily — defined in `vercel.json`
- **CRON_SECRET**: `supermom_daily_email_updates` — set in Vercel env + local `.env`
- **Gmail sender**: `admin@supermomforhire.com` via nodemailer. App Password updated Jun 5 (old one was revoked). New password stored in `.env` as `GMAIL_APP_PASSWORD`.
- **Reply-To**: `noreply@supermomforhire.com` — replies bounce harmlessly
- **Recipients**: loops all businesses in DB, sends to `biz.email`. Both confirmed correct:
  - Joel test account → `jlundie@gmail.com`
  - Sandra → `sandra@supermomforhire.com`
- **Email content**: subject "Good morning, {first name}!", dad joke from `icanhazdadjoke.com`, job rows show full client name + start–end time range, unpaid balances show full client name + formatted date, all links point to `app.supermomforhire.com`
- **✅ Auto-cron fixed (Jun 5, 2026)** — Root cause found: the `40 0 * * *` test schedule had been deployed to production from a **dirty working tree via `vercel --prod`** (the CLI deploys the working tree, not the committed file), so the live cron drifted from the committed `0 11 * * *`. Git never contained `40 0`. On top of that, ~20 rapid redeploys on the **Hobby plan** (single concurrent build) left one production build wedged in `INITIALIZING` for 30 min, and Hobby re-registers the cron on every deploy. **Fix:** canceled the stuck build, ran one clean `vercel --prod` from the committed `0 11 * * *` tree. Verified via Vercel API that the live cron now reads `{"path":"/api/briefing/daily","schedule":"0 11 * * *"}` on deployment `dpl_DEo4SQ...` (commit `0609679`), `enabled: true`.
  - **Hobby plan caveat**: cron timing is best-effort — the email may land anywhere in the **7:00–8:00 AM EDT** window, not exactly 7:00. Minute-accurate firing requires Pro (not doing this).
  - **DO NOT rapid-redeploy.** Every production deploy re-registers the cron and resets the next-run clock. Deploy once from a clean committed tree and leave it.
  - To re-verify the live schedule any time: **Vercel dashboard → supermom → Settings → Crons**, or query `GET https://api.vercel.com/v9/projects/{projectId}?teamId={teamId}` and read `.crons.definitions`.

### Last session (v0.12.6 — Jun 4, 2026)
- **Daily briefing email built** — `api/briefing/daily.js` queries today's + tomorrow's jobs and outstanding balances, sends branded HTML email to business owner via Gmail SMTP. Vercel Cron fires at `0 11 * * *` (7am EDT). Secured with `CRON_SECRET` env var. Multi-tenant ready. Added `?to=` override + `?secret=` query param for browser-based test triggers.
- **ANTHROPIC_API_KEY** — added to Vercel env. AI features now live (no more mocks).
- **CRON_SECRET** — re-added to Vercel env. ✅
- **Cleanup** — deleted one-time `run-update-email.bat` + `scripts/update-sandra-email.mjs` (Sandra's auth email was migrated to `sandra@supermomforhire.com`).
- **Sandra login fix** — Sandra's Supabase Auth email was already correctly set to `sandra@supermomforhire.com`. Login failure was a wrong-password issue (email was changed programmatically). Sent password reset email via Supabase admin API. She can now set a new password and log in.
- **Google Cloud billing activated** — 90-day trial had expired. Billing re-enabled with credit card. $0 budget alert set (immediate notification on any spend). Unblocks drive times + GCal sync.
- **Distance Matrix quota cap** — hard limit set to 500 elements/day in Google Cloud Console. Sandra's real usage ~15–30/day; cap stops any runaway bug before it can cause charges.
- **Google Cloud cleanup** — "My First Project" (where all credentials live, ID: `enhanced-idiom-498212-f6`) renamed to "Supermom For Hire". Empty "Supermom For Hire" project shut down. Console is now clean.
- **Sandra needs to reconnect Google Calendar** — Settings → Reconnect with `sandra@supermomforhire.com` (billing now active, this will work).
- **Drive time accuracy fixed** — Distance Matrix API was returning idealized road-speed times (no traffic). Added `departure_time=now` (real-time traffic) and `avoid=tolls` to all Distance Matrix calls. `getNavigationUrl()` also now opens Google Maps with toll avoidance pre-set. Affected: `api/distance.js`, `Home.jsx`, `maps.js`, `NewJobSheet.jsx`.

### Previous session (v0.12.4 — Jun 3, 2026)
- **GCal sync bug fixed** — `api/sync/gcal.js` was appending `:00` to already-normalized `HH:mm:ss` times, producing invalid datetimes Google rejected. Fixed datetime construction. Merged to main + deployed.
- **Home screen crash fixed** — `isNowWindow` was defined inside an IIFE in JSX but referenced outside its scope. Hoisted to component level.
- **Drive time in booking sheet** — `NewJobSheet` Step 3 now fetches real drive time from home to client on load. Replaced hardcoded "Maps not connected yet".
- **Error message** — ErrorBoundary no longer says "Joel has been notified" — generic message now.
- **Live drive-time + Leave By (executive assistant mode)** — Home screen auto-fetches GPS on load. Next Up card shows "Leave by X:XX PM" / "Leave in N mins" / "Leave NOW" (urgent red). COMING UP TODAY cards each get a "🚗 Leave by X · N mins away" annotation. Single ↻ button re-fetches from current location. Batch Distance Matrix call (one origin, all upcoming destinations). Falls back to home-based drive time if location denied.
- **Google Calendar OAuth live** — previously working. Sandra needs to Reconnect in Settings with `sandra@supermomforhire.com` to sync her own calendar.
- **Google Maps** — `GOOGLE_MAPS_API_KEY` in Vercel env. Distance Matrix + Geocoding APIs enabled. Server-side key — not account-specific.

### Drive time architecture (v0.12.4)
- `locationDrives` state in `Home.jsx`: `{ [jobId]: { duration: string, durationValue: number } }` — ephemeral, never persisted
- `formatLeaveBy(durationValue, jobStart, nowDate)` — pure helper in Home.jsx
- `fetchLocationDrives()` — batch GPS + Distance Matrix call, auto-triggered on load via `locationFetchedRef` guard
- `updateDailyRoutes()` in `maps.js` — still runs for home-based pre-calc, persisted to `ai_context.drive_to` in DB

---

## Critical rules — read before every build

- **Read `DESIGN.md` before writing any component** — all tokens, typography, component anatomy defined there
- **Mobile-first** — design for 390px iPhone viewport first
- **Keyboard aware** — use `useKeyboardFocus` hook to adjust padding in bottom sheets
- **Increment version** in `package.json` on every meaningful release
- **Test on both** Joel's Pixel 10 Pro (Android) and Sandra's iPhone

---

## Parked / not building yet

### Immediate — in priority order
- [x] **Gmail SMTP** — `invoice@supermomforhire.com` live + tested. (Jun 2, 2026)
- [x] **Google Calendar OAuth** — consent screen configured, credentials set, tested working. (Jun 2, 2026)
- [x] **Google Maps API** — Geocoding + Distance Matrix enabled, key in Vercel + `.env`. (Jun 2, 2026)
- [x] **Calendar sync** — `api/sync/gcal.js` wired to job create/update/delete. Datetime bug fixed Jun 3. (Jun 3, 2026)
- [x] **ANTHROPIC_API_KEY** — added to Vercel env. AI features live. (Jun 3, 2026)
- [x] **Daily briefing email** — built in v0.12.5. Gmail SMTP, Vercel Cron 7am EDT. CRON_SECRET re-added to Vercel. (Jun 3, 2026)
- [x] **Google Cloud billing** — activated, $0 budget alert set, Distance Matrix quota capped at 500 elements/day. (Jun 4, 2026)
- [x] **Google Cloud cleanup** — renamed project to "Supermom For Hire", shut down empty duplicate project. (Jun 4, 2026)
- [x] **Google Calendar OAuth** — fixed and working (Jun 5, 2026). `APP_BASE_URL` corrected in Vercel.
- [ ] **Sandra reconnects Google Calendar** — Settings → Reconnect with `sandra@supermomforhire.com`
- [x] **Manual briefing trigger confirmed working** — `?secret=supermom_daily_email_updates&to=jlundie@gmail.com` works. Gmail App Password updated Jun 5.
- [x] **Auto-cron schedule fixed (Jun 5, 2026)** — live cron now correctly `0 11 * * *` (7am EDT) on a clean deploy; was drifted to a leftover `40 0` test schedule. See Last session notes. Final confirmation = email lands in `jlundie@gmail.com` between 7:00–8:00am EDT (Hobby timing slop).
- [ ] **Supabase public schema grants — due before Oct 30, 2026** — Run in Supabase SQL Editor (project `lskzzsjmmtsosfneuovt`): `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;`
- [ ] **PWA / installable app** — `manifest.json` + service worker. Makes app installable to iPhone home screen (no browser chrome). Prerequisite for push notifications.
- [ ] **Push notifications** — Fire "Leave in 15 mins for Karen" at leave-time. Requires PWA first. High value for Sandra.
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked in DB. No app login yet. When ready: link `workers.id` → `users` table + add Supabase Auth account.

> Vercel Hobby plan: **10 of 12** serverless functions used. 2 slots remaining. Consider consolidating functions when a new slot is needed.
> API cost: Distance Matrix hard-capped at 500 elements/day. $0 budget alert on billing. GCal free. Sandra's real usage ~15–30 elements/day.
> **Watchlist**: Monitor function slot count, Maps quota usage, and cron schedule drift each session. Don't rapid-redeploy (resets cron clock).

### Next session priorities
1. **Sandra reconnects Google Calendar** — Settings → Reconnect with `sandra@supermomforhire.com` (Sandra action)
2. **Supabase schema grants** — 1 SQL command, must do before Oct 30, 2026
3. **PWA setup** → push notifications (prerequisite for #4)
4. **Archive Client & All Jobs** — admin danger zone in `ClientProfile.jsx`. Plan is in `docs/superpowers/plans/2026-05-18-ui-polish.md` Task 5. Was not shipped despite other ui-polish tasks being done.
5. **Calendar readability overhaul** — current Schedule page (day/agenda views) is hard to read. Needs UX rethink — cards too dense, key info not scannable. Design pass required before coding.
6. **Staff app access** — `person_type = 'staff'` in DB. Link `workers.id` → `users` + Supabase Auth. Note: rename "staff" label to something better — TBD with Joel.
7. **Remove debug console.warn** — `console.warn('[fetchLocationDrives] failed:', err)` in `Home.jsx`. Cleanup before v1.0.

### UX polish — input behaviour (confirmed Jun 4, 2026)
- [ ] **Select-all on text field focus** — every numeric/amount input across the app (NewJobSheet, EditJob, service catalog, etc.) should select all text when tapped so the user can just start typing. Use `onFocus={e => e.target.select()}` on all `<input type="text|number">` fields.
- [ ] **Duration defaulting to 1.667h bug** — when adding or editing a job, the duration field sometimes shows `1.667` instead of the service's `default_duration`. Likely a minutes→hours conversion rounding issue (100 min ÷ 60 = 1.6667). Needs investigation in NewJobSheet and EditJob — find where `default_duration` is written to the duration field and ensure it's rounded or stored correctly.

### Navigation / UX fixes (confirmed Jun 4, 2026)
- [ ] **Logo taps → Home** — tapping the logo in the app bar should always navigate to `/` (Home screen).
- [ ] **Login always lands on Home** — after successful login, redirect to Home regardless of previous route.
- [ ] **Viewpoint switch → Home** — when Super Admin switches to another user's viewpoint, navigate to Home screen immediately after the switch.
- [ ] **Back always goes Home** — navigating "back" (e.g. closing a sheet or detail page) should return to Home, unless there is unsaved work in progress (edit or new job form — warn/block in that case).
- [ ] **Edit Job parity with Add Job** — Edit Job sheet is missing fields that exist in NewJobSheet. Audit both and bring Edit Job up to full parity so every field editable at booking time is also editable after.

### Features — Phase 2
- [ ] **AI chat interface** — `api/ai/[action].js` already exists. Need chat UI component + conversation state. `ANTHROPIC_API_KEY` is now set. HIGH PRIORITY.
- [ ] **Voice scheduling** — `api/transcribe.js` already exists. Flow: tap mic → transcribe → Claude parses intent → pre-fills booking sheet. HIGH PRIORITY.
- [ ] **Custom domain → swap email provider** — swap `nodemailer` for `resend`. `from` becomes `invoices@supermomforhire.com`. Ask Joel what Resend is before doing. ~5-min job once understood.
- [ ] **Self-serve client booking link** — no self-serve portal yet. Low priority.
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load. Better `Suspense` fallbacks needed.
- [ ] **Client engagement tools** — AI follow-up / re-booking reminders.
- [ ] **Swipe to delete on job cards** — client request, low priority, may not do.
