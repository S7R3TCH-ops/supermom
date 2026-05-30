# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.

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
| Hosting | Vercel ([supermom-v2.vercel.app](https://supermom-v2.vercel.app)) |
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
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `flat_rate`, `total_amount`, `actual_duration`, `additional_costs_json`. |
| `payments` | One row per payment transaction. Source of truth for what's been collected. |
| `services` | Service catalog with `default_price`, `default_duration`, `pricing_type`. |
| `integrations` | OAuth tokens for external services (Google Calendar). |
| `storage.job-assets` | Private bucket for job photos and voice notes. |

### Critical data layer rules
- **Multi-tenancy**: Every query must include `.eq('business_id', businessId)`.
- **Soft deletes only**: Never hard-delete jobs or clients. Set `deleted_at = now()`.
- **Supabase migrations are NOT auto-applied** — run schema changes manually in the Supabase SQL Editor.
- **Supabase project ID**: `lskzzsjmmtsosfneuovt`

### Hourly job field conventions — READ THIS
- `flat_rate` stores the **$/hr rate** for Hourly jobs (not a flat fee). This is intentional — NewJobSheet writes it that way.
- `total_amount` stores the **booking-time estimate** and is **never updated after completion**. Do not read it as the actual total for a completed hourly job.
- To compute a completed hourly job's true total: `flat_rate × actual_duration + additional_cost + hst_amount`.
- `additional_costs_json` is the array of cost items. `additional_cost` is a backward-compat scalar sum.
- `toDisplayJob()` in `selectors.js` wraps the raw DB row — use `j.raw.fieldName` to access DB fields from display objects (e.g., in Home.jsx).
- `payments` table is the source of truth for amounts collected. `job.payment_status` is a denormalized cache.
- `computeJobTotal(job)` = subtotal + additional costs + HST. Use for collection math (what client owes).
- `computeJobSubtotal(job)` = subtotal + additional costs (no HST). Use for card/revenue display (Sandra's earnings).
- **Never trust caller-supplied `paymentStatus`** — `recordPayment` always re-derives from DB payments sum.

### RLS policy state (verified May 4, 2026)
- All tables RLS-enabled. Two SECURITY DEFINER helpers: `is_admin()` and `my_business_id()`.
- `businesses_modify` — `USING/WITH CHECK (is_admin() OR id = my_business_id())`
- `services_modify` — `USING/WITH CHECK (is_admin() OR business_id = my_business_id())`

---

## Key business rules

- Sandra books all jobs herself — no self-serve client portal yet
- Payment is cash or e-Transfer only — no Stripe
- Timezone is always `America/Toronto` — never system timezone

---

## Current version: 0.8.0

All core features are live. The app is in active use by Sandra.

### Recent changes (v0.8.0 — May 30, 2026) — code review security + accuracy pass
- **Security: XSS in invoice email** — `api/email-invoice.js` now escapes all user-supplied values (`clientName`, `bizName`, etc.) via `escapeHtml()` before HTML interpolation.
- **Security: phishing via Origin header** — `invoiceUrl` in `api/email-invoice.js` now uses `process.env.APP_BASE_URL` instead of `req.headers.origin`.
- **Security: multi-tenancy gaps** — `generateInvoiceForJob` job fetch + invoice update now scoped with `.eq('business_id', businessId)`. `job_templates` UPDATE and soft-delete in series edits, and AI-learning `services` UPDATE, all now scoped with `business_id`. `/preview` route moved inside Gate (requires auth).
- **Payment accuracy: stale job row** — `recordPayment` was calling `computeJobTotal` on the pre-completion DB row. Now builds a `liveJob` synthetic object with the incoming duration/status/costs before computing the Paid/Partial threshold.
- **Payment accuracy: swallowed error** — Payments SELECT error in `recordPayment` now thrown, not silently discarded.
- **Payment date timezone** — `payment_date` now uses `Intl.DateTimeFormat` with `America/Toronto` (was UTC midnight; evening payments got tomorrow's date).
- **Notes never rendered** — `JobCard` and `UpcomingCard` were reading `j.job_notes` but `toDisplayJob` maps to `j.notes`. Fixed field name in both cards.
- **Bi-weekly recurrence broken** — `NewJobSheet` was writing `recurrence_rule: 'Bi-weekly'` but `createRecurringSeries` checks for `'Biweekly'`. Fixed option id to match.
- **Null actual_duration = $0** — `computeJobFinancials` now falls back to `estimated_hours` when a Completed job has `actual_duration=null` (was collapsing to 0 hours/$0 labor).
- **Client revenue stats** — `selectors.js` `revenueYtd`, `upcoming[].amt`, `history[].amt` all switched from `total_amount` to `computeJobTotal(j)`.
- **e-Transfer fallback address** — Both `InvoiceView.jsx` and `api/email-invoice.js` now fall back to `sandra@supermom.com` (not the old interim Gmail).
- **Calendar timezone** — Added `torontoDecimalHour()` + `torontoDateKey()` helpers. All block positions (DayView/WeekView/gaps), `sameDay()`, `startOfWeek()`, `addDays()`, and AgendaView date grouping now use Toronto time, not system timezone.
- **Dead code removed** — `ThankYouDraftSheet` in `PostJobSheet` was permanently hidden (`showThankYou` never set to true). Import, state, and render removed.

### Recent changes (v0.7.5 — May 30, 2026)
- **Time display timezone fix** — `fmtTime12` / `fmtTimeRange` in `dateUtils.js` now extract hours/minutes via `Intl.DateTimeFormat` with `timeZone: 'America/Toronto'` instead of `d.getHours()`. Prevents hour shift on machines not set to Eastern time. Same fix applied to Calendar.jsx local `fmtTime`. `JobDetailSheet` edit form now strips seconds from `job.scheduled_time` on open (`slice(0,5)`) so `<input type="time">` always gets clean `HH:mm`.
- **Hourly rate preserved on job edit** — `saveEdit` in `JobDetailSheet` was writing `flat_rate: null` for Hourly jobs, wiping the $/hr rate from the DB. Now writes `flat_rate: Number(form.hourly_rate)`. `form.hourly_rate` is correctly initialized from `job.flat_rate` in `openEditMode`. Fixes inconsistent rate display in PostJobSheet, computeJobFinancials, and Needs Action cards after any edit.
- **Toast message accuracy** — PostJobSheet wrap-up toast now uses `ps` (the validated post-save status) instead of `payStatus` (user's raw toggle): "Job complete!" for Paid, "Payment saved — balance owing." for Partial, "Job updated." for no-payment wrap.

### Recent changes (v0.7.4 — May 29, 2026)
- **HST-inclusive payment clarity** — `liveHst` in PostJobSheet now recomputes dynamically from `liveSubtotal × taxRate` when `business.tax_enabled` (was frozen at booking-time value; broke hourly+HST duration adjustments). Header when HST > 0 now shows `liveTotal` (HST-inclusive) as the big number with breakdown below — previously showed subtotal prominently which was backwards.
- **"of $X total" context line fix** — Pre-payment context badge now shows `liveTotal` directly instead of the fluctuating `alreadyPaid + entered` value.
- **Needs Action HST label fix** — Replaced misleading `+HST` note (implied HST was additional) with `(incl. HST)` parenthetical — `computeJobTotal` amounts already include HST.
- **Partial→Paid auto-upgrade** — Three-part fix: (1) `recordPayment` SELECT now includes `job_status` so `computeJobFinancials` uses `actual_duration` (not `estimated_hours`) for completed hourly jobs — was the root cause of "partial stays partial even when fully paid"; (2) epsilon tolerance `paid >= total - 0.01` prevents float noise from blocking Paid status; (3) PostJobSheet `handleLogPayment` now upgrades `ps` from Partial→Paid when `alreadyPaid + paidAmt >= liveTotal - 0.01` (mirrors the existing downgrade check), so save button text and toast are correct.
- **Home hero: collected this week** — Small green `$X collected` line added below "Projected" in the hero, showing sum of payments received for all jobs scheduled this week. Hidden when zero. Respects privacy mode.

### Recent changes (v0.7.3 — May 29, 2026)
- **Payment accuracy (CS1)** — `recordPayment` in `jobsRepo.js` now always re-derives payment status from the DB payments sum; expanded job SELECT to include all fields needed by `computeJobTotal` (was missing `flat_rate`, `pricing_type`, `actual_duration` — would have marked every hourly job as `Paid` regardless of amount). Caller-supplied status is ignored.
- **PostJobSheet wrap-up fixes** — Pre-save downgrade: if user picks "Paid" but `alreadyPaid + entered < total`, silently saves as `Partial`. Reopening a Partial job now defaults the payment toggle to "paid" (collecting the balance), not "partial".
- **Job card visual states (CS2)** — Four-way color signal in `JobCard.jsx` and Needs Action inline cards: scheduled=pink, partial=orange (`#F97316`), unpaid=red (`#EF4444`), paid=green. Needs Action action button color follows same logic.
- **Subtotal on cards (CS3)** — `computeJobSubtotal()` added to `financialMath.js`. All Home card display contexts (hero revenue, Next Up, Coming Up Today, Rest of Week, Done This Week) show pre-tax subtotal. Needs Action `remaining` math keeps `computeJobTotal` — client owes the full HST-inclusive amount. Invoices unchanged.
- **Disappearing job fix** — `attentionItems` filter changed from `isPast && (needsWrap || needsPay)` to `(isPast && needsWrap) || needsPay`. Completed jobs needing payment now appear in Needs Action immediately, even if scheduled end time hasn't passed yet.
- **PostJobSheet header redesign** — Three display modes: (1) `alreadyPaid > 0` → shows "Balance Due" (remaining) + `$X total · $Y paid` context; (2) HST job → shows subtotal + `+$H HST = $T total`; (3) normal → "Live Total" unchanged. `liveSubtotal` and `liveHst` derived values added alongside `liveTotal`.
- **"+HST" indicator on cards** — `hstNote` prop added to `JobCard` and `UpcomingCard`. When `hst_amount > 0`, a small muted `+HST` label appears after the amount on all Home card sections. Not visible for Sandra's current jobs (all have `hst_amount = 0`) but plumbing is in place.

### Recent changes (v0.7.2 — May 28, 2026)
- **Invoice polish** — Logo 240px, flexbox-centred (works in PDF). Font system unified: Inter base, Fraunces (`.inv-display`) for business name, total, thank-you. Dead `useAppTheme` import removed.
- **Invoice table** — Date promoted to its own first column. Additional cost rows now show a pink `ADDITIONAL COST` label above the description. Table wrapped in `overflow-x: auto` div for mobile scroll.
- **Invoice line items clarity** — Hourly: subtext shows full equation (`$35.00/hr × 3.0 hrs = $105.00`). Flat rate: subtext says "Flat Rate". Columns: Date | Description | Rate/Hr | Hours | Amount.
- **Email invoice** — New `api/email-invoice.js` (nodemailer + Gmail SMTP). "✉ Email to Client" button in invoice toolbar. Sends branded pink HTML email with "View Invoice" button → `/i/:id` URL. Graceful mock mode if `GMAIL_USER`/`GMAIL_APP_PASSWORD` env vars not set (UI testable without real creds).
- **Logo split** — `public/branding/logo-banner.png` = app top bar (original 41KB file). `public/branding/logo-final.png` = invoice (492KB full logo). `LogoBar.jsx` and `PalettePreview.jsx` updated to use `logo-banner.png`.

### Sandra's business contact details (confirmed)
- Email: `sandra@supermom.com` ← **canonical for everything** (domain pending; placeholder until live)
  - Used on: invoices (FROM + e-Transfer), Google Calendar OAuth, Google Maps, Gmail SMTP
  - `supermomsforhire@gmail.com` was the interim address — superseded by above
  - When domain goes live: re-run the businesses SQL with new email, update `GMAIL_USER` env var
- Phone: `(416) 738-0309`
- Location: Georgetown, ON (home-based — no street address on invoices)
- HST #: `777616178 RT0001`

### Invoice architecture
- Public route: `/i/:id` — no auth required (shareable link)
- `src/pages/InvoiceView.jsx` — renders web view + PDF via `window.print()`
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`
- `api/email-invoice.js` — nodemailer/Gmail SMTP. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Logo files: `logo-banner.png` (app bar, 41KB) vs `logo-final.png` (invoice, 492KB) — never mix

### Recent changes (v0.7.1 — May 28, 2026)
- **Invoice overhaul** — Complete `InvoiceView.jsx` rewrite. Added: FROM block (business city/phone/email), HST # under business name, e-Transfer reference number, "Thank you for your business!" in Fraunces italic. Dates formatted as `May 27, 2026`. Logo fallback to `/branding/logo-final.png` when `businesses.logo_url` is null (removes fragile Supabase signed URL dependency for public links). `nodemailer` added to dependencies.

### Recent changes (v0.7.0 — May 19, 2026)
- **Home card refresh** — Unified card anatomy across all Home sections. Left-border colour = state signal: amber (`#F59E0B` border / `#FEF3C7` bg) for Needs Action, pink (`#E91E6A`) for Coming Up Today, green (`#86EFAC` border / `#F0FFF5` bg) for Done This Week, soft pink-pale for Rest of Week. Removed all monospace fonts throughout — time displays now use Inter (`T.font`). UpcomingCard blue palette (`#1565C0`) fully replaced with on-brand pink. Section label colours fixed (COMING UP TODAY no longer cobalt blue, Needs Action uses dark amber `#78350F`). All dynamic features preserved: PaymentBreakdown, privacy mode, rebook button, status badges, notes, address. Dark mode support improved in UpcomingCard (uses `T.pink` and mode-aware bg).

### Recent changes (v0.6.9 — May 19, 2026)
- **Calendar Directions buttons** — Day view `↗ Directions` span is now a real tappable element: stops event propagation (no longer opens job detail), opens Google Maps `/dir/` URL. Hidden when job has no client address. Agenda view gets an `↗ DIRECTIONS` button pushed to the right end of the badge row, same behavior.

### Recent changes (v0.6.8 — May 19, 2026)
- **Needs Action card — time display** — Now shows full start–end time range (e.g. `Mon, May 19 · 10:00 – 11:30 AM`) instead of start-only.
- **Needs Action card — payment display** — Replaced verbose math formula (`$35/hr × 3h + costs = $105`) with a compact pricing label (`HOURLY · $35/HR` or `FLAT RATE`) + clean amount block. No payment: `$65 owing`. Partial: `$105 total · $40 paid · $65 owing`.
- **Rest of Week cards — time display** — Collapsed separate AM/PM row into a single `fmtTimeRange` line (e.g. `10:00 – 11:30 AM`); font bumped to 13px for more prominence.
- **End time bug fix** — `decorateJob()` in `jobsRepo.js` now uses `actual_duration` (when recorded) instead of always `estimated_hours` to compute `duration_est`. This is the single source of truth for end times app-wide, so the fix propagates to: Home.jsx (all 4 useMemos), Calendar.jsx block widths, and the overlap conflict checker. `JobDetailSheet` read-only header had its own `calcEnd(scheduled_time, estimated_hours)` path — also fixed to prefer `actual_duration` for completed jobs.

### Recent changes (v0.6.7 — May 19, 2026)
- **Super Admin viewpoint fix** — Switch-to-business now survives `window.location.reload()`. `setSuperOverride()` in `currentBusiness.js` writes to `sessionStorage` (`superViewId`); `getCurrentBusinessId()` and module init both read from it. `ViewpointContext` lazy-inits `viewingAsId`/`viewingAsName` from sessionStorage; `switchTo()` writes name (`superViewName`); `reset()` clears both keys. Rule: module-level vars reset on every reload — always persist cross-reload state to sessionStorage.
- **Tight-gap transition warning** — Now suppressed once job B's start time has passed (`if (b.start <= now) continue` in `tightGap` loop). Warning only shows for future transitions.
- **Rest of Week cards — improved time display** — Date moved above the time range and is slightly more prominent. Start AND end time now shown on one line (`10:00–11:30`). AM/PM tag below. `endFmt` computed alongside `startFmt` in the map.
- **Rest of Week cards — job notes** — Job notes (2-line truncated, italic) now appear below the service name when present.
- **Next Up card — subtle Est. total** — Job total shown as `Est. $XX` below the timing badge, muted opacity, respects privacy mode.
- **Next Up card — Supermom Go button** — Directions CTA is now the full-width primary button. Shows the Supermom lightning bolt SVG inline + "SUPERMOM GO" text. On press: bolt animates right, text changes to "LAUNCHING…", gradient shifts pink→light-pink, then Google Maps opens after 650ms (`/dir/` API for turn-by-turn). START NOW demoted to secondary outline button below it. When no address on file, Supermom Go is absent and START NOW fills full width (solid).

### Recent changes (v0.6.6 — May 19, 2026)
- **Start/End time + Duration sync on Add/Edit Job** — Both NewJobSheet (Step 2) and JobDetailSheet (Edit mode) now show Start time, End time, and Duration controls that dynamically update each other. Start is always the anchor; changing End updates Duration (end − start); changing Duration updates End (start + duration). Minimum valid gap is 15 min.
  - `NewJobSheet.jsx`: Date separated into its own row; Time row is now a Start → End two-column grid; Duration stepper remains and stays in sync.
  - `JobDetailSheet.jsx`: Time field split into Start → End row; End time change writes back to `estimated_hours`; Est. hours field kept for direct numeric edit.
  - Helpers added to both files: `toHHMMStr(startHHMM, mins)` → HH:MM string for `<input type="time">`; `diffMinutes(startHHMM, endHHMM)` → minute diff or null.
- **Clients "Owes $" filter fix** — `toDisplayClient` in `selectors.js` now uses `computeJobTotal(j)` (correct hourly math) instead of `j.total_amount` (stale booking estimate), and treats `payment_status === null` as unpaid — so today's newly completed jobs now appear in the Owes $ filter.

### Recent changes (v0.6.5 — May 19, 2026)
- **Home page redesign** — Replaced dual-mode Home (week browser + daily dashboard) with always-today action dashboard.
  - Hero: always-on Command Brief (date + briefing message + today's projected revenue). WeekStrip removed entirely.
  - Body: Today (Active Job spotlight → Next Up → Coming Up Today) → Needs Action (carry-forward amber cards) → Rest of This Week (compact upcoming) → Done This Week (muted `subtle` JobCards).
  - `briefingMessages.js`: removed `isSelectedToday` guard; function always anchors to real today.
  - `Home.jsx`: stripped all week-nav state (`selectedDate`, `weekStart`, `weekDays`), added `restOfWeekJobs` derived list, removed `WeekStrip` import and unused handlers (`handleWeekChange`, `handleGoToToday`, `handleDeleteJob`).
  - `JobCard`: added `subtle` prop — transparent bg, thin border, 0.6 opacity for Done This Week section.

### Recent changes (v0.6.4 — May 18, 2026)
- **Finance page — clickable tiles + drill-down** — All 4 stat tiles (Revenue, Expenses, Outstanding, Profit) now open a `FinanceDetailSheet` with the jobs/expenses that make up that number, filtered to the selected period.
- **Finance page — period filtering** — Week/Month/Year/All selector now filters stat tiles, trend chart, and activity list together.
- **Finance page — real trend chart** — Placeholder bar chart replaced with SVG area/line chart (revenue vs expenses) bucketed by day/week/month based on selected period.
- **Finance page — correct hourly math** — All stat totals now use `computeJobFinancials()` instead of `total_amount` (fixes hourly jobs where rate × actual_duration ≠ booking estimate).
- **FinanceDetailSheet — profit type** — New `type='profit'` renders Income section (green) + Expenses section (red) with net summary in sheet header.
- **FinanceDetailSheet — expense rows** — Show `-$` amounts in red; category + notes + date.

### Recent changes (v0.6.3 — May 18, 2026)
- **Financial math unification** — `computeJobFinancials()` in `financialMath.js` is now the single source of truth for ALL financial calculations. `FinancialMathBreakdown`, `invoicesRepo`, `jobsRepo` (payment status), `InvoiceView`, and `Home.jsx` all import from it. No inline math anywhere.
- **Job cancellation** — Any user can cancel a Scheduled job with a required reason. Status → `Cancelled`, reason stored in `ai_context.cancellation_reason`. Cancelled jobs remain visible in Calendar (grey treatment) and Client profile history with reason shown.
- **Admin delete** — Admins (`profile.role === 'admin'`) see a "Delete Job (Admin)" option in JobDetailSheet (soft-delete, disappears from all views).
- **Admin archive client** — Admins see a collapsible "Admin Actions" danger zone at the bottom of ClientProfile. Two-tap confirmation archives client + all their jobs (soft-delete cascade).
- **Calendar dynamic timeline** — Day view `startH`/`endH` computed from actual jobs (1hr padding), not hardcoded 6AM–10PM. No job ever clipped off-screen.
- **Home Today pill** — Conditional "TODAY" button appears above WeekStrip when the user has scrolled to a non-current week. Snaps back to today on tap.
- **New repo functions**: `cancelJob(id, reason)` and `archiveClientJobs(clientId)` in `jobsRepo.js`.

### Recent changes (v0.6.2 — May 18, 2026)
- **Codebase refactor** — pure extraction, zero behavior changes. `Home.jsx` trimmed from 1285 → 769 lines.
  - `src/lib/dateUtils.js` — `sameDay`, `addDays`, `getWeekRange`, `fmtTime12`, `fmtTimeRange`, `dateBrief`, `composeTorontoISO`
  - `src/lib/financialMath.js` — `computeJobTotal()` / `computeJobFinancials()` single source of truth
  - `src/lib/briefingMessages.js` — `getBriefingMessage()` pure function
  - `src/components/cards/` — `JobCard`, `UpcomingCard`, `EmptyState`, `LiveTimer`, `MissionIntel`, `PaymentBreakdown`
  - `jobsRepo.js` re-exports `composeTorontoISO` from `dateUtils` for backward compat

---

## Critical rules — read before every build

- **Read `DESIGN.md` before writing any component** — all tokens, typography, component anatomy defined there
- **Mobile-first** — design for 390px iPhone viewport first
- **Keyboard aware** — use `useKeyboardFocus` hook to adjust padding in bottom sheets
- **Increment version** in `package.json` on every meaningful release
- **Test on both** Joel's Pixel 10 Pro (Android) and Sandra's iPhone

---

## Parked / not building yet

### Immediate (next session) — in priority order
- [ ] **Commit v0.8.0 code review fixes** — Joel testing on dev server first. ~20 files changed (security, payment accuracy, timezone, field names). All lint-clean.
- [ ] **Job edit time round-trip** — Joel checking manually on device. If time shifts after save, fix is in `JobDetailSheet` `saveEdit` / `composeTorontoISO`.
- [ ] **owedTotal balance for Partial jobs** — `selectors.js` shows full job total instead of remaining balance for Partial clients. Fix: join payments table in `clientsRepo.js` to get `amount_paid` per job, then subtract in `toDisplayClient`. No SQL migration needed — code only.
- [ ] **Gmail App Password** — waiting on `sandra@supermom.com` domain going live. When ready: App Password → `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `.env` + Vercel dashboard. Also add `APP_BASE_URL=https://supermom-v2.vercel.app` to Vercel env vars.
- [ ] **16 missing Vercel env vars** — only VITE_SUPABASE_ANON_KEY + VERCEL_OIDC_TOKEN pulled locally. Others likely Production-only on Vercel dashboard. Confirm nothing breaks as features are used.
- [ ] **Credential rotation** — DB password + GitHub token were in a public commit. Should be rotated.
- [x] **CS1–CS3 verification pass** — PASSED (May 30, 2026).
- [x] **Supabase businesses record** — populated (May 30, 2026).

### Laptop / dev environment
- [ ] WSL2 cleanup — `sudo umount /mnt/recovery` → `exit` → `wsl --unmount`
- [ ] GitHub repo rename: `supermom-v2` → `supermom` (cosmetic — affects Vercel project name + doc refs)
- [ ] Full Windows format + clean reinstall (deferred — everything critical is on GitHub/Vercel)

### Features — Phase 2
- [ ] **Custom domain → swap email provider** — when Sandra's domain is live, swap `nodemailer` for `resend` and verify domain. `from` becomes `invoices@[domain]`. 5-min job.
- [ ] **Sandra daily job briefing email** — Vercel Cron Job (daily 7am Toronto). Queries Supabase as service role, emails Sandra: today's + tomorrow's jobs with times/clients/estimates + any outstanding payments. Use Resend (free tier).
- [ ] Self-serve client booking link (Phase 2)
- [ ] Offline mode (crashes if Supabase unreachable on first load)
- [ ] Client engagement tools (AI follow-up / re-booking reminders)
