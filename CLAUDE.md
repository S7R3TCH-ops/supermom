# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: Update this file immediately after any meaningful task. Remove stale entries. Keep it accurate.
> **Single source of truth**: CLAUDE.md is authoritative project state. Do NOT rely on memory files — they drift.
> **Drift check (every session)**: Run `git log --oneline -10` and verify recent changes are documented here.
> **Second-brain sync (every session, mandatory)**: This repo is tracked in `C:\Projects\second-brain\03-projects\active\supermom\`. Whether this session is running here directly (CLI or Antigravity) or was routed from second-brain, before ending the session update that project's `status.md` (current state) and `tasks.md` (next actions) to match what actually happened — same as if the session had been rooted in second-brain. Don't rely on this repo's own docs (this file, `HANDOFF_NEW_SESSION.md`) as the cross-session source of truth for planning/priorities; second-brain's `status.md`/`tasks.md` are. If you can't reach that folder from this session, say so explicitly instead of silently skipping the update.
> **Gemini handoff routing (standing rule, added 2026-07-15)**: When Joel says "execute the instructions/plan Gemini brainstormed" (or equivalent — no file path given), auto-look in `C:\Projects\second-brain\00-inbox\gemini\`, take the most recently modified `.md` file, read it, and execute — don't ask Joel for the path.
> **Gemini Phase-0 scoped access (2026-07-16)**: Gemini/Antigravity now has scoped access to this repo — read-most, write limited to `tests/` only, no git ops. Rules live in this repo's own `GEMINI.md`. Full reasoning: `second-brain/decisions.md` 2026-07-16.

---

## What we're building

A modular, agentic, mobile-first **Solopreneur Operations Platform** — deployed here as **Supermom for Hire**, the flagship bespoke instance for Sandra's solo personal-life-operations business in Georgetown, ON (organizing, caregiving, decluttering, errands).

**Platform Architecture & Managed Service**:
- **Core Engine**: Generic, multi-tenant agentic OS for 1-person businesses. Highly customizable — features can be toggled, stripped, or augmented per solopreneur niche.
- **Flagship Tenant**: Sandra (Supermom) is Client #1 and live proof-of-concept.
- **Target Persona**: Non-technical solopreneurs (often ADHD/overwhelmed by corporate SaaS) who need simple, zero-friction automation delivered via a trusted implementation partner (Joel).

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
| `job_workers` | Per-job worker assignment (replaces `jobs.worker_id`/`worker_pay`/`worker_paid`). One row per worker on a job — `pay`, `paid`, `paid_at`, nullable `payout_id` FK to `worker_payouts`. Supports multiple workers per job. Migration run 2026-07-22. |
| `worker_payouts` | One row per disbursement event to a Sidekick/Wingmom — `amount`, `payout_date`, `method`, `notes`. Can settle multiple `job_workers` rows at once (bundled payout). Migration run 2026-07-22. |
| `integrations` | OAuth tokens (Google Calendar). |
| `error_logs` | Client + server error capture (source, severity, message, stack, context). Append-only, admin-viewable in Admin page. Migration run 2026-07-15. |
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
- **Money-column single writer**: `subtotal`/`hst_amount`/`total_amount` are only written from `buildFinancialPatch()` in `src/lib/jobDraftPolicy.js`. Any new job write path must use it. `updateJob` backstop re-derives `payment_status` via `rederivePaymentStatus()` whenever a money field changes without `payment_status` in the patch.
- `jobs.tax_enabled` is nullable: NULL = inherit from `business.tax_enabled`, true/false = explicit per-job override.

### Worker pay data model — READ THIS (added 2026-07-22)
- `jobs.worker_id`/`worker_pay`/`worker_paid` are **dead columns** — code no longer reads or writes them. Worker assignment/pay/paid now lives in `job_workers` (see schema table above). Columns intentionally left in place in the DB, not dropped yet.
- `src/data/jobWorkersRepo.js` is the repo layer: `fetchJobWorkers`, `fetchJobWorkersForJobs` (batch), `setJobWorkers` (replace-set, preserves `paid_at`/`payout_id` when a worker's paid state hasn't changed), `markJobWorkerPaid`, `createWorkerPayout` (bundled-payout plumbing, no UI wired to it yet).
- `src/data/jobsRepo.js`'s `decorateJob` attaches a `workers[]` array to every job row, plus derived convenience fields from `workers[0]` (`worker_id`, `worker_name`, `worker_pay`, `worker_paid`, `assignee_type`) — the UI still only assigns one worker per job, so these singular fields keep every existing screen (JobDetailSheet, PostJobSheet, JobCard, FinancialMathBreakdown) working unchanged.
- **Deliberately avoids PostgREST nested-embed selects** (e.g. `job_workers(worker_id, workers(name))`) on `job_workers.worker_id` — it's a brand-new FK and this codebase already avoids embedding fresh FKs elsewhere (`workersRepo.js`'s `fetchWorkersWithSkills`) since PostgREST's schema cache isn't guaranteed to have picked it up. Batch-fetch + merge in JS instead.
- `computeJobFinancials`'s `workerCost` now sums `pay` across a `job.workers[]` array (was a single `worker_pay` scalar) — still informational only, never added to the client-facing total. `Finance.jsx`'s `workerCostItems` flatMaps over each job's `workers[]`, one line item per worker, preserving the existing accrual semantics (`profit = revenue − expenses − workerCosts`, summed regardless of `paid` status).
- Migration `supabase/migrations/20260722010406_add_worker_pay_model.sql` was run in Supabase SQL Editor 2026-07-22, before the v0.13.29 push — confirmed clean (0 jobs had `worker_id` set in prod at the time, so 0 backfill rows).

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
- **Email**: `sandra@supermomforhire.com` is an alias on the real account `admin@supermomforhire.com` — app-facing/invoice-facing identity is `sandra@`, but GCal OAuth and anything requiring a real (non-alias) Google account is backed by `admin@`. Business calendar lives on `admin@`'s Google Calendar, shared out to Sandra's personal Gmail for toggle-on/off visibility.
- **Phone**: `(416) 738-0309`
- **Location**: Georgetown, ON (home-based — no street address on invoices)
- **HST #**: `777616178 RT0001`

### Invoice architecture
- Public route: `/i/:id` — no auth required (shareable link)
- `src/pages/InvoiceView.jsx` — web preview. "Download PDF" → `GET /api/invoice?id=`. "Print" → `window.print()`.
- `src/data/invoicesRepo.js` — `generateInvoiceForJob(jobId)`, `fetchInvoiceById(id)`, `fetchInvoices()`, `settleInvoiceOutstanding()`, `voidInvoiceSettlement()`, `addJobsToInvoice()`
- `api/invoice.js` — GET `?id=<invoiceId>` → PDF download; POST → email send. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Filename: `LastName_Invoice_YYYY-NNN.pdf` or `LastName_Receipt_YYYY-NNN.pdf`.
- `api/_lib/invoicePdf.js` — react-pdf builder. Address blocks use single `<Text>` with `\n`-joined children — **intentional**; stacked `<Text>` elements each get their own font-metrics line-box.
- Logo files: `logo-banner.png` (app bar) vs `logo-final-white-bg.png` (invoice/email, 492KB, white background) — never mix. `logo-final-tansparent.png` is a separate transparent-bg export, cut for a realtor of Sandra's to use on her own website — not used anywhere in-app.
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

## Current version: 0.13.52 — Sep 1, 2026 (pushed/live)

App is live, Sandra using it daily. Full version-by-version changelog (v0.12.86 through v0.13.39) lives in `docs/archive/CHANGELOG-v0.13-archive.md` — this section only tracks what's currently open.

- **v0.13.52** (Sep 1) — two real JobDetailSheet layout bugs, both DOM-verified live via Playwright (not guessed from screenshots), reported by Joel. **(1) Header pills invisible**: the header's `overflow:'hidden'` (meant only to clip a decorative glow circle) zeroes out a flex item's automatic minimum size per the flexbox spec — so whenever total sheet content exceeded the modal's `maxHeight` cap, flexbox was free to squeeze the header itself below its own content height instead of only the scrollable middle. Measured it directly: header's box ended ~38px before its own pills row did, clipping the Completed/Paid/Partial status pills and the "Invoice/Receipt · View" pill invisibly off-screen — this is what Joel saw as "pills cut off, pink line, then body begins." Fix: `flexShrink: 0` on the header (and defensively the footer) in `JobDetailSheet.jsx` — only the scrollable middle ever gives up space now. **(2) Black dead-space under Edit Job on short-content jobs**: `JobDetailSheet`'s two vertical scroll regions used `className="sm-scroll"` — a class whose `::after` pseudo-element reserves a hardcoded 100px block, purpose-built so page-level lists (Home, Clients, Calendar, etc.) clear the floating `+New Job` FAB and bottom nav. JobDetailSheet is a modal with its own pinned footer and no FAB to clear, so that 100px rendered as unconditional dead space at the end of every job's content — invisible on long-content jobs (scrolled past it) but a visible black gap on short ones (confirmed via a real screenshot Joel sent, dark mode, gap matched the sheet's own near-black background exactly — ruling out a backdrop-exposure theory first, per the advisor's flex `justifyContent:'flex-end'` math showing that mechanism couldn't produce a gap below the sheet). Fix: new `.sm-scroll-sheet` CSS class (`index.css`) — same scrollbar-hiding/momentum-scroll behavior, no FAB-clearance `::after` — swapped in for both of `JobDetailSheet`'s vertical scroll regions. Left the horizontal photo-thumbnail scroller in `MediaCard` on plain `.sm-scroll` untouched — its `::after` block sits inside a flex row with no width, effectively a no-op there, and it isn't the reported bug. Also added the live `--app-height` CSS var value to the existing `?vpdebug=1` diagnostic overlay (`vpDebugOverlay.js`) for future viewport-class bugs. **Not yet on-device confirmed** — verified via Playwright at both a generic mobile viewport and Joel's actual Pixel 10 Pro resolution, but per this project's own repeated lesson (5+ prior blind-push misses on this bug class, see v0.13.44 note), needs his real-device eyes before calling it fully closed. **(3) Invoice/Receipt affordance**: once visible again, Joel asked for it to read as clearly clickable, not just a small pill easy to miss. Replaced the tiny inline pill with a full-width pink CTA button (🧾 leading icon, `T.pinkGlow` shadow lift, trailing `›` chevron) on its own row directly under the status pills — matches the weight of the footer's Mark Paid/Edit Job buttons instead of blending into the small pastel status pills next to it. **Related, NOT fixed this pass**: 7+ other modal sheets (`EditClientSheet`, `NewClientSheet`, `NewJobSheet`, `PostJobSheet`, `ServiceCatalogSheet`, `AiChatSheet`, `PrepNoteSheet`, `WorkerCatalogSheet`, `FinanceDetailSheet`, `NewExpenseSheet`) still use the FAB-clearance `.sm-scroll` class for their own modal scroll regions and likely carry the same 100px dead-space tail on short content — flagged for a follow-up pass, out of scope for what was reported here. Build clean, Vitest 117/117.
- **v0.13.51** (Aug 31) — Schedule page "happening now" color bug, reported by Joel via a Drive voice note + screenshot. A job actually in progress on the Schedule/Agenda view (`Calendar.jsx`) fell back to the plain blue "Scheduled" badge — visually identical to any future job — because `AgendaCard` only distinguished `isNext` (the next chronologically upcoming job) from everything else; there was no "currently happening" state at all. Also, the existing "Next up" badge had stolen Home.jsx's bright `T.pink` (`#FC4693`), which Home reserves specifically for its "Happening now" hero card — so even if a "now" state existed, it'd have collided with "Next up"'s color. Fix: added a new `isNow` check (`job.status === 'Scheduled' && job.start <= NOW() && NOW() < job.end`) computed per-job in the Agenda list, passed into `AgendaCard`. Badge/border/bg priority is now Cancelled → Happening now (`T.pink`, matches Home) → Next up (new `DEEP_ROSE` `#B5004E` constant, matching Home's own "Next up" section-label color) → Paid/Partial/Unpaid → plain Scheduled (blue). Build clean. **Not yet phone-tested** — pushed at Joel's go-ahead immediately after the fix, before an on-device check.
- **v0.13.50** (Aug 26) — client credit visibility gaps, found by Joel testing v0.13.49 live on prod. (1) **Home job card had no overpaid indicator** — the source job that generated the credit looked identical to any other paid job. `useJobs()` in `useData.js` now batch-fetches `client_credits` rows (`kind='issued'`) alongside payments in the same `Promise.all` (mirrors the existing `paymentsByJobId` pattern, one query for the whole business, no N+1), builds a `creditsByJobId` map, and threads it through `toDisplayJob()` (`selectors.ts`, new 4th param `creditsByJobId`, new `DisplayJob.issued_credit` field) so `JobCard.jsx` can render a small pink "✦ Overpaid — $X.XX credited" badge under the worker row whenever `issued_credit > 0`. (2) **ClientProfile's existing credit tile caption reworded** — Joel wanted it to read as usable *or returnable*, not just "applies to next job" (confirmed via AskUserQuestion this was a wording-only ask, not a new refund feature — no refund/return action exists, this is language only). Caption now: "✦ Account credit — use on next job or return it". Note: the credit tile itself (`ClientProfile.jsx:293-309`) already existed from v0.13.49 and only shows while `creditBalance > 0` — it disappears once the credit auto-applies to a booked job, which is likely why Joel didn't see it clearly mid-test (balance was already zeroed by his own booking flow, not a bug).
- **v0.13.49** (Aug 26) — client account credit. Sandra was getting overpaid on some jobs (e-Transfer/cash) and manually noting it on the job instead of tracking it — built a real feature instead. Behavior: any payment over a job's total auto-credits the client's account (no prompt); a "Mark as tip instead" control on the source job lets her reclassify if it really was a tip; the credit auto-applies to the client's *next* job, silently reducing the balance she sees before she even taps anything; shows on the job, ClientProfile, and receipt/invoice. Design doc: `C:\Users\Joel\.claude\plans\soft-soaring-sundae.md`. Key implementation choice: credit-application is modeled as a normal `payments` row with `payment_method: 'Credit'` — every existing balance/paid-status readout (`FinancialMathBreakdown`, `InvoiceView.jsx`/`invoicePdf.ts`, `invoiceBalances.ts`, Finance/Home/Calendar) already sums `payments` regardless of method, so those needed zero changes. New `client_credits` ledger table (issued/applied/reclassified_to_tip, balance = SUM(amount)) tracks *why*, separate from the cash-collected `payments` table. New `src/data/creditsRepo.js`; `recordPayment()` in `jobsRepo.js` is the single choke point that auto-applies/auto-issues. **Migration `supabase/migrations/20260826010000_add_client_credits.sql` already run in Supabase SQL Editor** (Joel ran it 2026-08-26). Also fixed a pre-existing stale UI string caught during QA: `PostJobSheet.jsx`'s overpay note said "recorded as a tip" (leftover from the old untracked-tip behavior) — now says "credited to their account automatically".
  **QA status**: verified end-to-end via QA account (Bright Path Concierge test business, `vercel dev` port 3000) pre-push — overpay auto-issued exactly one `client_credits` row (confirmed via direct DB query), ClientProfile showed the "$20.00 Account credit" tile + credit-history entry, receipt/invoice correctly showed the e-Transfer payment line **and** the new "$20.00 account credit remaining" footer note. **NOT dev-verified before push**: the "Mark as tip instead" reclassify control on the source job's JobDetailSheet, and the actual auto-apply-to-next-job flow (booking a 2nd job for the same client and confirming the $20 credit silently reduces the balance in PostJobSheet + gets consumed correctly). Joel is testing these live on prod instead of local dev (`joel+test@gmail.com` account — **not** the `jlundie+supermom-qa@gmail.com` account memory had on file, flag if that's wrong). `npm test` (117/117) + `npm run build` green immediately before push. Pushed at Joel's explicit go-ahead. **Watch for**: any live report from this account that the reclassify-to-tip control or the next-job auto-apply doesn't behave as designed — those two paths are unverified.
