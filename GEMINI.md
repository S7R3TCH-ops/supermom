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
- **Target Viewport**: 390px (iPhone) / `100svh`.
- **App status**: **Live on Supabase** — all 5 pages (Home, Calendar, Clients, Client Profile, Finance) read real data. Login is active. Mock data is gone.
- **Supabase project**: `lskzzsjmmtsosfneuovt`
- **Schema source of truth**: `supabase_schema.sql` at repo root.

---

## Current State (as of April 26, 2026 — updated post Platform Reset)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live (Password visibility toggles added) |
| Home — today's schedule + revenue | ✅ Live (Dynamic greeting; "Next Up" filtering) |
| Calendar — Day/Week/Agenda | ✅ Live (Robust personalization) |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live (Strict validation) |
| **Job Detail sheet** | ✅ **Live** — Hardened EditMode; null-safety added |
| **AI Prep Notes** | ✅ **Live** — Robust API error handling + dynamic context |
| **AI Duration Estimator** | ✅ **Live** — Step 2 prediction; fixed prompt syntax |
| **Post-job / Payment sheet** | ✅ **Live** — UNPAID badge, Cash/e-Transfer toggle, editable amount, AI thank-you teaser |
| **Edit Client / AI context** | ✅ **Live** — Inline edit on Profile "What I know" card; Notes + Prefs/Access/Comms/Personal buckets |
| **7-day week strip** | ✅ **Live** — Mon–Sun on Home, today dark plum pill, pink job dots |
| **Loading / error states** | ✅ **Live** — Error cards added to Home, Calendar, Finance |
| **Thank-you / Receipt sheet** | ✅ **Live** — AI-drafted messages; Robust API initialization |
| **Expense logging** | ✅ **Live** — NewExpenseSheet (Strict validation); Finance Expenses card |
| **CSV Export / Tax Ready** | ✅ **Live** — Finance Tax Ready section |
| **Recurrence series editor** | ✅ **Live** — 'this / future / all' safely implemented |
| **GCal Sync Security** | ✅ **Live** — CSRF nonce + multi-tenant state param |
| **Drive time / mileage** | ✅ **Live** — Google Maps Distance Matrix API proxy |
| **payments table audit row** | ✅ **Live** — mark-paid inserts into `payments` via `recordPayment()` |
| **Client search** (Clients page) | ✅ **Live** — live filter by name/address |
| **Finance nudge buttons** | ✅ **Live** — `NudgeDraftSheet` drafts SMS reminders |
| **Code-split bundle** | ✅ **Live** — `React.lazy` + `Suspense` on all pages |
| **Real-time subscriptions** | ✅ **Live** — Supabase Realtime auto-refresh |
| **Storage bucket** | ✅ **Live** — Photos + Voice Notes in Job Detail |
| **Geofence / auto-timer** | ✅ **Live** — Auto-start/stop with Live Timer card |
| **Google Calendar sync** | ✅ **Live** — One-way sync (Supermom -> Google) |
| **Settings / Admin page** | ✅ **Live** — `/settings` (profile+business form) + `/admin` (super admin panel) correctly routed |
| **Owner Profile** | ✅ **Live** — avatar upload + signature field; DB patched to Joel's name |
| **Onboarding flow (#20)** | ✅ **Live** — `OnboardingWalkthrough` bypassed for Super Admins |
| **Auto-learning / client intelligence** | ✅ **Live** — Robust API initialization |
| **Conflict detection (#29)** | ✅ **Live** — gap threshold logic |
| **Accessibility pass (#31)** | ✅ **Live** — Focus trap + Escape-to-close on all modals |
| **Automated Invoicing** | ✅ **Live** — sequential numbering + public web view |
| **Super Admin Identity** | ✅ **Live** — Joel recognized as Creator/Maintainer; viewpoint switching active |
| **Platform Hierarchy** | ✅ **Live** — Joel as global admin; Sandra as business owner |
| **EA Run-through** | ✅ **Live** — New user onboarding, Mission #1 banner, and Magic Button |
| **Finance Drilldown** | ✅ **Live** — Tappable stats with detail sheet; actionable history |
| **Interactive Home** | ✅ **Live** — Interactive 7-day strip; Dynamic EA empty-state messages |
| **Contextual Nav** | ✅ **Live** — Route-aware Back button in LogoBar |
| **Theme Toggle** | ✅ **Live** — Moved to Settings; premium switch UI |
| **Test Isolation** | ✅ **Live** — Dedicated `tester@supermom.io` environment |

## Phase 14 UI/UX Polish & Dynamic Intelligence (Gemini CLI session, April 26, 2026)

Key enhancements for "Premium 2026" feel and intuitive navigation:

| # | Change | Detail | File |
|---|---|---|---|
| AO | Actionable Schedule | 7-day row on Home is now interactive; filters "Later Today" list | `Home.jsx` |
| AP | Dynamic EA Voice | Randomized quirky messages for empty/completed states | `Home.jsx`, `greetings.js` |
| AQ | Contextual Back | LogoBar now shows a "Back" button on non-top-level routes | `LogoBar.jsx` |
| AR | Theme Toggle Move | Removed from LogoBar; new sliding switch in Settings > Appearance | `LogoBar.jsx`, `Settings.jsx` |
| AS | UI Polish Pass | Active BottomNav glow, standardized sheet handles, editorial typography | `BottomNav.jsx`, `SectionLabel.jsx`, `JobDetailSheet.jsx` |
| AT | Admin Sign Out | Direct Sign Out button added to Admin page for better accessibility | `Admin.jsx` |
| AU | Critical Bug Fixes | Fixed signOut ReferenceError and stringified 'null' UUID database crash | `Admin.jsx`, `currentBusiness.js`, `NewJobSheet.jsx`, `useData.js` |
| AV | Dark Mode Access | Increased contrast for muted labels/handles (WCAG compliance) | `tokens.js`, `SectionLabel.jsx`, `sheets/*.jsx` |
| AW | Test Isolation | Decoupled E2E tests from personal accounts via `tester@supermom.io` | `auth.setup.ts`, `happy-path.spec.ts` |

(Updated by Gemini CLI)

## Next priorities (as of April 26, 2026)
1. **Empty state icon illustrations** — Add visual interest to empty schedule/finance states.
2. **Typography standardization** — Review all `SectionLabel` usages for consistency.
3. **Configure Supabase redirect URL allowlist** — add `http://localhost:5173/**` and `https://supermom-v2.vercel.app/**`.
4. **Self-serve client booking** — Start Phase 2 discovery.

