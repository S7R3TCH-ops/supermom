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
- `src/pages/InvoiceView.jsx` — renders web preview. "Download PDF" button → `GET /api/invoice?id=`. "Print" button → `window.print()` (physical printer only).
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`
- `api/invoice.js` — consolidated: GET `?id=<invoiceId>` → PDF download; POST → email send (nodemailer/Gmail SMTP). Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Filename: `LastName_Invoice_YYYY-NNN.pdf` or `LastName_Receipt_YYYY-NNN.pdf`.
- `api/_lib/invoicePdf.js` — react-pdf document builder. Address blocks use single `<Text>` nodes with `\n`-joined nested children (not stacked `<Text>` elements) — this is intentional; react-pdf gives each stacked Text its own font-metrics line-box, making lineHeight/marginBottom ineffective for inter-line spacing.
- Logo files: `logo-banner.png` (app bar, 41KB) vs `logo-final.png` (invoice, 492KB) — never mix

---

## Current version: 0.12.42 — Jun 14, 2026

Sandra's business is live — data wiped and re-provisioned Jun 9. App is in active use.

### ⚠️ Multi-client git discipline
CLAUDE.md is the only shared truth across online / desktop / CLI sessions. Memory files are local-only. **Always push local commits before starting an online Claude Code session**, and always pull before the online session writes code — otherwise the online session will push stale commits and overwrite newer local work (happened Jun 4, 2026).

### Recent changes — run `git log --oneline -10` for full detail
- **v0.12.42 (Jun 14)** — Admin "Mark as Unpaid" + receipt layout polish. (1) `JobDetailSheet` admin section: new "Mark as Unpaid (Admin)" button (visible only on Paid/Partial jobs) with two-tap confirm — deletes all `payments` rows for the job and resets `payment_status = ''` (empty string is the unpaid sentinel; check constraint rejects `'Unpaid'`). Added `markJobUnpaid(id)` to `jobsRepo.js`. (2) Receipt layout: Payments Received section moved to LEFT white space beside the totals column (both web + PDF) — plain date + amount, no green, no `+`. `✓ Paid` label now appears BEFORE the amount on Invoice Total and grand total bar. When `alsoPaid.length > 0`, a grey "Settlement total" secondary line appears below the payment rows showing the combined amount across all settled jobs. "Also Paid" column header changed from "Paid" → "Amount". Grand total bar label changed from "Total Paid — All Jobs" → "Total Owing — All Jobs". `InvoiceView.jsx` and `api/_lib/invoicePdf.js` kept in sync.
- **v0.12.41 (Jun 14)** — Settle-all-outstanding from an invoice + multi-job receipt. Owner can record one payment from the invoice page (`/i/:id`) that settles the current job **and** any other outstanding jobs for that client; the invoice then renders as a Receipt with an **"Also Paid for This Client"** section + **"Total Paid — All Jobs"** bar (web + PDF). Mechanism: settlement payments are tagged `payments.invoice_id = <this invoice>` (column already existed, was unused) so `decorateInvoiceWithBalances` can find the jobs "paid via this invoice" — **no `invoice_jobs` multi-link**, keeps the single-job `invoice_jobs[0]` assumption intact. New `invoicesRepo.js` fns: `settleInvoiceOutstanding(invoiceId, method, jobIds=null)` (recomputes owing fresh from DB → idempotent/safe to re-run; inserts a payment per job for its exact remaining owing, flips job + its own invoice to Paid; does NOT recompute/overwrite job subtotal/hst/total — avoids the v0.12.39/.40 double-HST trap) and `voidInvoiceSettlement(invoiceId, jobId=null)` (soft-voids the batch, re-derives each job's status). `InvoiceView.jsx`: owner-gated (`useAuth` session + business match via `getCurrentBusinessId`) no-print panel with per-job checkboxes (job-selection — Joel can choose which to apply), Cash/e-Transfer selector, `useRef` double-submit guard, and an "↩ Undo Payment" two-tap-confirm button. `decorateInvoiceWithBalances` now returns `alsoPaid`, `totalPaidAllJobs`, `settlementCount`. Build clean. **⚠️ Not yet device/E2E-tested with real Supabase data.** No schema changes.
- **v0.12.40 (Jun 14)** — Second double-HST fix + data repair. `PostJobSheet.jsx:38` was computing `liveTotal` (which pre-fills the payment amount input) using `job.total_amount` as the flat-rate base. After the first `recordPayment` run, `total_amount` becomes tax-inclusive — so re-opening PostJobSheet for a Partial job caused `liveTotal = (tax-inclusive total) + HST again`, recording payment at that inflated amount. Fix: use `flat_rate ?? subtotal` instead of `total_amount ?? flat_rate`. Added `scripts/repair-double-hst.mjs` — diagnoses and repairs corrupted payment records for a given client (`node scripts/repair-double-hst.mjs <clientId> [--apply]`). Used to fix Ann Rae's 3 affected jobs: Jun 5 and Jun 10 `total_amount` corrected in DB; Jun 12 payment corrected from $496.71 → $439.57 via Supabase SQL Editor.
- **v0.12.39 (Jun 13)** — Fix double-HST bug in `financialMath.js`. After `recordPayment` writes the tax-inclusive total to `total_amount`, the flat-rate subtotal fallback chain was reaching `src?.total_amount` as a last resort (when `flat_rate` is null in the DB), then applying HST again on the already-taxed value. Fix: removed `src?.total_amount` from the fallback; replaced with `src?.subtotal` (pre-tax base labor, always written correctly by `recordPayment`). Also corrected the stale comment claiming `total_amount` is never updated after completion.
- **v0.12.38 (Jun 13)** — Financial math audit (3 files, 3 bugs). Full audit traced every path that computes totals, payments, and balances across all surfaces. Invoices/receipts were already correct. Fixes: (1) Finance.jsx "Outstanding" stat now subtracts partial payments already collected — a $197.75 job with $75 already paid was showing $197.75 outstanding instead of $122.75. (2) `toDisplayJob()` in selectors.js now calls `computeJobTotal()` instead of reading stale `total_amount` from DB — `total_amount` is only written by `recordPayment`, so additional-cost edits post-completion weren't reflected on Calendar cards or FinanceDetailSheet. (3) Home "Collected This Week" now uses `computeJobTotal(j)` (HST-inclusive) for Paid jobs, consistent with the Partial branch which already used actual payment amounts (also HST-inclusive). Verified with build.
- **v0.12.37 (Jun 13)** — Invoice totals cohesion (two commits). (1) Removed amber (#FEF3C7) from "Total Owed All Jobs" row — now uses same cream (#EAE2D8) as Invoice Total, so both highlight rows speak the same language. Removed faint (#F5F1EC) background from Payments Received header. Normalized font sizes: Invoice Total 22→17px (PDF 18→14pt), Total All Jobs 22→18px (PDF 16→15pt), Outstanding Balance 16→15px (PDF 13→12pt). (2) "Outstanding Balance" row removed entirely when no payments exist on invoice — it was always shown, duplicating Invoice Total. Now only appears when there are partial payments: renamed to "Remaining" (unpaid portion, red) or "✓ Paid in Full" (green). Both `InvoiceView.jsx` and `api/_lib/invoicePdf.js` kept in sync on every change.
- **v0.12.36 (Jun 13)** — Invoice layout pass. "Also Outstanding for This Client" section added: 2px cream top border separates it from invoice totals, owing amounts red (#DC2626), combined total bar uses cream bg. Client street address now shown on its own line in "Issued To" block on both web and PDF.
- **v0.12.35 (Jun 12)** — Four bug fixes: (1) Settings save crash — `useBusiness()` returns `refresh` but was destructured as `refreshBusiness` (undefined), so every save threw `TypeError` after the DB write succeeded, masking success as error toast. (2) Client picker "No address" — `NewJobSheet` `Step1Who` passes raw Supabase rows which have no `.address`; fixed search filter + display line to build from `street/city/province/postal_code`. (3) Blank initials in recent-clients row — `c.first_name?.[0]` was empty when null; now falls back to last_name or '?'. (4) Client name tap → profile nav in `JobDetailSheet` ReadMode — dotted underline + pointer cursor; tap closes sheet and navigates to `/clients/:id`.
- **v0.12.34 (Jun 12)** — Schedule page P1+P2 polish pass (impeccable critique 23/40). Nav arrows expanded to 44px hit areas + aria-labels. TODAY button min-height 44px. Removed `window.confirm`/`alert` + `Swipeable` delete entirely — delete via job detail sheet only. Skeleton loading state replaces bare "Loading…". Conflict banner at week level (amber strip, tappable to filter). Date header "Today · Friday, Jun 6" → "Today, Jun 6". "HOURS NEEDED" badge → "LOG HOURS". Empty state CTA "Tap + to book a job". `fmtMoney()` guard on job.total. Owed row: bolder weight for priority. WeekStrip calendar: minHeight 44 + fontWeight 800→700.
- **v0.12.33 (Jun 12)** — Five queued fixes: (1) Remove Georgetown city default in NewClientSheet. (2) NewClientSheet false "Save failed" fix (synchronous `useRef` double-submit guard) + expanded create form to match EditClientSheet — status select, tags chips, full Intel section (prefs/access/comms/personal textareas written into `ai_context`). (3) Richer Home "Read Brief" — `generateCommandBrief` now includes service name, scheduled time range (Toronto tz), and drive time (from `locationDrives` state or `ai_context.drive_to` fallback). (4) Calendar (Schedule) page week-scoped default — Agenda now shows current week only (not all-upcoming); week range label in header ("JUN 8 – 14"); scope chip shows "Whole week" / "Tue Jun 10 ×" (tap × to clear day filter); empty-week state. Dark plum bg, solid pink active chip per DESIGN.md. (5) GCal event enrichment — fixed blank Location (was reading non-existent `clients.address`; now builds from `street/city/province/postal_code`); enriched description with Service/Client/Phone/Email/notes/footer (empty lines omitted).
- **v0.12.32 (Jun 12)** — Android performance + viewpoint-switch freeze fix. Root cause: `currentBusiness.js` never cached for admin users — every hook refresh (on any data change event) made 2 Supabase roundtrips (`auth.getUser()` + users table). With 6–8 hooks refreshing simultaneously, that's 12–16 concurrent DB calls per data event, causing the "bogs down" behavior on Android. Fix: added `cachedEffectiveId` — after first successful resolution, subsequent calls use `getSession()` (local/no-network) to verify the cached user then return immediately. Also added `resolutionPromise` so all hooks share one DB roundtrip on cold start instead of each firing independently. `setSuperOverride()` and `clearBusinessCache()` both invalidate the cache so viewpoint switches are still fresh. Also reduced geolocation timeout in `Home.jsx` from 8000ms → 5000ms + added `maximumAge: 90000` to allow cached GPS on Android (avoids 8-second hang). **⚠️ Not yet verified on device — Joel to confirm whether the Android bog-down and Sandra-view freeze are actually gone on the Pixel.** Deploy: Vercel native GitHub integration confirmed working — every push to `main` auto-deploys. Do NOT re-add `.github/workflows/deploy.yml`.
- **v0.12.31 (Jun 12)** — Three Sandra requests: (1) Per-job HST toggle — `jobs.tax_enabled` is now nullable; NULL = inherit from `business.tax_enabled`, true/false = explicit per-job override. Toggle appears in NewJobSheet Step 2, JobDetailSheet edit mode, and PostJobSheet completion screen (only when global HST is on). `computeJobFinancials` + `recordPayment` updated. **Manual Supabase migration required**: `ALTER TABLE jobs ALTER COLUMN tax_enabled DROP DEFAULT; UPDATE jobs SET tax_enabled = NULL;` (2) Removed all EST/est. labels from money values — Home.jsx × 3 + Finance.jsx "Est. Profit" → "Profit". (3) CSV export in Finance now live — was disabled "Coming Soon" button; generates Date/Client/Service/Pricing/Duration/Subtotal/HST/Total/Payment Method/Status/Sidekick/Sidekick Pay/Sidekick Paid. Client-side Blob download, no new API endpoint.
- **v0.12.30 (Jun 10)** — Calendar page: Week grid view hidden per Sandra's request (she uses Google Calendar directly). Agenda view is now the only visible view — opens directly on navigation, no toggle shown. `WeekView` + `LegendDot` renamed to `_*_PARKED` (not deleted) in `src/pages/Calendar.jsx`. Restore: rename back + uncomment `VIEWS` const + swipe handlers + view toggle UI + WeekView render line.
- **v0.12.29 (Jun 10)** — PWA crash root cause found and fixed. The circular import fix (v0.12.26) broke the `useData↔realtime` cycle but missed the REAL TDZ: `locationDrives` and `notifPermission` `useState` declarations in `Home.jsx` were physically placed AFTER the `useEffect` that listed them as dependencies. Minifier turned `locationDrives` into `Y`, evaluated the dep array before `let [Y,tt]=useState(…)` ran → `Cannot access 'Y' before initialization`. Fix: moved the three `useState` declarations above the effect. Deployed.
- **v0.12.28 (Jun 10)** — Finance page critique pass (21/40 score). Period toggle → dark plum bg (#2C2C2E) + solid pink active, matching DESIGN.md spec. Loading state → pulse skeleton (hero + 2×2 grid + chart + rows). Activity list cap removed (was slice(0,20)); count shown in section label. Both dead CTAs (VIEW ALL INVOICES, Download CSV) marked disabled + "Coming soon" — no more silent failures. Next critique target: Calendar.
- **v0.12.27 (Jun 10)** — Settings page critique pass (20→? score). Dark mode: all 4 card `background: white` → `T.card`, borders → `T.cardBorder`, inputStyle now uses T tokens. Added Address, City, Postal Code, and AI Signature inputs (were silently in form state/DB but had no UI). Replaced native checkbox with `ToggleSwitch` component for tax_enabled. Added `isDirty` state + unsaved-changes pill. Hero heading `'Config & Profile'` → `'Settings'`, dropped kicker. Added Sign Out button in Security section. Suppressed raw `bizError.message` leak. System SectionLabel placed correctly above its card. Build clean.
- **v0.12.26 (Jun 10)** — PWA crash fix (still unverified on device — see ⚠️ below). Broke circular import `useData.js` ↔ `realtime.js` that caused "cannot access Y before initialization" TDZ error in minified prod build (`Home-*.js:1:18766`). Extracted `notifyDataChanged` + `CHANGE_EVENT` into `src/data/events.js`; both files now import from there; `useData.js` re-exports for backward compat. Added `skipWaiting()` on SW install so new SW activates immediately without waiting for all tabs to close — this was why the old broken bundle kept serving despite deploys. Added SW activate listener to clear all caches + `clients.claim()`. Replaced PWA icons (192, 512, 180px) from `public/branding/supermom_app.jpg`. Vercel auto-deploys on every push to `main` via native GitHub integration — no `vercel --prod` needed.
- **v0.12.25 (Jun 9)** — Leave-time push notifications. Custom SW (`src/sw.js`, `injectManifest` mode) schedules `setTimeout` per job — fires "Leave now for Karen" 15 mins before calculated leave time. Home.jsx re-schedules whenever `todayJobs` or `locationDrives` updates. One-time permission banner in home scroll area. Tapping notification focuses app. No server needed — all local SW scheduling. `vite-plugin-pwa` switched from `generateSW` → `injectManifest`.
- **v0.12.24 (Jun 9)** — Function consolidation: `distance.js` + `geocode.js` → `api/maps.js` (route via `?type=`); `email-invoice.js` + `download-invoice.js` → `api/invoice.js` (route via GET/POST). Slot count: **9/12**. 3 slots free for push notifications + headroom.
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

- [x] **PWA / installable app** — crash resolved v0.12.29. Installable on Android + iOS.
- [x] **Push notifications** — ✅ done v0.12.25. Local SW scheduling, fires 15 mins before leave time. ⚠️ setTimeout-in-SW is unreliable on iOS (SW gets killed in background) — needs upgrade to proper Web Push (VAPID keys + server-triggered via `web-push` npm + 5-min Vercel cron). Works on Android today; iOS needs the upgrade. Parked.
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked in DB. No app login yet. When ready: link `workers.id` → `users` table + add Supabase Auth account.

> Vercel Hobby plan: **9 of 12** serverless functions used. 3 slots free. Functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `transcribe`, `admin/provision`.
> API cost: Distance Matrix hard-capped at 500 elements/day. $0 budget alert on billing. GCal free. Sandra's real usage ~15–30 elements/day.
> **Watchlist**: Monitor function slot count, Maps quota usage, and cron schedule drift each session. Don't rapid-redeploy (resets cron clock).

### PWA crash — resolved v0.12.29
Root cause was NOT the circular import (that was a red herring). The actual TDZ: `locationDrives` / `notifPermission` / `notifBannerDismissed` `useState` calls were placed after the `useEffect` that lists them as deps in `Home.jsx`. Minifier evaluated the dep array before the `let` bindings ran → TDZ crash. Fixed by moving the declarations above the effect. Deployed Jun 10.

### Next session priorities

#### Invoice remaining work (impeccable critique score: 24/40 — run Jun 13; layout further improved Jun 14 but critique items below still open)
1. **WCAG contrast on `#aaa` labels — P1, client-facing public document.** The `LABEL` constant (`color: '#aaa'`) used for "Issued to", "From", "Payment", "Also Outstanding", and the meta key labels "NO"/"DATE"/"DUE DATE" all fail WCAG AA (2.32:1 vs 4.5:1 required). Same failure in PDF (`LABEL_C = '#aaa'`). Fix: change `LABEL` constant `color` to `#6b7280` and `LABEL_C` in PDF to `#6b7280`. Also "Additional Cost" pink label (`#E91E6A`) at 9px on `#fafafa` = 4.13:1, fails — change to `#B01550` (`--pink-mid`).
2. **Flat-rate jobs show dead Rate/Hr + Hours columns — P1.** Table always renders all 5 columns; flat-rate rows show "—" in both Rate/Hr and Hours, implying missing data. Fix: conditionally hide those two columns (header + cells) when `!financials.isHourly`. Apply in both web table and PDF. `financials.isHourly` check already exists per cell — extend to column headers.
3. **Raw error message exposed to clients — P1.** Line 58: `Error: {error}` shows raw Supabase/network error strings to anyone with the invoice link. Fix: replace with friendly static message e.g. "This invoice couldn't be loaded. Please contact Sandra at [biz.phone]."
4. **"NO" label for invoice number** — P3 minor but worth fixing. "NO" reads as a command/negative to most North American clients. Change to "#" in both web and PDF.
5. **fontWeight 800 on "INVOICE"/"RECEIPT" heading** — Inter only loads 400–700; weight 800 → synthetic bold. Change to 700. (Line 270 in InvoiceView.jsx.)
6. Both files must stay in sync on every invoice change — `InvoiceView.jsx` (web) and `api/_lib/invoicePdf.js` (PDF).