- **v0.13.48** (Aug 17) — 2 more fixes from live Sandra reports, built by Gemini, reviewed and shipped by Claude same day as v0.13.47. **Keyboard still covering JobDetailSheet's notes field** even after v0.13.46/47's shell-height fix: since the shell now deliberately stays at full `window.innerHeight` (Strategy A), `useKeyboardFocus.js`'s `el.scrollIntoView({block:'nearest'})` sees the focused field as already "on-screen" and no-ops — the browser has no notion the keyboard overlay is visually covering it. Changed to `block:'center'`, which forces the field into the safe upper half regardless of what the browser thinks is already visible. **Dead-space underfill on short lists**: `Clients.jsx` (≤3 clients) and `Home.jsx` (≤3 agenda items, no attention items) now render a small centered `✦ End of roster ✦` / `✦ All caught up ✦` marker instead of leaving a floating list over empty space. Neither fix touches F1/F2/F3's viewport-inset work — orthogonal, sits cleanly on top of v0.13.47. **Not yet device-confirmed** — same as v0.13.47, needs Section 0/3 on-device pass.
- **v0.13.47** (Aug 17) — **F1 fixed**: `useKeyboardFocus.js`'s frozen `fullHeight` baseline (`const fullHeight = vv.height` captured once at mount, never updated) latched `isFocused` wrong for the rest of a component's lifetime after any legitimate non-keyboard resize (rotation, nav-bar show/hide) — meaning Save/Mark Paid footer buttons (hidden behind `{!isKeyboardFocused && ...}` in NewExpenseSheet.jsx:192, NewJobSheet.jsx:435, JobDetailSheet.jsx:1098) could vanish with no keyboard actually open. Replaced with the same stateless `window.innerHeight - vv.height > 150` signal `appHeight.js`'s `resolveViewportHeight()` already uses, extracted as a local pure `isKeyboardOpen(win)` export (not yet shared with `appHeight.js` — that consolidation is F2, a separate reviewed change). 4 new unit tests (`useKeyboardFocus.test.js`), Vitest 117/117, build clean. From the 2026-08-16 Opus mobile-viewport audit (`second-brain/03-projects/active/supermom/plan.md`) — F2 (shared `getKeyboardInset`), F3 (spacer constants use the measured inset instead of 80/140/260px guesses), F4 (`interactive-widget=resizes-visual` viewport meta) remain deliberately unshipped this session; F2 needs a fresh change-auditor pass, F4 ships alone after this version gets a device confirm. Also added a build-stamp to the `?vpdebug=1` diagnostic overlay (`vpDebugOverlay.js` now prints `__COMMIT_SHA__`, a Vite `define` sourced from `VERCEL_GIT_COMMIT_SHA`) and made the overlay persist into standalone via a `localStorage` flag set on first `?vpdebug=1` visit — the manifest's `start_url: '/'` was dropping the query param on Add-to-Home-Screen launches, so there was previously no way to confirm which build an installed PWA was actually running. Full diagnostic sweep (safe-area-inset-left/right absent, App.jsx `:450` loading shell has no top inset, `theme-color`/`background_color` mismatch light vs dark `--bg`, 11 sheets' undocumented `--app-height` multipliers, spacer-constant inventory, `#root { overflow: hidden }` with no document scroll) — all confirmed by direct code inspection, logged as report-only per the plan, none fixed. Section 3 (100dvh vs `--app-height` on real hardware) needs Joel/Sandra's actual devices — can't be executed from this session. **Pushed and LIVE** (`5a9a4fc`), Joel's explicit go-ahead. Still needs the Section 0/3 on-device pass — nothing in this entry is device-confirmed yet.
- **v0.13.46** (Aug 16) — **real root cause found for the dead-space/black-bar bug, this time the actual structural one** (v0.13.45's spacer-div fix was correct but incomplete — it patched content overflow in 2 components while the real bug was one level up). Joel sent a fresh screen recording (Android, `Admin Business settings.mp4`) taken AFTER v0.13.45 shipped, showing the color fix held (black, not white/pink) but a large dead-space void was still there — worse than before, "whole screen unusable" in one case, plus a Home-screen screenshot showing the same void in pink (light-mode equivalent). Diagnosed live (dev server + Playwright, frame-extracted the video with ffmpeg to confirm the exact repro path instead of guessing from the description) then verified with an independent second read from Gemini (`00-inbox/for-gemini/2026-08-16-keyboard-viewport-bug-findings.md` → `00-inbox/gemini/2026-08-16-supermom-keyboard-fix-assessment.md`, full agreement on root cause and fix approach). **Root cause**: `src/lib/appHeight.js`'s `resolveViewportHeight()` keyed `--app-height` straight to `visualViewport.height`, including on keyboard-open events. On Android Chrome / iOS Safari's default `resizes-visual` behavior, opening the keyboard shrinks only `visualViewport.height` — `window.innerHeight` (the real layout viewport) stays full-size. Since `App.jsx`'s whole shell (page content + BottomNav together) sizes off `--app-height`, the entire app canvas shrank to fit above the keyboard, dragging BottomNav up with it, while the real browser window stayed full height underneath — the gap was raw `html`/`body` background showing through (pink in light mode, black in dark mode). This is the actual mechanism behind the whole v0.13.23–27 white-bar saga's keyboard-adjacent cases, not something the spacer-div pattern could ever fix. **Fix**: `resolveViewportHeight()` now ignores `visualViewport` when `window.innerHeight - visualViewport.height > 150` (keyboard-sized delta, ~250-300px) — falls back to `innerHeight` so the shell stays full height and BottomNav gets covered by the keyboard like standard mobile web, instead of exposing background void. 150px threshold keeps tracking legit small deltas this function was built for (safe-area/notch <100px, iOS toolbar collapse ~50-100px, rotation ~0px delta since both dimensions move together). Verified live: same fake-`visualViewport`-shrink repro that reproduced the bug (`innerHeight` held at 915 while `visualViewport` faked to 624) now shows `--app-height` staying at 915px, footer/BottomNav positions identical to the no-keyboard baseline. 2 new unit tests added (`appHeight.test.js`) covering the keyboard-delta and small-delta cases. Build clean, Vitest 113/113. **Still needs Sandra/Joel's real-device confirm before this closes for good** — same caveat as every prior attempt in this saga, nothing beats an actual device.
- **v0.13.45** (Aug 15) — **real root cause found and mechanically verified** for the dead-space-under-keyboard bug (v0.13.44's canvas-color fix was correct but incomplete — this closes the geometry half). Joel sent a screen recording of Admin → Business Settings on his Android phone showing the dead space was now black (color fix worked) but still there (geometry bug, unfixed). Diagnosed this time with a live Playwright browser against the real dev server instead of guessing from screenshots: `Settings.jsx` and `Home.jsx` both had `<div style={{height: isKeyboardFocused ? 260/80 : 0}}/>` keyboard-safety spacers placed **after** their scrollable content region (`Settings.jsx` line ~736, `Home.jsx` line ~1302) — siblings in the fixed page layout, not inside the scrollable area. When the keyboard opens the spacer correctly grows, but since nothing above it is scrollable to absorb that space, it just eats fixed layout height, pushing the footer/content up and leaving dead space between it and the bottom nav. This is the same component Admin → Business Settings routes into, so it's also the "Admin business settings is horrendous" report. Fix: moved both spacers to be the last child *inside* their scroll container instead of a sibling after it — `EditClientSheet.jsx`/`NewClientSheet.jsx`/`JobDetailSheet.jsx` already had this right (checked all `useKeyboardFocus` call sites), only these two were wrong. Verified numerically with Playwright: simulated keyboard-open (viewport 844→494) measured a 210px gap between the Settings footer and bottom nav before the fix, 8px (normal) after. Build clean, Vitest 111/111. Pushed at Joel's go-ahead — this one has actual reproduction evidence behind it, unlike the prior 5 attempts, but still get a real iPhone/Android confirm since nothing beats an actual device.
- **v0.13.44** (Aug 15) — v0.13.43's NewClientSheet-only keyboard fix didn't actually cover Sandra's real report (JobDetailSheet's notes field, not NewClientSheet) and didn't touch the white-bar bug at all — both confirmed still broken via a screenshot + screen recording Sandra sent Joel (landed in `second-brain/00-inbox/mobile-sync/`). Two separate fixes this version: **(1) White/pink bar root cause found** — `html`/`body` background (`--bg` in `index.css`) was hardcoded to the light theme's `#FFEFF4` and never synced to the app's dark-mode toggle (dark mode only applied via inline React `T.*` styles inside `#root`). Any gap outside `#root` — cold-launch settle, keyboard-open geometry, any future case — showed raw light pink regardless of theme; this is the actual cause behind the whole v0.13.23–27 "white bar" saga, not a geometry bug. Fix: `index.html` sets `<html data-theme="dark">` synchronously pre-paint from `localStorage['supermom-theme']`; `AppTheme.jsx` keeps it live on toggle; `index.css` overrides `--bg: #0A0A0A` under `html[data-theme="dark"]`. **(2) Keyboard-covers-field fix, moved and centralized**: v0.13.43's one-off `scrollIntoView` in `NewClientSheet.jsx` removed; the same behavior now lives once in `useKeyboardFocus.js` (a second `focusin` listener, `scrollIntoView({block:'nearest'})` 300ms after focus) — covers all 8 existing call sites (Settings, JobDetailSheet, NewClientSheet, EditClientSheet, NewJobSheet, NewExpenseSheet, Home) instead of just the one file that wasn't even where the bug was. **Pushed at Joel's explicit go-ahead, still unverified on a real iPhone** — this bug class has now had 5 blind-push attempts (v0.13.23–27, v0.13.43, this one) without a confirmed on-device fix; if Sandra reports either issue again, get the exact screen + a fresh screenshot with the version number visible before trying another fix blind. Build clean, Vitest 111/111.
- **v0.13.42** (`e131095`, Aug 15) — 2 bugs from Sandra's live use, reported via second-brain (`tasks.md` 2026-08-15). (1) **Cancelled job still triggered overlap warning**: `findConflicts()` in `src/data/jobsRepo.js` filtered out soft-deleted jobs (`deleted_at`) but not `job_status === 'Cancelled'` jobs, so booking a new job over a cancelled one's old slot still threw a false conflict. One-line fix: added `if (j.job_status === 'Cancelled') return false;` to the filter. (2) **"Job/client card click doesn't navigate" — audited, could not reproduce.** Live-tested (QA account, Chrome) every screen named in the report — Home (all job-card sections, the "Needs attention" wrap-up list, the Next-Up hero card), Finance (ledger `TransactionRow`, `FinanceDetailSheet` drill-ins), `JobDetailSheet`'s client-name link, and `ClientProfile`'s Recent History rows — all correctly open the job/client detail sheet already. No dead click targets found in current code. Likely explanation: Sandra hit this on a stale cached PWA build (this project has a known recurring stale-service-worker/cache class of bug, see the v0.13.23–27 white-bar saga) rather than a live code defect — nothing here needed a code change. Flagging closed pending Sandra re-confirming on a fresh reinstall; if it recurs, need the exact screen + element she tapped to keep looking. Build clean, Vitest 111/111.
- **v0.13.41** (Aug 8, not yet committed) — calendar picker now shows day-of-week. `WheelDatePicker.jsx` header gains a live weekday line (`new Date(year, monthIdx, day).toLocaleDateString('en-US', {weekday:'long'})`), recomputed on every wheel change — no 4th wheel column (weekday is derived, not choosable). Related fix in the same pass: `Finance.jsx`'s local `dateFmt` (ledger row dates) was missing `weekday:'short'`, inconsistent with the app's shared `dateBrief()` convention used elsewhere (JobCard/UpcomingCard/Home) — added. Build clean, Vitest 111/111.

**Currently awaiting real-device verification** (both are UI/CSS-only, cleanly revertible, no schema changes — not blockers, just unverified):
- **v0.13.40** (`584b73f`, Aug 8) — sheet scroll-region dead-space fix, round 2: v0.13.39's fix only covered JobDetailSheet; this closes the gap between short content and footer buttons on the other sheets with the same header/scroll/footer shape — ServiceCatalogSheet, NewExpenseSheet, PostJobSheet, NewJobSheet. Same technique (`flex:1` → `flex:'0 1 auto', minHeight:0` on the scroll region) applied only where a separate footer sibling exists; skipped WorkerCatalogSheet/FinanceDetailSheet (scroll is the last child), EditClientSheet/NewClientSheet (buttons scroll with the form), PrepNoteSheet (no footer), AiChatSheet (chat input correctly wants flex:1 to stay pinned). Investigated Admin.jsx's similar-looking gap above the bottom nav — confirmed by flex-math trace it's normal underfill on a full-height page (not the sheet bug), left as-is per Joel's call.
- **v0.13.39** (`77b79ee`, Aug 6) — sheet dead-space fix, Invoice/Receipt badge moved to header, Mark Paid/Edit Job row merge, GrabBar safe-area-inset-top padding + top-margin nudge on all 10 height-capped sheets. Needs Sandra's phone-test (notch/Dynamic Island clearance especially — she's back ~2026-08-10). Revert via `git revert 77b79ee` if needed.
- **v0.13.36** (`49adf9e`, Aug 3) — JobDetailSheet admin actions (Revert/Delete) collapsed behind a closed-by-default toggle. Needs confirming the toggle is discoverable in real use.

**⚠️ STANDING RULE (2026-07-17, added after an autonomous subagent push): before running `git push` on `main` in this repo, stop and get Joel's explicit confirmation first — and state it unambiguously as "this deploys directly to LIVE PRODUCTION" (name the domain), never generic language like "ready to commit and push?". Joel wants push-to-main to keep deploying live (that's confirmed, desired behavior) — he wants a clear, un-skippable moment where he consciously says yes to *that specific* production push, every time, including from dispatched subagents. Bake this into any subagent prompt that could reach a push step; don't assume it infers this.**

