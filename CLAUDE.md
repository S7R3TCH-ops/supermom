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
- `src/pages/InvoiceView.jsx` — renders web preview. "Download PDF" button → `/api/download-invoice`. "Print" button → `window.print()` (physical printer only).
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`
- `api/email-invoice.js` — nodemailer/Gmail SMTP. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- `api/download-invoice.js` — GET `?id=<invoiceId>`. Generates react-pdf buffer server-side. Filename is `LastName_Invoice_YYYY-NNN.pdf` or `LastName_Receipt_YYYY-NNN.pdf` depending on payment status. Same PDF as the email attachment. Fixes Android Chrome filename + iOS Safari formatting.
- `api/_lib/invoicePdf.js` — react-pdf document builder. Address blocks use single `<Text>` nodes with `\n`-joined nested children (not stacked `<Text>` elements) — this is intentional; react-pdf gives each stacked Text its own font-metrics line-box, making lineHeight/marginBottom ineffective for inter-line spacing.
- Logo files: `logo-banner.png` (app bar, 41KB) vs `logo-final.png` (invoice, 492KB) — never mix

---

## Current version: 0.12.24 — committed Jun 9, 2026

Sandra's business is live — data wiped and re-provisioned this session. App is in active use.

### ⚠️ Multi-client git discipline
CLAUDE.md is the only shared truth across online / desktop / CLI sessions. Memory files are local-only. **Always push local commits before starting an online Claude Code session**, and always pull before the online session writes code — otherwise the online session will push stale commits and overwrite newer local work (happened Jun 4, 2026).

### Recent changes — run `git log --oneline -10` for full detail
- **v0.12.24 (Jun 9)** — PWA support: `vite-plugin-pwa` + Workbox SW (autoUpdate), web manifest, `apple-touch-icon`, `theme-color` meta. Icons (192, 512, 180px) generated from `supermom_icon_transparent.png`. Supabase API excluded from SW cache (NetworkOnly). `PWAUpdatePrompt` toast component fires when a new build is available. Installable from Safari share sheet (Sandra's iPhone) and Chrome address bar (Pixel). SW is invisible during `npm run dev` — zero dev workflow impact.
- **v0.12.23 (Jun 9)** — Settings page shows a proper error state ("account not linked to a business") instead of blank white screen for unprovisioned accounts. `useBusiness` now surfaces errors. Provisioned `joel@test.com` as a business owner (business ID `80daa477`) for testing the owner experience.
- **v0.12.22 (Jun 9)** — Dark mode job cards: replaced hardcoded light pastels with theme tokens (`T.amberBg`, `T.redBg`, `T.pinkTint`). Accent/border colors now have dark-mode variants. Worker "$ Unpaid" badge uses `T.amberBg`. Detection via `T.ink === '#FFFFFF'`.
- **v0.12.21 (Jun 9)** — Production launch: full data wipe + Sandra re-provisioned. Fixed `reset-platform.mjs` FK ordering (workers/skill_types/worker_skills were not being deleted). Fixed service pricing type not propagating to job: (1) `JobDetailSheet` edit mode now sets `pricing_type` when service changes; (2) `NewJobSheet` `liveBreakdown` fallback changed `|| 'Hourly'` → `|| 'Flat'` (both Step2 and Step3); (3) `ServiceCatalogSheet` new service defaults to Flat Rate with blank price, switching type clears price.
- **v0.12.20 (Jun 9)** — Invoice/Receipt label now large + bold at top-right (web + PDF). Distance columns (`distance_to_km`, `distance_home_km`) written to jobs table from `maps.js`. All v0.12.19 code committed.
- **Invoice polish (Jun 9)** — Outstanding Balance row: amount now red when > 0, default ink when zero; "✓ Paid" stamp moved to its own line below the balance (was inline). Both web view and PDF updated (`InvoiceView.jsx`, `api/_lib/invoicePdf.js`).
- **v0.12.19 (Jun 9)** — Invoice/Receipt two-stage document flow. Invoice auto-generates on job completion (not just on full payment). Once paid, same invoice renders as "RECEIPT" (label, footer, email header, filename). `email-invoice.js` stamps `jobs.invoice_sent_at` or `jobs.receipt_sent_at` after send; sent dates display in InvoiceView toolbar. Schema: `ALTER TABLE jobs ADD COLUMN invoice_sent_at timestamptz, ADD COLUMN receipt_sent_at timestamptz` — must be run manually in Supabase SQL Editor before this goes live.
- **Cleanup (Jun 9)** — Deleted parked greenfield rewrite spec files (`BLUEPRINT.md`, `AI_PROJECT_INSTRUCTIONS.md`). Added `@media (prefers-reduced-motion)` CSS rule for a11y support (disables animations for users with reduced-motion preferences). Updated `/wrap` command to use flag-based stop hook.
- **v0.12.18** (Jun 8) — Dev tooling: cross-session git sync infrastructure. Auto-push hook fires after every `git commit`; auto-pull hook fires once per calendar day on first message (flag-file guard). Stop hook + `cc` PowerShell wrapper: `/wrap` now exits Claude CLI and automatically reopens a fresh session — zero extra keystrokes. `.claude/settings.json` committed + tracked (`.gitignore` updated). `/wrap` slash command updated to create `~/.claude/sm-wrap-done.flag`. PowerShell profile created at `$PROFILE` with `cc` function.
- **v0.12.17** (Jun 8) — Invoice PDF polish + cross-platform download fix. Removed dead "View Invoice" link from email (clients have no app access). Fixed address block spacing in PDF — root cause was react-pdf stacked-Text line-box behavior; restructured to single `<Text>` with `\n`-joined children. Logo enlarged 72→140px. New `api/download-invoice.js` endpoint fixes Android Chrome filename ("supermom app" → proper `LastName_Invoice_YYYY-NNN.pdf`) and iPhone formatting (Safari `window.print()` rendered HTML; now serves same react-pdf PDF as email). Function slots: 11/12.
- **v0.12.16** (Jun 8) — Home screen critique fixes: `inkMuted` contrast fix (WCAG AA), hero label contrast in light mode, all fontWeight 800/900 → loaded weights, GO button nested-button → `div[role=button]`, refresh tap target → 44×44px, keyboard spacer `height` → `max-height` transition, "Next up" header uses SectionLabel, MissionIntel bgSecondary → T.surface.
- **v0.12.15** (Jun 7) — Invoice print layout fixed to one page; `✓ Paid` badge no-wrap; emailed PDF filename includes client last name; `@media print` rules in `index.css`. Not yet verified on real phone — Joel/Sandra should spot-check.
- **v0.12.14** (Jun 7) — `postal_code` field added; invoices show real payment status via `invoiceBalances.js`; "Other Outstanding Balances" section; `due_date` = same-day; ESM `.js` extension bug fixed; invoice layout redesign.
- **v0.12.13** (Jun 5–6) — Calendar overhaul (no Day view, week/agenda readability); team labels → Sidekick/Wingmom; Home UX overhaul (Up Next strip, drive re-fetch); duplicate GCal events fixed; PDF attached to invoice emails.

> Full session notes archived in `docs/changelog/`. Don't read preemptively — use `git log` / `git show <sha>` for diffs.

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

### Greenfield rewrite spec (archived Jun 9, 2026)
Deleted `BLUEPRINT.md` and `AI_PROJECT_INSTRUCTIONS.md` — parked greenfield v2 spec (Next.js 15 + TS strict + Drizzle + TanStack Query + Zustand + shadcn/ui + Resend + Sentry) no longer maintained. Was: full architecture overhaul. **Not active work.** Revisit only if v1 architecture pain becomes too costly to patch.

### Immediate — open items only
> All pre-launch infra complete as of Jun 5, 2026 (Gmail, GCal, Maps, cron, Supabase grants). See git log for history.

- [x] **PWA / installable app** — ✅ done v0.12.24. `vite-plugin-pwa`, manifest, SW, icons.
- [ ] **Push notifications** — Fire "Leave in 15 mins for Karen" at leave-time. Requires PWA first. High value for Sandra.
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked in DB. No app login yet. When ready: link `workers.id` → `users` table + add Supabase Auth account.

> Vercel Hobby plan: **11 of 12** serverless functions used. 1 slot remaining. Consider consolidating functions when a new slot is needed.
> API cost: Distance Matrix hard-capped at 500 elements/day. $0 budget alert on billing. GCal free. Sandra's real usage ~15–30 elements/day.
> **Watchlist**: Monitor function slot count, Maps quota usage, and cron schedule drift each session. Don't rapid-redeploy (resets cron clock).

### Next session priorities
1. **Design system follow-up** — `$impeccable critique` on Job detail, Client profile, Calendar, Finance, Settings, Admin — then `$impeccable document` once at end to refresh DESIGN.md.
2. **PWA setup** → push notifications (prerequisite for push notifs)

### Features — Phase 2
- [ ] **AI chat interface** — `api/ai/[action].js` already exists. Need chat UI component + conversation state. `ANTHROPIC_API_KEY` is now set. HIGH PRIORITY.
- [ ] **Voice scheduling** — `api/transcribe.js` already exists. Flow: tap mic → transcribe → Claude parses intent → pre-fills booking sheet. HIGH PRIORITY.
- [ ] **Custom domain → swap email provider** — swap `nodemailer` for `resend`. `from` becomes `invoices@supermomforhire.com`. Ask Joel what Resend is before doing. ~5-min job once understood.
- [ ] **Self-serve client booking link** — no self-serve portal yet. Low priority.
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load. Better `Suspense` fallbacks needed.
- [ ] **Client engagement tools** — AI follow-up / re-booking reminders.
- [ ] **Swipe to delete on job cards** — client request, low priority, may not do.
