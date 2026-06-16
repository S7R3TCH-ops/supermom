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

## Current version: 0.12.74 — Jun 16, 2026 (package.json synced)

Sandra's business is live — data wiped and re-provisioned Jun 9. App in active use.

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

### Recent changes (full history in `docs/changelog/` + `git log`)
- **v0.12.74 (Jun 16)** — Admin "Revert to Scheduled" replaces "Mark as Unpaid": `markJobUnpaid` → `revertJobToPreCompletion` in `jobsRepo.js`. Now: hard-deletes all payments, voids + soft-deletes the job's invoice (or removes job from multi-job invoice and recalculates total), resets `job_status='Scheduled'` + nulls `actual_duration`, `completion_notes`, `subtotal`, `hst_amount`, `total_amount`. Button shows on any Completed job (was Paid/Partial only). Confirm text updated. JobDetailSheet import + all prop names updated accordingly.
- **v0.12.73 (Jun 16)** — Invoice payment rows redesigned: each payment now shows service name (dark, normal weight) + date · method (muted) + green amount (only dollar is green). `payment_method` added to payments select in `invoiceBalances.js`. Line items: service name no longer bold (only Amount column stays bold); flat rate jobs show "Flat rate" sub-label in description cell. All changes mirrored in `InvoiceView.jsx` + `api/_lib/invoicePdf.js`.
- **v0.12.72 (Jun 15)** — PostJobSheet invoice pre-flight: after saving, checks for other outstanding completed+unpaid/partial jobs for same client BEFORE showing the nudge screen. If found, shows a bundle step — unpaid context: "add to invoice?" (calls `addJobsToInvoice`); paid/partial context: "did this payment cover these?" (calls `settleInvoiceOutstanding`). Phase state machine: `'form' | 'checking' | 'bundle' | 'nudge'` replaces `done` boolean. New `fetchOutstandingJobsForClient` export in `jobsRepo.js`. InvoiceView "Add to invoice" panel unchanged (fallback for old invoices navigated directly).
- **v0.12.71 (Jun 15)** — PostJobSheet send nudge: after saving, sheet replaces form with centered success screen instead of auto-closing. Paid → "Receipt ready! Want to send the receipt to [client]?"; Partial → "Payment saved! Want to send the updated invoice?"; Unpaid/complete → "Invoice ready! Want to send the invoice?". "Send Receipt/Invoice" opens `/i/:id` in new tab then closes sheet. "Not now" closes. No invoiceId → "Done" button only. Removed redundant inline invoice-ready card from scroll body.
- **v0.12.70 (Jun 15)** — Invoice preview fixes: date fields get `white-space: nowrap` (meta grid + table td) to prevent 2-line wrap; PDF `cDate` width 72→88pt. Record Payment panel now gated on `invoiceSentAt || receiptSentAt` — no longer appears on fresh job-completion preview. Back button uses `window.close()` when page opened in new tab (always `_blank`), `navigate(-1)` otherwise. Admin page: removed redundant "← Reset to My Real View" pink button when viewing as another business (ribbon header already handles this).
- **v0.12.69 (Jun 15)** — Home owing section rewrite: flat per-job rows (was grouped by client). Collapse only fires at 3+ jobs. Collapsed header shows job count ("X jobs owing · $Y", not client count). Each row is a real button opening that specific job. Dead "+N more" badge removed. 1–2 owing jobs render flat with no accordion header.
- **v0.12.68 (Jun 15)** — Brand pink alignment: INVOICE heading on web preview (`InvoiceView.jsx`) + PDF builder (`api/_lib/invoicePdf.js`) changed from `#B01550` (dark crimson) → `#FC4693` (Sandra's actual brand pink). Finance.jsx invoice status badge upgraded from plain amber text → proper pill (`#FC4693`/`#FFEFF4` for non-Paid, green for Paid). Cancelled job pill darkened from medium gray `#6B7280` → charcoal `#374151` in JobDetailSheet + Finance STATUS_PILL (more contrast vs. Scheduled blue).
- **v0.12.67 (Jun 15)** ⚠️ NOT YET DEVICE-TESTED — **Crash fix**: Home page TDZ bug — `visibilitychange` useEffect referenced `todayJobs` in its dep array before `todayJobs` was declared (const useMemo at line 134 vs useEffect at line 80); production bundle renamed it to `L`, causing "Cannot access 'L' before initialization" on every Home render — crashed app for all users on desktop Chrome, likely all browsers. Fixed by moving the useEffect to after `todayJobs`'s useMemo. Multi-job invoice: owner sees "Add to this invoice" panel on `/i/:id` — checkboxes default-checked for all outstanding same-client jobs; "Add N jobs to invoice" calls `addJobsToInvoice()` which re-links each job from its old standalone invoice (voiding it if now empty), recalculates `invoice.total_amount` with business-aware tax. Invoice web preview + PDF loop all `invoice_jobs` as line items (Rate/Hr column shown if ANY linked job is hourly). `settleInvoiceOutstanding` uses `invoiceJobBalances[]` (not just `invoice_jobs[0]`). `decorateInvoiceWithBalances` aggregates across all linked jobs; exposes `invoiceJobBalances[]`. `invoice_sent_at`/`receipt_sent_at` stamped on ALL linked jobs on email send. DB migration `invoice_jobs_job_id_unique UNIQUE (job_id)` — **already run**.
- **v0.12.66 (Jun 15)** — Narrow selects: `fetchActiveJobs`+`fetchJobsByClientId` drop ~10 unused columns (review fields, reschedule history, legacy rates, timestamps) via `SELECT_LIST` (33/43 cols); `fetchClients` drops `phone2`, `referral_source`, `created_at`, `deleted_at`. Detail fetches (`fetchJobById`, `fetchClientById`) keep `*`. Closed open item #29.
- **v0.12.65 (Jun 15)** — Egress reduction: `realtime.js` debounces `notifyDataChanged` 500ms so N rapid job writes (e.g. `updateDailyRoutes` writing 3 jobs) trigger 1 refresh instead of 3; `updateDailyRoutes` in `maps.js` now accepts display jobs (already have `address`) — removes redundant `fetchClients()` call; both Home.jsx callers updated. Closed open item #3.
- **v0.12.64 (Jun 15)** — Home.jsx drive-time: GPS timeout 5s→12s; `visibilitychange` handler (refresh clock on resume, reload on day-change or >30 min away, re-fetch drives if stale >10 min); `lastFetchTimeRef` tracks last fetch. Per-route `ErrorBoundary` in App.jsx — one-page crash now isolated, BottomNav stays usable. Haptics on confirmed destructive actions: hard-delete job (`error`), mark-unpaid (`medium`), delete client (`error`), reset all data (`error`), archive worker (`medium`), delete skill type (`error`). Closed open items #2, #27, #34.
- **v0.12.63 (Jun 15)** — GCal sync error surfacing: `api/sync/gcal.js` detects `invalid_grant` and writes `sync_status='token_expired'` to `integrations` table; `api/auth/google/callback.js` resets `sync_status='ok'` on reconnect; `jobsRepo.triggerGCalSync` now awaits response and dispatches `gcal-token-expired` window event on failure; `GCalExpiredBanner` component added to `AuthedShell` (App.jsx) — amber banner with "Reconnect" CTA visible on all pages when token is expired; Settings GCal card shows amber warning + explanatory copy. Schema migration required: `ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'ok';` — run in Supabase SQL Editor. Root cause fix: publish OAuth app in Google Cloud Console (Testing → Production) so refresh tokens don't expire after 7 days.
- **v0.12.62 (Jun 15)** — DESIGN.md full regeneration from stable code (post-polish v0.12.52–61). Stitch-compliant YAML frontmatter: 28 color tokens (dual-theme light/dark), 9 typography roles, 5 radius steps, 6 spacing values, 10 component token entries. Markdown body: 6 spec sections (Overview, Colors, Typography, Elevation, Components, Do's and Don'ts) with named rules, badge table, and all current conventions (sentence-case rule, sm-input focus, two-tap confirm, 44px tap targets, no window.confirm). `.impeccable/design.json` sidecar written with 8-step tonal ramps, gradient vocabulary, shadow + motion tokens, 9 self-contained component HTML/CSS snippets, full narrative block.
- **v0.12.61 (Jun 15)** — NewClientSheet/JobDetailSheet/Admin/Login impeccable P1–P3 pass. NewClientSheet: outline:none removed (sm-input), close button 30→44px, all-caps labels → sentence case, raw error → friendly copy, VIP checkbox enlarged, recurrence #E91E6A → T.pink, Intel labels expanded (PREFS→Preferences, ACCESS→Access notes, etc.), keyboard spacer transition removed. JobDetailSheet re-pass (EditMode): ADD COST → sentence case, Flat/Hourly type="button" + T.pink, window.confirm → in-app two-tap for invoice-edit warning, client name div→button, cancel textarea outline removed. Admin: ToolRow div→button, window.confirm for delete/restore → in-app confirms, persona cards div role=button→button, console.error/warn removed, provisioning+password inputs get sm-input, labels sentence case. Login: sm-input on all inputs, EMAIL/PASSWORD → sentence case, border 1px→1.5px, password toggle 44×44px + aria-label, forgot button spacing, brand logo added.
- **v0.12.60 (Jun 15)** — Calendar + secondary sheets impeccable polish pass. Calendar: hero border always visible (was dark-mode-only), week range label sentence case, nav/today buttons typed, AgendaCard div → button with aria-label, filter chip + conflict banner div → button, parked week-view code removed (~130 lines). FinanceDetailSheet: JobRow div → button with aria-label; worker cost amount color. EditClientSheet: `outline:none` removed, `.sm-input` on all inputs/textareas/select, close button 44px tap target, all-caps labels → sentence case, VIP checkbox enlarged, delete zone dark-mode tint, keyboard spacer transition removed. PostJobSheet: same focus/tap/sentence-case pass + haptic feedback added on submit/success/error (`src/lib/haptics.js`). PrepNoteSheet: sentence case + `type="button"` on close. Bug fixes: removed Gemini's undefined `handleSupermomGo` reference + dead Go button code + corrupted duplicate EOF lines in Calendar.jsx; restored two critical WHY comments in PostJobSheet about `flat_rate`/`total_amount` double-HST risk.
- **v0.12.59 (Jun 15)** — Settings impeccable polish pass (P1–P3 + questions): `window.confirm()` on Reset All Data → in-app two-tap confirm with danger zone styling (red-tinted card, warning header, Cancel/Yes buttons); `outline: none` removed from all inputs — global `.sm-input:focus { border-color: var(--pink) }` class added to `index.css`; avatar `<div onClick>` → `<button type="button" aria-label="Change avatar photo">`; all-caps labels throughout → sentence case (Save settings, Sign out, Manage, Connect/Reconnect, Update password, Reset all data); ToggleBtn (password visibility) padded to 44×44px tap target; `type="button"` added to GCal + Team buttons; `✦` removed from "Preferences" section label (✦ is for AI-specific labels only); keyboard spacer height transition removed (no layout thrash); Save button moved to persistent footer outside scroll (always visible, disabled when clean, "No changes" when unmodified); Sign Out moved out of Security card to standalone section; AI Signature label → "Your personality in words" with clearer helper copy; isDirty banner simplified to "● Unsaved changes" (no longer redundant with persistent footer).
- **v0.12.58 (Jun 15)** — Finance hero + UX refinements: hero sub-label now shows "You cleared $X after expenses" (green/red) when expenses exist, alongside job count; Tax Ready section collapsed behind a toggle (▾ header) so Sandra's daily scroll ends at invoices, not the CSV block; `type="button"` added to CSV download button.
- **v0.12.57 (Jun 15)** — Finance impeccable polish pass (P1–P2): hero section upgraded with dynamic period label + large Fraunces revenue number + job count (was static "Revenue & Expenses" heading); `StatCard` div → `<button type="button">` with `aria-label` and `width:100%`; `TransactionRow` div → `<button>` when tappable with `aria-label`; "+ ADD EXPENSE" → sentence case "+ Add expense"; "VIEW ALL INVOICES · Coming soon" disabled placeholder removed (replaced with informational count line); worker costs amber text `#F59E0B` → `#92400E` (WCAG AA on white); trend chart card border 1px → 1.5px (consistent with stat cards).
- **v0.12.56 (Jun 15)** — Clients list impeccable polish pass (P1–P3 + design Q&A): P1: stat tiles converted from `<div onClick>` to `<button type="button">` with `aria-pressed`; search input focus ring restored (wrapper border turns pink, `outline:none` removed); `+` button removed from hero (redundant with global FAB which already prioritizes "New Client" on `/clients`). P2: dark mode stat tile label opacity 0.38 → 0.55 (WCAG AA); raw `error.message` → friendly copy; Lead "Book" button padding expanded to `6px 10px`. Design Q&A: "Outstanding" tile label → "Owes $" (normalized to match chip label); count badges added to all filter chips; clear ×  button on search input; empty state copy updated to reference FAB.
- **v0.12.55 (Jun 15)** — NewJobSheet impeccable polish pass (P1–P3): P1: `outline:none` removed from all inputs/textarea/select (WCAG focus rings restored); recent-client bubbles + client list rows + service cards converted from `<div onClick>` to `<button type="button">`; `bookErr` moved inside footer above buttons (was off-screen below footer). P2: step progress dots added (3-segment bar: done=green, active=pink, future=cardBorder) replacing text-only "Step 2 of 3"; date in Step 3 review formatted via `Intl.DateTimeFormat` (was raw ISO "2026-06-15"); close button 32×32 → 44×44px. P3: side-tab `borderLeft` on AI reason callout → background tint + full border; `transition: padding-bottom` removed (layout thrash); "+ NEW CLIENT" / "+ ADD ANOTHER COST" → sentence case; disabled button text `T.inkMuted` (was white-on-pale); stepper buttons get `aria-label`; `type="button"` on all buttons.
- **v0.12.54 (Jun 15)** — Home.jsx impeccable polish pass (P1–P3): P1: focus rings restored on Add Cost modal inputs (border-color indicator on wrapper, `outline:none` preserved on input); revenue widget `div` → `<button>` with `aria-label`; notification banner Enable + × buttons expanded to 44px tap targets with `aria-label`. P2: loading skeleton (3 placeholder cards while `allJobs` is null); Add Cost modal sheet handle added; owing rows get `›` SVG chevron affordance; `MissionIntel` label updated to DESIGN.md spec (✦ prefix, 9.5px, 1.1px spacing, `#FF78B0`). P3: keyboard spacer `max-height` animation removed (no layout thrash); owing `▶` char → inline SVG chevron; revenue amounts get thousands separator (`toLocaleString`); Next Up client name 26px → 22px allowing 2 lines; `type="button"` on active job action buttons; `COMING UP TODAY` → sentence case.
- **v0.12.53 (Jun 15)** — ClientProfile polish pass (P3 minor items): Book Job button uses `T.pink` token (was hardcoded `#E91E6A`); stat tile + date tile labels 8 → 9px; "Scheduled" badge on-system (pinkTint/pink); "See my future" → "AI insights ✦" with tooltip; AI field labels expanded ("Preferences", "Contact"); AI card collapses to friendly empty state when no context exists; view-mode hides empty field rows; null guards on contact fields (phone/email/address); `marginBottom: 14` on history section; `type="button"` on job row buttons; placeholder CSS for intel textareas.
- **v0.12.52 (Jun 15)** — ClientProfile P1/P2 a11y + UX pass (impeccable critique): back button now navigates to `/clients` (was `/`); back + edit icon-buttons expanded to 44×44px tap targets; `outline:none` removed from AI card textareas (focus ring restored); upcoming + history job rows converted from `<div onClick>` to `<button>`; dead "View all jobs" button removed; raw `error.message` replaced with friendly copy.
- **v0.12.51 (Jun 15)** — EditMode condensed prep brief strip: client name (Fraunces) + service · date shown in the "Editing Job" header bar for context while editing.
- **v0.12.50 (Jun 15)** — JobDetailSheet P1 fixes from impeccable critique: replaced `window.confirm()` for future-date Complete/Paid with in-app confirm UI (plain English, "Not yet"/"Yes, continue"); EditMode grouped into 4 named sections (Schedule & Service, Financials, Details, Team); `outline: none` removed from all form inputs (WCAG focus ring); close button tap target expanded to 44px via padding; `transition: padding-bottom` jank removed, replaced with conditional spacer; `aria-label` on close button and hidden file input.
- **v0.12.49 (Jun 14)** — Invoice polish (remaining impeccable items): INVOICE heading pink (`#B01550`) — first brand touch clients see; invoice number label `NO` → `#`; thank-you line `#777` → `#666` (WCAG AA); email button emoji removed; email failure state persists (no auto-reset); `← Back` button in toolbar; due date net-7 (was same-day as service).
- **v0.12.48 (Jun 14)** — Web preview synced to PDF: font switched from Inter+Fraunces → Helvetica Neue/Arial throughout; logo 150→140px; biz name 24→22px; INVOICE/RECEIPT heading 30→26px; payment amounts dark ink not grey; footer email plain text (no bold); thank-you 17→15px italic. PDF download: `Cache-Control: no-store` to prevent stale cached PDF.
- **v0.12.47 (Jun 14)** — Settlement section header: "Also Paid for This Client / ✓ Paid $X" → plain sentence "Remaining **$X** from this payment was also applied to:" (amount bold, no green check). Footer: "Payment Received / Paid in Full" block removed for receipts — was redundant with the ✓ Paid mark on Invoice Total row; payment instructions only show on unpaid invoices now.
- **v0.12.46 (Jun 14)** — Invoice WCAG/polish pass: `#aaa` label color → `#6b7280` (web + PDF, WCAG AA); "Additional Cost" pink → `#B01550`; flat-rate invoices no longer show dead Rate/Hr + Hours columns (hidden in both web table and PDF); raw Supabase error no longer exposed to clients — friendly message instead; INVOICE/RECEIPT heading `fontWeight 800` → `700`.
- **v0.12.45 (Jun 14)** — Settlement total moved to top of "Also Paid" block header; removed redundant cream bar; PDF totals row `alignItems: flex-end`.
- **v0.12.44 (Jun 14)** — PDF Payments Received column: `flex:1` → `width:160` to stay compact.
- **v0.12.43 (Jun 14)** — Payment list `maxWidth:210px` + `alignItems:flex-end`; "Invoice/Receipt Ready" banner labels; pre-push hook → hard block on src/api/scripts/package.json without CLAUDE.md.
- **v0.12.42 (Jun 14)** — Admin "Mark as Unpaid" in JobDetailSheet (two-tap confirm, deletes payments, resets `payment_status = ''`); receipt layout: payments left of totals column.
- **v0.12.41 (Jun 14)** — Settle-all-outstanding from invoice page; multi-job receipt with "Also Paid for This Client" section + settlement total.

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
> Vercel Hobby: **9 of 12** serverless functions. Functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `transcribe`, `admin/provision`.
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock).

