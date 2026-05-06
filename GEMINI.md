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

## Current State (as of May 1, 2026 — updated post QA Audit Fixes)

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
| **Interactive Home** | ✅ **Live** — Interactive 7-day strip; Dynamic EA empty-state messages |
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

## Phase 23 QA Stability Hardening (Gemini CLI session, May 1, 2026)

Key enhancements for application stability and design consistency:

| # | Change | Detail | File |
|---|---|---|---|
| DU | Realtime Loop Fix | ✅ **Fixed** — Prevented 'on after subscribe' crash in `realtime.js` | `realtime.js` |
| DV | Profile Route Fix | ✅ **Fixed** — Resolved `mode` reference error in `ClientProfile.jsx` | `ClientProfile.jsx` |
| DW | RLS Hardening | ✅ **Live** — Comprehensive migration for `businesses`, `users`, `clients`, etc. | `supabase/migrations/` |
| DX | GCal Reliability | ✅ **Live** — Awaited syncs + 20-occurrence series limit | `jobsRepo.js` |
| DY | Design Compliance | ✅ **Live** — Standardized view toggles, hero borders, and FAB visibility | `Calendar.jsx`, `Finance.jsx`, `App.jsx` |
| DZ | Backdrop Blur | ✅ **Live** — Optimized onboarding overlay for readability | `OnboardingWalkthrough.jsx` |
| EA | Build Stabilization | ✅ **Fixed** — Resolved `jobsRepo.js` syntax error causing Vite compilation failure | `jobsRepo.js` |
| EB | UX Polish | ✅ **Live** — Increased global Toast notification duration from 3.5s to 6.0s | `ToastContext.jsx` |
| EC | Settings Hardening | ✅ **Fixed** — Added strict parsing for `ai_profile` JSON to prevent "cannot coerce" errors on save | `Settings.jsx` |
| ED | Keyboard Resilience | ✅ **Live** — Added `useKeyboardFocus` hook for focus-aware sheet padding | `src/hooks/useKeyboardFocus.js` |
| EE | Privacy Audit | ✅ **Live** — Removed internal notes from Client summary list | `src/pages/Clients.jsx` |
| EF | Admin UX | ✅ **Live** — Added toast feedback for restricted `/admin` access | `src/pages/Admin.jsx` |

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

### Resolved May 4, 2026 (v0.3.0) — Phase 1 RLS verification COMPLETE
- **Service Catalog "Add Service"** — Fixed in v0.2.9. Root cause was UX, not RLS: new cards appended to bottom of scrollable list rendered below the fold. Fix: prepend new cards (`[newSvc, ...prev]`).
- **Service Catalog persistence** — VERIFIED v0.3.0: owner can Add → Save → reload → service persists. No console errors.
- **Service Catalog delete** — Soft-delete (`active=false`) was working at the DB level all along. The lie was in `refresh()`: it selected services without filtering by `active`, so soft-deleted rows reappeared. Fixed by adding `.eq('active', true)` to the catalog query.
- **Settings save (owner role)** — VERIFIED working. Hourly rate + business name persist after reload. "Uncontrolled → controlled input" warning fixed at `Settings.jsx:306` (`form?.signature ?? ''`).

### Resolved May 6, 2026 (v0.3.1) — Phase B: Service Catalog & Pricing COMPLETE
- **Service Catalog Price Inheritance** — Fixed in v0.3.1. Services can now "inherit" the business's default hourly rate.
- **Service Catalog Saving** — Hardened upsert logic and added "DEFAULT" toggle for Hourly services.
- **New Job Price Resolution** — `NewJobSheet` and `JobDetailSheet` now correctly resolve prices, prioritizing specific service rates but falling back to business defaults when needed.

### Test accounts in DB
| Email | Role | Business ID |
|---|---|---|
| jlundie@gmail.com | admin | null (global) |
| sandra@supermom.io | owner | 624794d2-4353-45d6-84f3-a2cf80cc8f1e |
| joel@test.com | owner | 52a7536c-dc89-446b-8a56-9d955e66859e |

(Updated by Gemini CLI)

## Next priorities (as of May 6, 2026)
1. **Supabase Redirect Allowlist** — Configure `localhost` and `vercel` URLs in project settings (Auth → URL Configuration).
2. **Empty state illustrations** — Upgrade text-based empty states to use rich icon/svg illustrations.
3. **Swipe to Delete** — Implement swipe-to-delete gestures on job cards.
4. **Service Catalog deferred-save UX** — Consider auto-save on delete or an "unsaved changes" banner.

(Updated by Gemini CLI — May 6, 2026)
