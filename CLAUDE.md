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

## Current version: 0.6.5

All core features are live. The app is in active use by Sandra.

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

- [ ] Self-serve client booking link (Phase 2)
- [ ] Offline mode (crashes if Supabase unreachable on first load)
- [ ] Client engagement tools (AI follow-up / re-booking reminders)
- [ ] **Sandra daily job briefing email** — Vercel Cron Job (daily, e.g. 7am Toronto) queries Supabase as service role, emails Sandra her day: today's + tomorrow's jobs with times/clients/estimates, plus any past jobs with outstanding payments. Use Resend for transactional email (free tier sufficient). This is a Phase 2 in-app feature, not a remote agent — needs live DB access.