#### Other open items
7. **⚠️ Device verification** — v0.12.32 Android perf fix (bog-down + Sandra-view freeze on Pixel) and all Jun 12 fixes not yet phone-tested.
8. **GCal sync for new jobs** — `triggerGCalSync` is fire-and-forget with no response checking so failures are completely silent. Most likely cause: Google OAuth app is in "Testing" mode → refresh tokens expire after 7 days. Sandra needs to reconnect (Settings → Google Calendar → CONNECT). If token is valid and sync still fails, add logging to surface what `api/sync/gcal.js` is returning.
9. **Home.jsx drive-time + background-resume bugs (diagnosed, not yet fixed)** — Two issues, two separate commits:
   - **Fix 1 (wrong leave time on first load):** Cold GPS loses the 5s timeout race → `catch` swallows it silently → stale DB `drive_to` value shown instead of real-time drive. Fix: increase GPS timeout to 12000ms in `fetchLocationDrives`; add `locationFetchAttempted` state (set in `finally`) so display shows "Calculating…" instead of stale time until first attempt resolves. Active-job card (lines 759-792) has no loading state at all — needs one too.
   - **Fix 2 (wonky after long absence):** No `visibilitychange` handler exists. After 30+ min backgrounded, Supabase auth token expires, realtime socket drops, `today` date is frozen at mount, clock interval is throttled. Fix: add `visibilitychange` handler — always `setNow(new Date())` on resume; `window.location.reload()` if away > 30 min OR date changed. Guard drive re-fetch behind a timing check (last fetch > 10 min) to protect Maps quota.
10. **Design system critique (in progress)** — Next target: **Client profile** → Job detail → `$impeccable document` to refresh DESIGN.md.
11. **AI chat interface** — `api/ai/[action].js` + `ANTHROPIC_API_KEY` already in place. Needs chat UI + convo state. HIGH PRIORITY.

### Features — Phase 2
- [ ] **AI chat interface** — `api/ai/[action].js` already exists. Need chat UI component + conversation state. `ANTHROPIC_API_KEY` is now set. HIGH PRIORITY.
- [ ] **Voice scheduling** — `api/transcribe.js` already exists. Flow: tap mic → transcribe → Claude parses intent → pre-fills booking sheet. HIGH PRIORITY.
- [ ] **Custom domain → swap email provider** — swap `nodemailer` for `resend`. `from` becomes `invoices@supermomforhire.com`. Ask Joel what Resend is before doing. ~5-min job once understood.
- [ ] **Self-serve client booking link** — no self-serve portal yet. Low priority.
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load. Better `Suspense` fallbacks needed.
- [ ] **Client engagement tools** — AI follow-up / re-booking reminders.
- [x] **Swipe to delete on job cards** — removed by design; delete via job detail sheet only (v0.12.34).
