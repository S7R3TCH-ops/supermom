# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is the authoritative project state. Do NOT rely on memory files for project status — they drift. Update this file instead.
> **Drift check (every session, before new work)**: Run `git log --oneline -15` and compare against the most recent "Last session" entries below. If commits aren't documented there, write a catch-up entry first — don't stack new undocumented work on top of old undocumented work. (This file was found 6 commits behind on Jun 7, 2026 — a `pre-push` hook now warns when code lands without a CLAUDE.md update, but it can't reach online sessions, so the habit has to hold across every surface.)

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers organizing, decluttering, caregiving, life coaching, and errands — all self-booked after client calls or texts.

This is a **managed service product** — Sandra is the first user, but the architecture supports onboarding other solo operators.

### Platform Hierarchy
- **Super Admin (Joel)**: `admin` role in DB. Not linked to any business. Switches "Viewpoints" to see any business.
- **Business Owners (Sandra, etc.)**: `owner` role, scoped to their `business_id`.

---

## Design Context

`PRODUCT.md` (strategic) and `DESIGN.md` (visual) are the source of truth for all design work — read both before touching UI. Quick orientation: register is **product**; brand personality is **"kick-ass Mary Poppins"** (capable, warm, unflappable — makes hard things look effortless, never cutesy or toy-like); primary design lens is Sandra's actual day, not a hypothetical future tenant. Anti-references: AI-slop "vibe-coded" look, cartoon-superhero iconography, cold corporate SaaS. See `PRODUCT.md` for the full Brand Personality / Anti-references / Design Principles sections.

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
- `api/sync/gcal.js` intentionally has **no `INTERNAL_API_SECRET` check** — `triggerGCalSync` is called client-side (which can't supply server secrets), and the endpoint is write-only to Google Calendar, so exposure is low.

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

## Current version: 0.12.14 — committed Jun 7, 2026

All core features are live. The app is in active use by Sandra. See `git log` for full history.

### ⚠️ Multi-client git discipline
CLAUDE.md is the only shared truth across online / desktop / CLI sessions. Memory files are local-only. **Always push local commits before starting an online Claude Code session**, and always pull before the online session writes code — otherwise the online session will push stale commits and overwrite newer local work (happened Jun 4, 2026).

### Last session (v0.12.14 — Jun 7, 2026)
- **Client `postal_code` field shipped** — was believed done last session but never landed (confirmed absent from forms/selectors/invoices). Added to `NewClientSheet.jsx` + `EditClientSheet.jsx` (placed after CITY, `.toUpperCase()` on save), joined into `selectors.js` `client.address` (flows to Maps links + job displays), and appended to the invoice client-address block in natural Canadian format ("Georgetown, ON L7G 4S5") in both `InvoiceView.jsx` and `api/_lib/invoicePdf.js`. Province intentionally left alone (hardcoded `'ON'` — all clients local).
- **Invoices now show real payment status** — previously every invoice read "Total Due: $X" even when fully paid. New shared helper `src/lib/invoiceBalances.js` exports `decorateInvoiceWithBalances(supabaseClient, invoice)` (accepts either RLS browser client or service-role server client — mirrors the cross-context import pattern `invoicePdf.js` already used for `financialMath.js`). Computes real `amountPaid`/`balanceOwing`/`isPaidInFull` from the `payments` table (source of truth, never `job.payment_status`). Invoices now render: green "✓ Paid in Full" badge when fully paid, Invoice Total / Paid / Balance Owing breakdown when partially paid, or the original "Total Due" only when nothing has been paid. Wired into both `invoicesRepo.fetchInvoiceById` (browser) and `api/email-invoice.js` (server, PDF attachment path) so web view, PDF download, and emailed PDF all match.
- **"Other Outstanding Balances" section added to invoices** — when a client has other `Completed` jobs still owing money, the invoice now lists each one (date / service / amount owing) plus a "Combined Balance Owing — All Jobs" running total (`runningTotalOwing`), in both `InvoiceView.jsx` and `api/_lib/invoicePdf.js`. Surfaces even on a paid-in-full invoice if the *same client* has unrelated unpaid jobs — verified against real data (e.g. Jenn Fuller: invoice 2026-011 shows "Paid in Full" for its own job but lists two other $100 jobs owing, combined total $200).
- **`due_date` now same-day as `invoice_date`** — was hardcoded `scheduled_date + 7 days` in `generateInvoiceForJob` (`invoicesRepo.js`); now `due_date = job.scheduled_date` (matches `invoice_date`). Re-generating an existing invoice (the `existingLink` update path) now also re-patches `due_date`, self-healing any previously-stored `+7day` value.
- **Latent ESM bug caught + fixed during verification** — `invoiceBalances.js` imported `financialMath` without a `.js` extension. That's the convention for browser-side `src/` files (Vite resolves it), but this helper is also loaded transitively into `api/email-invoice.js` (Vercel serverless, `"type": "module"` → strict Node ESM resolution requires extensions — every other `api/`-reachable import already uses `.js`). Would have thrown `ERR_MODULE_NOT_FOUND` on the emailed-PDF path in production. Caught by writing a throwaway script that ran `decorateInvoiceWithBalances` + `buildInvoicePdfBuffer` against all 18 of Sandra's real invoices end-to-end (script deleted after verification — not committed).
- **Invoice layout redesign** (follow-on, same session) — restructured the totals section into a clean linear order: Invoice Total → Payments Received (only if any) → Outstanding Balance (always shown, even at $0) → green "✓ Paid in Full" badge. Removed the redundant `$X/hr × Y hrs = $Z` / "Flat Rate" sub-line under the service description (duplicated the Rate/Hours/Amount table columns). Added faint cream (`FAINT = '#F5F1EC'`) header rows to the secondary "Payments Received" and "Other Outstanding Balances" breakdown tables so they read as proper tables, matching the main line-items table's `CREAM` header. Tightened spacing throughout (page padding, row padding, line-heights, margins) so invoices reliably fit on one page — was cutting off the payment section at the bottom. Changed in both `InvoiceView.jsx` and `api/_lib/invoicePdf.js` (web/PDF must mirror). **Found + fixed a react-pdf/Yoga layout bug during verification**: a single-row "Outstanding Balance · Paid in Full · $0.00" overlapped/concatenated because react-pdf measures `letterSpacing` text without its visual width and cannot create negative space with `justify-content: space-between` — it overlaps overflowing text instead of wrapping. Fixed by stacking into two lines (`balanceMainRow` label+value, separate right-aligned `paidBadge` below). Verified via real generated PDFs for two invoices (Jenn Fuller 2026-011, Ann Rae 2026-017) covering payments + paid-in-full + other-outstanding cases — both render correctly on one page. Web view not independently screenshot-verified (RLS blocks anonymous `/i/:id` access in a fresh browser — confirmed `406`/`PGRST116`); recommend Sandra/Joel spot-check live in an authenticated session.

### Last session (v0.12.13 — Jun 5–6, 2026)
- **Calendar readability overhaul** — removed Day view (redundant with Home). Week view: first name at 10px + service word on second line. Agenda: time range prominent at 11.5px bold, address on separate line, removed GCAL badge and UNPAID badge from future-scheduled jobs. Tapping a week-strip day switches to Agenda. GO button removed from Calendar (Home only).
- **Team labels renamed** — worker → Sidekick 🦸, staff → Wingmom 🌟; DB `person_type` values updated to `'sidekick'`/`'wingmom'`. (Labels are still hardcoded — must be made per-business configurable before tenant #2.)
- **Home screen UX overhaul** — removed "Tight Transition" banner (urgency now shown inline on the active job card via an "Up Next" strip: next client, leave-by time, drive duration with green/amber/red coloring, "est. from home" label for fallback). `locationDrives` now re-fetches from the job site's GPS on clock-in instead of home. Owing section moved below "Rest of this week" (it's historical debt, not time-sensitive).
- **GPS drive re-fetch trigger fixed** — re-fetches by time window instead of requiring a manual clock-in, so drive times stay fresh automatically.
- **Business restore + safe re-provisioning** (merged via PR #1, online session) — Admin panel shows a "Deleted Businesses" section with RESTORE buttons that clear `deleted_at`. `provision.js` now detects existing `auth.users` emails: live business → 409 directing to RESTORE; soft-deleted business → reuses the auth account, updates password, upserts `public.users`, creates a fresh business row. No more "email already registered" crash on re-provisioning.
- **Duplicate GCal events fixed** — `updateDailyRoutes` was calling `updateJob()` to persist drive-time data, which always triggers `triggerGCalSync`; for same-day first bookings this fired a second sync before `gcal_event_id` saved back to DB, creating two events. Fixed by replacing that call with a new `patchJobAiContext()` helper (`jobsRepo.js`) that does a fresh DB read before merging `ai_context` fields — preserves `gcal_event_id` and concurrent writes, and does not trigger sync.
- **PDF attached to invoice emails** — clients now receive the invoice as a PDF attachment (generated server-side via `@react-pdf/renderer`, `api/_lib/invoicePdf.js`) instead of just an app link they can't access. Falls back to sending without the attachment if PDF generation fails.
- **PDF formatting polish** (online session, follow-on to the above) — removed the dead in-app invoice link from the email body, enlarged the logo to balance against the business name, and rebuilt the address blocks as single text flows with tightened spacing to match the payment section.

### Changelog archive
Session history for v0.12.4 – v0.12.12 (Jun 3–5, 2026) has moved to `docs/changelog/v0.12.4-to-v0.12.12.md`, relocated **verbatim** — not summarized, so exact detail is preserved if ever needed. Anything load-bearing from those sessions (gotchas, root causes, standing facts that explain non-obvious code) has already been promoted into the permanent reference sections in this file — see Security & Environment, Daily briefing email, Drive time architecture, Hourly job conventions, RLS policy state. **Don't read the archive preemptively.** `git log` / `git show <sha>` already cover "what changed, when" with full diffs; the archive exists for the rare "why does this code look like this" question a permanent section doesn't answer — grep it by keyword or version when that comes up.

> **Reorg note (Jun 7, 2026)**: This relocation cut CLAUDE.md from ~32KB to keep it cheap to read every session. While auditing the moved entries against the still-open checklists, found two items in "UX polish — input behaviour" below marked `[ ]` that the v0.12.10 session note (now archived) said were already fixed — verified both against `src/` directly and ticked them. Real drift the session-start check didn't catch because it only ever compares `git log` against the *latest* "Last session" entry, not older ones against open checklists.

### Daily briefing email — current state (Jun 5, 2026)
- **Cadence preference**: stored per-business in `ai_profile.email_frequency` (`'daily'`|`'weekly'`), set during onboarding's Email Preference step. Only the daily cron is built — weekly variant is parked.
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

### Greenfield rewrite spec (parked, drafted Jun 5, 2026)
`BLUEPRINT.md` and `AI_PROJECT_INSTRUCTIONS.md` are a complete "what would v2 look like" spec written after shipping v0.12.x — full stack swap (Next.js 15 + TypeScript strict + Drizzle ORM + TanStack Query + Zustand + shadcn/ui + Resend + Sentry), clean schema redesign fixing the `flat_rate`/`total_amount` naming confusion, and a documented list of what worked vs. what to never repeat. **Not active work** — the current v0.12.x app is live and serving Sandra. Revisit only if/when a ground-up rebuild becomes the right call (e.g. scaling past Sandra to other tenants makes the v1 architecture's pain points too costly to keep patching).

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
- [x] **Supabase public schema grants** — Done Jun 4, 2026. Ran in Supabase SQL Editor (project `lskzzsjmmtsosfneuovt`).
- [ ] **PWA / installable app** — `manifest.json` + service worker. Makes app installable to iPhone home screen (no browser chrome). Prerequisite for push notifications.
- [ ] **Push notifications** — Fire "Leave in 15 mins for Karen" at leave-time. Requires PWA first. High value for Sandra.
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked in DB. No app login yet. When ready: link `workers.id` → `users` table + add Supabase Auth account.

> Vercel Hobby plan: **10 of 12** serverless functions used. 2 slots remaining. Consider consolidating functions when a new slot is needed.
> API cost: Distance Matrix hard-capped at 500 elements/day. $0 budget alert on billing. GCal free. Sandra's real usage ~15–30 elements/day.
> **Watchlist**: Monitor function slot count, Maps quota usage, and cron schedule drift each session. Don't rapid-redeploy (resets cron clock).

### Next session priorities
0. **Design system follow-up (flagged Jun 7, 2026, post `$impeccable init`)** — `PRODUCT.md` now exists and shifts the brand voice toward "kick-ass Mary Poppins" (capable/warm/unflappable) and explicitly *away* from literal superhero iconography/copy — but `DESIGN.md` still leans hard into superhero language ("mission control," cape-energy gradient names, etc.). Two follow-ups once UI work resumes: (a) run `$impeccable critique <surface>` on a real screen (no critique has ever been run on this app) and (b) refresh `DESIGN.md` (`$impeccable document`) to bring its voice in line with `PRODUCT.md`'s toned-down personality. Not urgent — do it when doing visual/UI work, not as a standalone task.
1. **Sandra reconnects Google Calendar** — handled during onboarding/data reset (Sandra action)
2. ~~**Supabase schema grants**~~ — ✅ Done Jun 4, 2026
3. ~~**Navigation fixes**~~ — ✅ Done v0.12.12 (back→Home, login→Home, viewpoint switch→Home)
4. ~~**Edit Job parity**~~ — ✅ Done v0.12.12 (additional costs UI added to EditMode)
5. ~~**Remove debug console.warn**~~ — ✅ Done v0.12.12
6. ~~**Archive Client & All Jobs**~~ — ✅ Already done (found in audit Jun 4, 2026). Full ui-polish plan (`docs/superpowers/plans/2026-05-18-ui-polish.md`) was complete: `cancelJob` (jobsRepo.js:298), admin danger zone (ClientProfile.jsx:545), Cancel Booking UI + admin delete (JobDetailSheet.jsx:504), Calendar grey cancelled + dynamic timeline (Calendar.jsx:92), TODAY button (Calendar.jsx:222).
7. ~~**Calendar readability overhaul**~~ — ✅ Done v0.12.13. Removed Day view (redundant with Home). Week view: first name at 10px + service word on second line (was 8px init·service). Agenda: time range prominent at 11.5px bold, address on separate line, removed GCAL badge, removed UNPAID badge from Scheduled (future) jobs. Tapping a week-strip day switches to Agenda. GO button removed from Calendar (Home only).
8. **PWA setup** → push notifications (prerequisite for push notifs)
9. **Staff app access** — `person_type = 'staff'` in DB. Link `workers.id` → `users` + Supabase Auth. Note: rename "staff" label to something better — TBD with Joel.

### UX polish — input behaviour (confirmed Jun 4, 2026)
- [x] **Select-all on text field focus** — `onFocus={e => e.target.select()}` is live on all numeric inputs (JobDetailSheet, PostJobSheet, ServiceCatalogSheet, WorkerCatalogSheet, NewExpenseSheet, Settings). Done v0.12.10 (Jun 4) — this checklist had drifted (still showed open); corrected + re-verified against source Jun 7, 2026.
- [x] **Duration defaulting to 1.667h bug** — `NewJobSheet` rounds `duration/60` to 2dp on save (`Math.round((duration/60)*100)/100`); `JobDetailSheet` rounds `estimated_hours` on load. Done v0.12.10 (Jun 4) — this checklist had drifted (still showed open); corrected + re-verified against source Jun 7, 2026.

### Navigation / UX fixes (confirmed Jun 4, 2026)
- [x] **Logo taps → Home** — back button in `LogoBar.jsx` now navigates to `/`. (v0.12.12)
- [x] **Login always lands on Home** — `Login.jsx` calls `navigate('/')` after successful sign-in. (v0.12.12)
- [x] **Viewpoint switch → Home** — `ViewpointContext.switchTo` uses `window.location.href = '/'`. (v0.12.12)
- [x] **Back always goes Home** — `LogoBar.jsx` + `ClientProfile.jsx` back buttons navigate to `/`. (v0.12.12)
- [x] **Edit Job parity with Add Job** — additional costs UI added to EditMode in `JobDetailSheet.jsx`. (v0.12.12)

### Features — Phase 2
- [ ] **AI chat interface** — `api/ai/[action].js` already exists. Need chat UI component + conversation state. `ANTHROPIC_API_KEY` is now set. HIGH PRIORITY.
- [ ] **Voice scheduling** — `api/transcribe.js` already exists. Flow: tap mic → transcribe → Claude parses intent → pre-fills booking sheet. HIGH PRIORITY.
- [ ] **Custom domain → swap email provider** — swap `nodemailer` for `resend`. `from` becomes `invoices@supermomforhire.com`. Ask Joel what Resend is before doing. ~5-min job once understood.
- [ ] **Self-serve client booking link** — no self-serve portal yet. Low priority.
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load. Better `Suspense` fallbacks needed.
- [ ] **Client engagement tools** — AI follow-up / re-booking reminders.
- [ ] **Swipe to delete on job cards** — client request, low priority, may not do.
