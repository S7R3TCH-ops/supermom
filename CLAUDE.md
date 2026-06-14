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
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`, `settleInvoiceOutstanding()`, `voidInvoiceSettlement()`
- `api/invoice.js` — GET `?id=<invoiceId>` → PDF download; POST → email send. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Filename: `LastName_Invoice_YYYY-NNN.pdf` or `LastName_Receipt_YYYY-NNN.pdf`.
- `api/_lib/invoicePdf.js` — react-pdf builder. Address blocks use single `<Text>` with `\n`-joined children — **intentional**; stacked `<Text>` elements each get their own font-metrics line-box.
- Logo files: `logo-banner.png` (app bar) vs `logo-final.png` (invoice, 492KB) — never mix.
- Settlement payments tagged `payments.invoice_id = <this invoice>` so `decorateInvoiceWithBalances` finds jobs paid via this invoice. Single-job `invoice_jobs[0]` assumption still intact.

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

## Current version: 0.12.47 — Jun 14, 2026

Sandra's business is live — data wiped and re-provisioned Jun 9. App in active use.

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

### Recent changes (full history in `docs/changelog/` + `git log`)
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

> Vercel Hobby: **9 of 12** serverless functions. Functions: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `transcribe`, `admin/provision`.
> Maps quota: Distance Matrix hard-capped at 500 elements/day. Sandra's real usage ~15–30/day. **Don't rapid-redeploy** (resets cron clock).

### Next session priorities

> `InvoiceView.jsx` and `api/_lib/invoicePdf.js` must always stay in sync on every invoice change.

1. **⚠️ Device verification** — v0.12.32 Android perf fix and all Jun 12 fixes not yet phone-tested.
2. **GCal sync failures silent** — `triggerGCalSync` is fire-and-forget. Likely cause: OAuth "Testing" mode → refresh tokens expire after 7 days. Sandra should reconnect (Settings → Google Calendar → CONNECT).
3. **Home.jsx drive-time + background-resume bugs (diagnosed, not fixed)**:
   - Fix 1 (wrong leave time): increase GPS timeout to 12000ms; add `locationFetchAttempted` state to show "Calculating…" until resolved.
   - Fix 2 (wonky after long absence): add `visibilitychange` handler — `setNow(new Date())` on resume; `reload()` if away > 30 min or date changed; guard drive re-fetch (last fetch > 10 min) to protect Maps quota.
4. **Design system critique** — Next target: Client profile → Job detail → `$impeccable document`.
5. **AI chat interface** — `api/ai/[action].js` + `ANTHROPIC_API_KEY` in place. Needs chat UI + convo state. HIGH PRIORITY.

### Phase 2 features
- [ ] **AI chat interface** — HIGH PRIORITY. API endpoint + key already set. Need chat UI + conversation state.
- [ ] **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills booking sheet.
- [ ] **Push notifications (iOS)** — SW setTimeout unreliable when backgrounded on iOS. Needs proper Web Push upgrade: VAPID keys + server-triggered via `web-push` npm + Vercel cron. Android works today.
- [ ] **Custom domain email** — swap `nodemailer` for `resend`, from `invoices@supermomforhire.com`.
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load. Better `Suspense` fallbacks needed.
- [ ] **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.