**⚠️ Multi-client git discipline**: Always push local commits before starting an online Claude Code session; always pull before the online session writes code.

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

None currently open. Everything shipped through v0.13.39 is either live-verified or awaiting Sandra's routine phone-test (see Current version section above) — not tracked here as a blocker. Resolved-bug history lives in `docs/archive/CHANGELOG-v0.13-archive.md`.

> **Constraint**: Vercel at 9/12 serverless function slots. Defer any feature requiring a new function until we consolidate or upgrade to Pro.

### ✨ Next up (no new serverless functions needed)

3. **Calendar week view** — proper rebuild (130 lines of parked code removed in v0.12.60; worth doing properly).
4. **"Last job" quick-rebook** — from ClientProfile, 1-tap to duplicate the last job (same service/rate). Saves the 3-step booking flow.
5. **Job templates** — Sandra books the same configs repeatedly. Save a job as a template; pre-fill NewJobSheet from it. Schema already supports it.

### 🤖 AI features (deferred — needs serverless slots)

6. **Voice scheduling** — `api/transcribe.js` exists. Flow: mic → transcribe → Claude parses intent → pre-fills NewJobSheet.
7. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
8. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
9. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
10. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.

### 📱 Phase 2 features

13. **Push notifications (iOS proper)** — SW setTimeout unreliable on iOS when backgrounded. Needs VAPID keys + `web-push` npm + server-triggered via Vercel cron. Android works today.
14. **Custom domain email** — swap `nodemailer` → `resend`, from `invoices@supermomforhire.com`.
15. **Automated post-job follow-up email** — 24h after complete, send "Thanks!" with invoice link. Toggle in Settings. Daily briefing cron infrastructure already exists.
16. **Staff app access** — `person_type = 'staff'` tracked in DB. No app login yet.

### 🏢 Multi-tenant / future

17. **Tenant onboarding wizard** — `scripts/provision-sandra.mjs` is the only path. Need self-serve "Set up your business" flow for growth.

### 🧹 Housekeeping (surfaced from second-brain reconciliation, Jul 16)

~~Anthropic API credits exhausted~~ — **DONE 2026-08-16.** $5 topped up per Joel.
~~Ask Sandra what confused her about old Schedule page~~ — **CLOSED 2026-08-16, Joel's call.** Long resolved, not worth chasing.
~~Backup zip refresh~~ — **CLOSED 2026-08-16, Joel's call.**

~~Check for residual fake `ai_context.learned` data on real clients~~ — **DONE 2026-08-07.** Queried `clients` table directly: 2 clients (Ann Rae, Maria Nguyen) had identical templated fake data from the removed `simulateAILearning` button ("After 10 sessions, I've learned that X prefers the back entrance..."). Cleared `ai_context.learned` on both, verified 0 remaining across all 75 clients.
