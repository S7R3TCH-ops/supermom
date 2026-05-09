# Gemini CLI · Project Instructions

> These instructions are foundational mandates for Gemini CLI. They are read at the start of every session and take precedence over default behaviors.

---

## Session Lifecycle Mandates

### 1. Auto-Documentation
At the end of every productive session, or upon major milestone completion, Gemini MUST:
- **Update `GEMINI.md`**: Update the "Current State" table and "Next priorities" section in THIS file. **Do NOT create or update a separate `handoff.md` file — it does not exist in this project.**
- **Sign Updates**: Every documentation change (in `GEMINI.md`, `CLAUDE.md`, or `DESIGN.md`) must be clearly marked with `(Updated by Gemini CLI)`.
- **Claude Sync**: Ensure `CLAUDE.md` is updated if the tech stack, build commands, or project URLs change.

### 2. Version Management
- **Increment Versions**: Automatically increment the patch version in `package.json` (e.g., 0.0.1 -> 0.0.2) after a successful production deployment.
- **Confirmation**: Gemini will state: "I am incrementing the version to [X] as per GEMINI.md" before doing so.

### 3. Deployment Awareness
- **Primary Hosting**: Vercel ([supermom-v2.vercel.app](https://supermom-v2.vercel.app)).
- **Auto-deploy**: Vercel is connected to GitHub (`S7R3TCH-ops/supermom-v2`). Every `git push origin main` deploys to production automatically. Do NOT run `vercel --prod` manually.
- **To deploy**: commit your changes and `git push origin main`.

---

## Technical Context
- **Timezone**: `America/Toronto` (Always).
- **Target Viewport**: Dynamic (Mobile) / Centered (Desktop) / `100svh`.
- **App status**: **Live on Supabase** — all 5 pages (Home, Calendar, Clients, Client Profile, Finance) read real data. Login is active. Mock data is gone.
- **Supabase project**: `lskzzsjmmtsosfneuovt`
- **Schema source of truth**: `supabase_schema.sql` at repo root.

---

## Current State (as of May 6, 2026 — updated post 10-bug batch v0.4.2)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live (Password visibility toggles added) |
| Home — today's schedule + revenue | ✅ Live (Dynamic greeting; "Next Up" filtering) |
| Calendar — Day/Week/Agenda | ✅ Live (Robust personalization) |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live (Strict validation) |
| **Job Detail sheet** | ✅ **Live** — Hardened EditMode; null-safety added |
| **AI Prep Notes** | ✅ **Live** — Fixed 404/JSON local dev errors |
| **AI Duration Estimator** | ✅ **Live** — Step 2 prediction; fixed prompt syntax |
| **Post-job / Payment sheet** | ✅ **Live** — UNPAID badge, Cash/e-Transfer toggle, editable amount, AI thank-you teaser |
| **Edit Client / AI context** | ✅ **Live** — Inline edit on Profile "What I know" card; Notes + Prefs/Access/Comms/Personal buckets |
| **7-day week strip** | ✅ **Live** — Mon–Sun on Home, today dark plum pill, pink job dots |
| **Loading / error states** | ✅ **Live** — Error cards added to Home, Calendar, Finance |
| **Thank-you / Receipt sheet** | ✅ **Live** — AI-drafted messages; Robust API initialization |
| **Expense logging** | ✅ **Live** — NewExpenseSheet (Strict validation); Finance Expenses card |
| **CSV Export / Tax Ready** | ✅ **Live** — Finance Tax Ready section |
| **Recurrence series editor** | ✅ **Live** — 'this / future / all' safely implemented |
| **GCal Sync** | ✅ **Live** — Series limit increased to 20; reliability hardened |
| **Drive time / mileage** | ✅ **Live** — Google Maps Distance Matrix API proxy |
| **payments table audit row** | ✅ **Live** — mark-paid inserts into `payments` via `recordPayment()` |
| **Client search** (Clients page) | ✅ **Live** — live filter by name/address |
| **Finance nudge buttons** | ✅ **Live** — `NudgeDraftSheet` drafts SMS reminders |
| **Code-split bundle** | ✅ **Live** — `React.lazy` + `Suspense` on all pages |
| **Realtime Sync** | ✅ **Live** — Fixed 'on after subscribe' crash loop |
| **Storage bucket** | ✅ **Live** — Photos + Voice Notes in Job Detail |
| **Geofence / auto-timer** | ✅ **Live** — Auto-start/stop with Live Timer card |
| **Google Calendar sync** | ✅ **Live** — One-way sync (Supermom -> Google) |
| **Settings / Admin page** | ✅ **Live** — `/settings` (profile+business form) + `/admin` (super admin panel) correctly routed |
| **Owner Profile** | ✅ **Live** — avatar upload + signature field; DB patched to Joel's name |
| **Onboarding flow (#20)** | ✅ **Live** — DB persistence fixed; backdrop polished |
| **Auto-learning / client intelligence** | ✅ **Live** — Robust API initialization |
| **Conflict detection (#29)** | ✅ **Live** — gap threshold logic; conflict fix routing verified |
| **Accessibility pass (#31)** | ✅ **Live** — Focus trap + Escape-to-close on all modals |
| **Automated Invoicing** | ✅ **Live** — sequential numbering + public web view |
| **Super Admin Identity** | ✅ **Live** — Joel recognized as Creator/Maintainer; viewpoint switching active |
| **Platform Hierarchy** | ✅ **Live** — Joel as global admin; Sandra as business owner |
| **EA Run-through** | ✅ **Live** — New user onboarding, Mission #1 banner, and Magic Button |
| **Finance Drilldown** | ✅ **Live** — Tappable stats with detail sheet; actionable history |
| **Interactive Home** | ✅ **Live** — Interactive 7-day strip; Dynamic EA empty-state messages; **Next Up redundancy fixed & card enhanced (v0.3.8)** |
| **Contextual Nav** | ✅ **Live** — Route-aware Back button in LogoBar |
| **Theme Toggle** | ✅ **Live** — Moved to LogoBar; premium pill switch UI |
| **Test Isolation** | ✅ **Live** — Dedicated `tester@supermom.io` environment |
| **Specialized Services** | ✅ **Live** — Declutter, Organize, Assist roster for Sandra |
| **ADHD Focus UI** | ✅ **Live** — High-contrast Amber highlighting for Unpaid completed jobs |
| **AI Persona Picker** | ✅ **Live** — Fixed missing DB column; verified persistence |
| **Typography Standardization** | ✅ **Live** — All 5 pages migrated to semantic typography components |
| **Design Compliance** | ✅ **Live** — 4-item nav consolidation; official Theme Toggle rule; Serif Section Labels |
| **Mobile Keyboard Polish** | ✅ **Live** — Focus-aware padding added to all major sheets |
| **Client List Privacy** | ✅ **Live** — Internal notes hidden from summary list |
| **Price Inheritance** | ✅ **Live** — Services inherit business default hourly rate (v0.3.1) |
| **UI Illustrations** | ✅ **Live** — Rich SVG illustrations for all empty states (v0.3.2) |
| **Swipe to Delete** | ✅ **Live** — Gesture-based deletion on Home & Agenda (v0.3.2) |
| **Haptic Feedback** | ✅ **Live** — Taptic engine support for taps/swipes (v0.3.3) |
| **Service Catalog UX** | ✅ **Live** — Added unsaved changes protection, dirty indicators, and visual 'Mark for Deletion' flow (v0.3.5) |
| **Unified Grab Bars** | ✅ **Live** — Standardized sheet handles across app (v0.3.3) |

## Phase 24 UI & UX Polish (Gemini CLI session, May 6, 2026)

Key enhancements for application "feel" and dynamic pricing:

| # | Change | Detail | File |
|---|---|---|---|
| GA | Price Inheritance | ✅ **Live** — Services can track business default rate via `null` DB values | `ServiceCatalogSheet.jsx` |
| GB | New Job Price Res | ✅ **Live** — Booking flow resolves inherited rates dynamically | `NewJobSheet.jsx` |
| GC | SVG Illustrations | ✅ **Live** — Replaced dry text with branded SVG empty states | `Illustrations.jsx`, `Home.jsx`, etc. |
| GD | Swipe to Delete | ✅ **Live** — Modern gesture for clearing schedule items | `Swipeable.jsx`, `Home.jsx` |
| GE | Haptic Feedback | ✅ **Live** — Light/Medium vibration for key mobile interactions | `haptics.js`, `FAB.jsx`, etc. |
| GF | Unified Grab Bars | ✅ **Live** — Standardized handle for 10+ bottom sheets | `GrabBar.jsx`, `JobDetailSheet.jsx`, etc. |
| GG | Perf Optimization | ✅ **Live** — Pre-grouped jobs in Week View via useMemo | `Calendar.jsx` |
| GH | UX Micro-polish | ✅ **Live** — Active scaling for buttons + pulse animation for timers | `index.css`, `Home.jsx` |

(Updated by Gemini CLI)

## RLS Debug Session (May 4, 2026) — Claude Code

### What we found
The `businesses_modify` RLS policy was `USING (is_admin())` — completely blocking owners (Sandra, any owner-role user) from updating their own business record. Fixed by dropping and recreating with `USING (is_admin() OR id = my_business_id()) WITH CHECK (same)`.

`services_modify` had the right USING clause but was missing an explicit WITH CHECK. Recreated with both.

Both functions (`is_admin()`, `my_business_id()`) are `SECURITY DEFINER` — they bypass RLS on `users` and always return the correct value.

### Current RLS policy state (verified in Supabase SQL Editor)
| Table | Policy | Condition |
|---|---|---|
| `businesses` | `businesses_modify` ALL | `is_admin() OR id = my_business_id()` (USING + WITH CHECK) |
| `businesses` | `businesses_select` SELECT | `is_admin() OR id = my_business_id()` |
| `services` | `services_modify` ALL | `is_admin() OR business_id = my_business_id()` (USING + WITH CHECK) |
| `services` | `services_select` SELECT | `is_admin() OR business_id = my_business_id()` |
| `users` | `users_select` SELECT | `is_admin() OR id = auth.uid() OR business_id = my_business_id()` |

### Code changes shipped (v0.2.7, main branch)
- `ServiceCatalogSheet.jsx` — upsert now calls `.select()` and throws if 0 rows written (surfaces RLS silent blocks)
- `ServiceCatalogSheet.jsx` — soft-delete (set `active=false`) also checks for 0 rows and throws
- `Settings.jsx` — `console.error` added on save failure for easier debugging

### Resolved May 6, 2026 (v0.4.1) — Home UX & Stability Overhaul
- **"What's Next Today" Renaming** — Renamed "Opening Act" for clearer mission focus.
- **Strict Exclusivity** — The highlighted mission card now completely hides that job from the "Upcoming Missions" list until its duration has passed, ensuring zero redundancy on the Home page.
- **Intelligent Focus Trap** — Upgraded `useFocusTrap` with a 350ms animation delay and smart input prioritization (no more cursor jumping to the close button).
- **Keyboard Layout Stability** — Replaced dynamic form padding with a stable "spacer" div to prevent layout jitter and unclickable fields when the mobile keyboard opens.
- **Enhanced Mission Intel** — Pulled address links, service details, and client access/prefs directly into the highlighted Home card for a "one-tap" workflow.

### Resolved May 6, 2026 (v0.4.0) — Focus & Keyboard Stability COMPLETE
- **"Add Client" Interaction Fix** — Resolved issue where keyboard would "pop up and down" real quick by making `useFocusTrap` smarter and stabilizing parent callbacks in `NewJobSheet`.
- **Layout Polish** — Removed disruptive transitions on focus-aware padding to prevent layout thrashing.

### Resolved May 6, 2026 (v0.3.9) — Stability Fixes COMPLETE
- **Calendar TypeError Fix** — Fixed crash in `getGoLabel` when receiving service objects; hardened all `toLowerCase` calls in selectors and AI logic.

### Resolved May 6, 2026 (v0.3.8) — Phase E: Home UX Polish COMPLETE
- **Next Up Redundancy** — Eliminated duplication of the next job in the upcoming list.
- **Enhanced Next Up Card** — Added address (with map link), service name, amount, and client intelligence (access/prefs) to the card.
- **Smarter Next Job Logic** — Correctly identifies the subsequent job when one is active and handles current/late jobs without skipping.

### Resolved May 4, 2026 (v0.3.0) — Phase 1 RLS verification COMPLETE
- **Service Catalog "Add Service"** — Fixed in v0.2.9. Root cause was UX, not RLS: new cards appended to bottom of scrollable list rendered below the fold. Fix: prepend new cards (`[newSvc, ...prev]`).
- **Service Catalog persistence** — VERIFIED v0.3.0: owner can Add → Save → reload → service persists. No console errors.
- **Service Catalog delete** — Soft-delete (`active=false`) was working at the DB level all along. The lie was in `refresh()`: it selected services without filtering by `active`, so soft-deleted rows reappeared. Fixed by adding `.eq('active', true)` to the catalog query.
- **Settings save (owner role)** — VERIFIED working. Hourly rate + business name persist after reload. "Uncontrolled → controlled input" warning fixed at `Settings.jsx:306` (`form?.signature ?? ''`).

### Resolved May 6, 2026 (v0.3.3) — Phase D: Mobile Polish COMPLETE
- **Haptic Feedback** — Added subtle haptics for swipes, taps, and navigation.
- **Unified Visuals** — Unified `GrabBar` across all bottom sheets for a native look.
- **Performance** — Optimized `Calendar` Week view; implemented momentum scrolling.
- **Micro-interactions** — Added pulse animations and global button active scaling.

### Resolved May 6, 2026 (v0.3.2) — Phase C: UI Polish & Gestures COMPLETE
- **Empty State Illustrations** — Added rich SVG illustrations for empty states on all main pages.
- **Swipe to Delete** — Implemented left-swipe gesture for job cards on Home and Calendar Agenda views.
- **Home UI Stability** — Restored accidentally removed helper functions and verified component structure.

### Resolved May 6, 2026 (v0.3.1) — Phase B: Service Catalog & Pricing COMPLETE
- **Service Catalog Price Inheritance** — Services can now "inherit" the business's default hourly rate.
- **Service Catalog Saving** — Hardened upsert logic and added "DEFAULT" toggle for Hourly services.
- **New Job Price Resolution** — Correctly resolve prices, prioritizing specific service rates but falling back to business defaults.

### Test accounts in DB
| Email | Role | Business ID |
|---|---|---|
| jlundie@gmail.com | admin | null (global) |
| sandra@supermom.io | owner | 624794d2-4353-45d6-84f3-a2cf80cc8f1e |
| joel@test.com | owner | 52a7536c-dc89-446b-8a56-9d955e66859e |

(Updated by Gemini CLI)

### Bug Fixes — May 6, 2026 (v0.3.7) — Claude Code

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | Service Catalog: Hourly rate not editable; not obvious how to set custom rate | `use_business_default: true` disables input; DEFAULT button looked like a badge, not interactive | Button now shows `DEFAULT ✎` / `CUSTOM ✎` with tooltip; hint caption appears under disabled input |
| 2 | Service Catalog: null ID error when adding second service | Batch upsert with `onConflict: 'id'` sent explicit NULL for new rows without `id` | New services now use `crypto.randomUUID()`; `id` always included in upsert payload |
| 3a | Book Job from client profile shows Step 1 (who is it for?) | `step` always initialized to 1 regardless of `prefillClientId` | When `prefillClientId` is present, step initializes to 2; step counter shows "Step 1 of 2" |
| 3b | White screen after clicking Next from Book Job | `business` variable referenced in `Step2What` but never passed as a prop | `business` now passed as explicit prop; fixes crash for Hourly services with `default_price = null` |

## Bug Fixes — May 6, 2026 (v0.4.4) — Claude Code (Playwright exploratory session)

Full owner flow tested via Playwright (create client → book job → partial payment → full payment + additional costs). Two real bugs found and fixed:

| # | Bug | Fix |
|---|---|---|
| 1 | PostJobSheet: opening "Mark Paid" on a partial-paid job defaulted amount to **full total** instead of remaining balance | Queries `payments` table on load; pre-fills with `total − already_paid` (rounded to 2dp) |
| 2 | NewJobSheet Step 1: client cards showed **first name only** — impossible to distinguish "Sarah Smith" from "Sarah Jones" | Changed to "First L." format (first name + last initial); cards now show e.g. "Sarah S.", "Timothy S." |

### Playwright infrastructure also updated
- `playwright.config.ts` — split `setup` into `setup` (user auth) and `setup-superadmin` (admin auth); `superadmin-chromium` no longer depends on the failing user auth setup
- `tests/auth.setup.ts` — updated to use `jlundie@gmail.com` / `TempPass2026!` (Joel's owner-equivalent account); Sandra's current password is unknown
- `tests/explore-flows.spec.ts` — new comprehensive exploratory test covering create client → book job (FAB + profile) → partial payment → full payment + additional costs, with screenshots at every step

## DB Cleanup — May 7, 2026 (Claude Code)

- Soft-deleted all clients created before 2026-04-29 and their associated jobs, invoices, job templates
- Hard-deleted dependent rows from tables with no `deleted_at` (payments, invoice_jobs, communication_log, notification_log, audit_log, template_schedule)
- Also soft-deleted any remaining clients with "test" in their name (first or last)
- DB now has 10 real active clients — Sandra's actual client base
- Note: Supabase SQL Editor requires the **RLS toggle disabled** to run admin cleanup scripts; temp-table approach fails under RLS — use inline subqueries instead

## Bug Fixes & Features — May 9, 2026 (Claude Code)

| # | Change | Detail |
|---|---|---|
| 1 | Finance tab crash | `isOpen` stripped from `NewExpenseSheet` props but still used in `useFocusTrap` + early-return guard; re-added |
| 2 | Home spotlight rotation | "What's Next Today" only holds a job while `now < start + estimated_duration`; next job auto-promotes; overdue card appears below with amber "Needs Attention" + Wrap Up CTA; 60s live clock drives transitions |

## Next priorities (as of May 9, 2026)
1. ~~**Supabase Redirect Allowlist**~~ — ✅ Done.
2. ~~**Scroll Performance Audit**~~ — ✅ Done (v0.3.6).
3. ~~**Service Catalog Deletion Flow**~~ — ✅ Done (v0.3.5).
4. ~~**Service Catalog & Book Job bug fixes**~~ — ✅ Done (v0.3.7).
5. ~~**10-bug QA batch**~~ — ✅ Done (v0.4.2).
6. ~~**Partial payment + client name display bug fixes**~~ — ✅ Done (v0.4.4).
7. ~~**DB cleanup**~~ — ✅ Done (May 7, 2026) — test/old clients removed; 10 real clients remain.
8. ~~**Finance tab crash + Home spotlight rotation**~~ — ✅ Done (v0.4.5, May 9, 2026).
9. **User testing with Sandra** — walk through the payment flow and confirm Calendar swipe feels right.
10. **Client Engagement Tools** — AI-suggested follow-ups and re-booking reminders.

(Updated by Claude Code — May 9, 2026)
