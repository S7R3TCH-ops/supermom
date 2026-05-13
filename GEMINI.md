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

## ⚠️ Read Before Any Refactor or Lint Pass

> **`docs/gemini-import-map.md`** — mandatory reading before touching imports, renaming functions, or running any cleanup. It lists the canonical location of every commonly confused symbol in this codebase, and documents 6 features that were accidentally removed during Phase 25 (May 12, 2026) that still need to be restored. The Phase 25 cleanup broke the build with 11 wrong imports; Claude Code repaired them. Do not repeat the same mistakes.

---

## Technical Context
- **Timezone**: `America/Toronto` (Always).
- **Target Viewport**: Dynamic (Mobile) / Centered (Desktop) / `100svh`.
- **App status**: **Live on Supabase** — all 5 pages (Home, Calendar, Clients, Client Profile, Finance) read real data. Login is active. Mock data is gone.
- **Supabase project**: `lskzzsjmmtsosfneuovt`
- **Schema source of truth**: `supabase_schema.sql` at repo root.

---

## Current State (as of May 12, 2026 — updated post Codebase Stability & Cleanup)

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
| **Codebase Stability** | ✅ **0 Lint Errors** — Comprehensive cleanup of unused vars and React Hook violations (v0.5.1) |
| **Weekly Summary / Fixed Week** | ✅ **Live** — Home grid fixed to current week; selectedDate defaults to null (v0.5.2) |
| **7-Day Grid Navigation** | ✅ **Live** — Replaced scrolling strip with fixed CSS grid on Home (v0.5.2) |

## Phase 25 Codebase Stability & Cleanup (Gemini CLI session, May 12, 2026)

Key technical improvements and linting resolution:

| # | Change | Detail | File |
|---|---|---|---|
| LA | SectionLabel Fix | ✅ **Live** — Standardized imports & fixed ReferenceError | Multiple |
| LB | Hook Violation Fixes | ✅ **Live** — Resolved all Rules of Hooks and cascading render warnings | `Home.jsx`, `PostJobSheet.jsx`, etc. |
| LC | Node.js Globals | ✅ **Live** — Updated ESLint config for `api/` directory (process/Buffer) | `eslint.config.js` |
| LD | Cleanup | ✅ **Live** — Removed 50+ unused variables and imports | Entire codebase |
| LE | Context Optimization | ✅ **Live** — Fixed Fast Refresh warnings in context providers | `ToastContext.jsx`, etc. |
| LF | Typography Immutability | ✅ **Live** — Fixed unused `Component` variable in semantic components | `Title.jsx`, `Text.jsx`, etc. |
| LG | Week Range Helpers | ✅ **Live** — Added getWeekRange and updated Home state for weekly summary | `Home.jsx` |
| LH | 7-Day Fixed Grid | ✅ **Live** — Implemented CSS Grid nav and selection toggle logic | `Home.jsx` |

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

### Resolved May 12, 2026 (v0.5.2) — Home UX Redesign Phase
- **7-Day Fixed Grid** — Replaced the scrolling week strip with a fixed 7-column grid on Home.
- **Weekly Summary Mode** — Implemented selection toggle: clicking a selected day returns to Weekly Summary mode.
- **Visual Polish** — Standardized grid styling (white bg inactive, pink selected) following design compliance.

### Resolved May 10, 2026 (v0.5.0) — Mission Active Overhaul & Financial Transparency
- **Mission Active Spotlight** — Pulsing 'HAPPENING NOW' UI for ongoing jobs; quick buttons to add time/costs.
- **Financial Math Breakdown** — Standardized, transparent math layout across JobDetail, PostJob, and Finance screens.
- **Card Duration Labels** — Explicit 'Est' and 'Actual' hour labels on all JobCards.

## Next priorities (as of May 12, 2026)
1. **Home UX Redesign - Step 3** — design compliance pass for Home page content.
2. **Sandra user testing feedback** — gather any friction points from her live session today; prioritize based on what she finds confusing.
3. **Client Engagement Tools** — AI-suggested follow-ups and re-booking reminders.
4. **Offline Mode** — App crashes if Supabase is unreachable on initial load. Need better `Suspense` fallbacks.
5. **Mobile Keyboard Layout** — Keyboard covers the "Save" button in sheets on small iOS devices. Need to add `paddingBottom` to `SheetContainer` based on focus state.

(Updated by Gemini CLI — May 12, 2026)