### 🔴 Bugs / Active issues

1. **GCal sync — root cause: OAuth app in Testing mode** ⬅ DO THIS FIRST (Joel, not code)
   - Go to Google Cloud Console → APIs & Services → OAuth consent screen → Publishing status → **PUBLISH APP** (move Testing → Production). This stops the 7-day refresh-token expiry.
   - After publishing: Sandra reconnects once (Settings → Google Calendar → Reconnect) for a permanent token.
   - Code fix (v0.12.63): added `sync_status` column to `integrations` table; API detects `invalid_grant` and writes `token_expired`; `AuthedShell` shows amber banner on Home; Settings shows warning card. Token failures are no longer silent.
   - **Schema migration required**: `ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'ok';` — run in Supabase SQL Editor.

2. ~~**Home.jsx drive-time bugs**~~ — fixed in v0.12.64 (GPS timeout 12s, visibilitychange handler, lastFetchTimeRef guard).

3. ~~**Supabase egress spikes**~~ — fixed in v0.12.65. Debounced Realtime (N writes → 1 refresh); removed `fetchClients()` from `updateDailyRoutes`. `select *` on jobs/clients still exists (item #29) — safe to narrow incrementally.

### ⚠️ Infrastructure / housekeeping

4. **Device verification** — v0.12.32–v0.12.68 not phone-tested. v0.12.67 crash fix deployed but unverified on real devices. Test Home page + invoice flow on Pixel 10 Pro + Sandra's iPhone before next feature push.
5. **Vercel function slot** — 9/12 used. One feature away from the limit. Options: consolidate `transcribe` into `ai/[action]`, or upgrade to Pro.

### 🤖 AI features (HIGH PRIORITY)

6. **AI chat interface** — `api/ai/[action].js` + `ANTHROPIC_API_KEY` in place. Needs chat UI + conversation state.
7. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
8. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data is already available.
9. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
10. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
11. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

12. **Client invoice history** — "Invoices" tab in ClientProfile listing all invoices per client, each tappable to `/i/:id`.
13. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Offline mode** — app crashes if Supabase unreachable on first load. Per-page `ErrorBoundary` + "tap to reload" fallbacks needed.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### ✨ UX / product nice-to-haves

17. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.
18. **Cross-job search** — find "all jobs containing 'basement'" or "all October jobs". One search endpoint serves this.
19. **Swipe-to-complete on Home cards** — `Swipeable.jsx` already exists but isn't wired. Right-swipe → complete/pay shortcut.
20. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
21. **Mileage tracking** — drive time already calculated. Optional: log as CRA-rate deductible entry. One toggle in Settings.
22. **Revenue goal progress bar** — Sandra sets a monthly target in Settings; Home hero shows progress ring.
23. **Client lifetime value** — ClientProfile shows total paid. Add "avg per visit" + "top 5 by revenue" card to Finance.
24. **Year-over-year comparison** — Finance page: toggle "vs last year" for tax planning context.
25. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
26. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
27. ~~**Haptics on destructive actions**~~ — fixed in v0.12.64. Wired to: hard-delete job, mark-unpaid, delete client, reset data, archive worker, delete skill type.
28. **Dark mode audit pass** — some hardcoded colors survive from pre-impeccable code. One QA pass to catch stragglers.

### 🔧 Technical quality / refactor

29. ~~**Eliminate `select *` queries**~~ — fixed in v0.12.66. List fetches (jobs, clients) now use named column sets. Detail fetches still `*` intentionally.
30. **Consolidate AI + transcribe Vercel functions** — saves a slot; both functions are same auth/error pattern.
31. **React Query / TanStack migration** — `useData.js` does manual caching, stale-state, refetch-on-focus by hand. TanStack replaces that whole layer and gives background refresh for free.
32. **TypeScript — start with `selectors.js`** — `computeJobFinancials`, `toDisplayJob`, `computeJobTotal` are where subtle display-vs-DB bugs hide. Type just these and the repo files they call.
33. **Bundle audit** — `react-pdf` is the biggest dep. Verify it isn't bundled into frontend (it should only run in `api/`).
34. ~~**Per-page `ErrorBoundary`** wrappers~~ — fixed in v0.12.64. Each Route element now wrapped; crash isolates to one page, BottomNav stays usable.

### 🏢 Multi-tenant / future

35. **Per-business label config** — "Sidekick/Wingmom" are hardcoded in UI. Must be configurable before tenant #2 onboards.
36. **Super Admin viewpoint quick-switch** — dropdown to switch businesses without manual ID entry.
37. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.
