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

## Current State (as of April 27, 2026 — updated post UX & Stability Hardening)

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
| **Theme Toggle** | ✅ **Live** — Moved to LogoBar; premium pill switch UI |
| **Test Isolation** | ✅ **Live** — Dedicated `tester@supermom.io` environment |
| **Specialized Services** | ✅ **Live** — Declutter, Organize, Assist roster for Sandra |
| **ADHD Focus UI** | ✅ **Live** — High-contrast Amber highlighting for Unpaid completed jobs |
| **AI Persona Picker** | ✅ **Live** — Fixed missing DB column; verified persistence |
| **Typography Suite** | ✅ **Live** — Suite of atomic, theme-aware components (Title, Subheading, SectionLabel, Text, Caption) |

## Phase 15/16 Updates (Gemini CLI session, April 27, 2026)

Key enhancements for scale and Super Admin control:

| # | Change | Detail | File |
|---|---|---|---|
| AZ | Creative Greetings | Time-aware motivating greetings for Home screen | `Home.jsx`, `greetings.js` |
| BA | AI Persona Tester | ✅ **Fixed** — Applied missing `ai_profile` column to database | `Admin.jsx`, `api/ai/test-persona.js` |
| BB | Admin Provisioning | UI + Backend for Super Admins to create new business/owner accounts | `Admin.jsx`, `api/admin/provision.js` |
| BC | Mandatory Password Reset | Force new users to change password on first login | `OnboardingWalkthrough.jsx` |
| BD | Soft Delete (Admin) | Super Admin tool to safely hide businesses/users from UI | `Admin.jsx` |
| BE | Premium Theme Toggle | Sleek pill-shaped switch in global LogoBar; accessible on every page | `LogoBar.jsx` |
| BF | Responsive Shell | Removed fixed widths; app now fills 100% of phone, centered on desktop | `App.jsx`, `index.css` |
| BG | Robust Viewpoint Switching | Fixed UI crashes when switching views via null-safety and syntax fixes | `Home.jsx`, `useData.js` |
| BH | Varied Empty States | Prevented repetitive messaging in briefing vs schedule lists | `Home.jsx`, `greetings.js` |
| BI | ADHD High-Contrast | Amber/Yellow highlighting for unpaid completed jobs | `Home.jsx`, `Calendar.jsx` |
| BJ | Deep Realistic Seed | Script for full platform reset and high-quality mock data population | `full-reset-and-seed.mjs` |
| BK | Recent Activity Filtering | Finance Activity only shows past/today jobs; clicking opens full detail sheet | `Finance.jsx` |
| BL | Home Page Persistency | Today's jobs (completed/paid) stay on home screen; sort by time | `Home.jsx` |
| BM | Back to the Future Warning | Funny warning when marking future jobs as complete or paid | `JobDetailSheet.jsx`, `PostJobSheet.jsx` |
| BN | Enhanced Nudge Personalization | Nudges use client's personal AI context and handle missing names better | `Finance.jsx`, `NudgeDraftSheet.jsx` |
| BO | AI Prep Note Resilience | Added robust logging and error handling to prep-note API | `api/ai/prep-note.js` |
| BP | Deep Realistic Seed v2 | Expanded seed script with more clients and complex job histories | `seed_realistic.mjs` |
| BQ | Persona-Aware Briefing | ✅ **Fixed** — Refined comments for organizing focus; no cleaning refs | `greetings.js`, `Home.jsx` |
| BR | High-Visibility Cards | ✅ **Live** — Vertical time blocks (Start-End) + auto date context | `Home.jsx` |
| BS | Default Light Theme | ✅ **Live** — Default set to 'warm'; preference persists via localStorage | `AppTheme.jsx` |
| BS | Robust Page Stability | ✅ **Live** — Deterministic greetings + error catching layers | `Home.jsx`, `greetings.js` |
| BT | Home Section Logic | Precise categorization of today's jobs into Active, Incomplete (Past Due), Upcoming, and Done sections | `Home.jsx` |
| BU | Past Due Highlighting | Amber styling and "PAST DUE" badges for jobs that ended but weren't marked complete | `Home.jsx` |
| BV | Persistent Done Jobs | Completed missions now stay on the home page under a dedicated "Accomplished" label | `Home.jsx` |
| BW | Mission Wrap-up Flow | Marking a job complete now opens a comprehensive wrap-up sheet for duration and intel logging | `JobDetailSheet.jsx`, `PostJobSheet.jsx` |
| BX | Duration & Intel Logging | Added manual hours/mins entry and After-Job Intel notes to the post-job flow | `PostJobSheet.jsx`, `jobsRepo.js` |
| BY | Refined Status UI | Distinct color schemes and badges for PAST DUE (Amber), UNPAID (Yellow), and PAID (Green) | `Home.jsx` |
| BZ | Manual Hours Prompt | UI now explicitly flags completed jobs missing actual duration data | `Home.jsx`, `PostJobSheet.jsx` |
| CA | Service Catalog Management | ✅ **Live** — Full CRUD (Add/Edit/Delete) management with high-contrast inputs | `Admin.jsx`, `ServiceCatalogSheet.jsx` |
| CB | Dynamic Timing Display | All job cards now show both start and estimated end times based on service defaults | `Home.jsx`, `Calendar.jsx` |
| CC | Manual Duration Tracking | System tracks missing actual durations and flags them on Home/Calendar for update | `Home.jsx`, `Calendar.jsx`, `PostJobSheet.jsx` |
| CD | AI Learning Engine | RecordPayment now recalculates service averages and updates catalog automatically | `jobsRepo.js` |
| CE | Database Schema Sync | ✅ **Complete** — Synchronized `businesses`, `services`, and `integrations` tables; created `job-assets` storage bucket | `supabase/migrations/` |
| CF | Phone UX Polish | ✅ **Live** — Full-screen filling (100dvh), 56px hero logo, and fixed conflict navigation | `index.css`, `App.jsx`, `LogoBar.jsx`, `Calendar.jsx` |
| CG | Business Realignment | ✅ **Live** — AI persona and greetings updated to Organizing & Assistance themes | `greetings.js`, `ai.js`, `Admin.jsx` |

(Updated by Gemini CLI)

## Phase 17 UI/UX Personality & Logic Polish (Gemini CLI session, April 27, 2026)

Key enhancements for "Supermom Spirit" and essential bug fixes:

| # | Change | Detail | File |
|---|---|---|---|
| CH | Dynamic Personality | Randomized motivating closers (e.g., "Go get 'em!") in greetings | `greetings.js` |
| CI | Smart Grouping | "3-Job Rule": hide section headers if 3 or fewer jobs in a category | `Home.jsx` |
| CJ | Aesthetic Pop | Thicker left accents (5px), emerald green for Paid, amber glow for Unpaid | `Home.jsx` |
| CK | Spirited Empty States | Persona-aware EmptyState component with encouraging messages and icons | `Home.jsx` |
| CL | Hero Backgrounds | Subtle geometric patterns added to Hero and "Opening Act" sections | `Home.jsx` |
| CM | Service List Fix | ✅ **Fixed** — useServices now correctly filters by current business_id | `useData.js` |
| CN | Data Integrity | ✅ **Smart Fix** — Standardized time/date formats from UI to DB | `NewJobSheet.jsx`, `jobsRepo.js` |
| CO | AI Resilience | ✅ **Live** — Robust mock fallbacks for all AI features (no key needed) | `api/ai/*.js` |
| CP | Catalog Stability | ✅ **Fixed** — Service catalog CRUD enabled via RLS + optimized Save | `ServiceCatalogSheet.jsx`, `supabase/migrations/` |
| CQ | Duplicate Prevention | ✅ **Live** — Database-level unique constraints and idempotent seeding | `clientsRepo.js`, `seed_idempotent.mjs` |
| CR | Routing Stability | ✅ **Fixed** — Explicit `vercel.json` rewrites prevent 404s on browser refresh | `vercel.json` |
| CS | Unified Dev Flow | ✅ **Live** — `npm start` (via `vercel dev`) enables local API + routing parity | `package.json` |
| DA | High-Visibility Date/Time | ✅ **Live** — Dedicated banner date/time rows and redesign of home job cards | `JobDetailSheet.jsx`, `Home.jsx`, `ClientProfile.jsx` |

(Updated by Gemini CLI)

## Phase 19/20 Home Page Love & Conflict Hardening (Gemini CLI session, April 27, 2026)

Key refinements for user engagement and schedule safety:

| # | Change | Detail | File |
|---|---|---|---|
| DB | Home Page 'Love' | Added Daily Mission Progress bar, Motivation footer, and visual patterns | `Home.jsx` |
| DC | Conflict Hardening | Real-time amber warning during booking when overlaps are detected | `NewJobSheet.jsx` |
| DD | Seeder Fix | Resolved overlapping job times in the idempotent seed script | `seed_idempotent.mjs` |
| DE | Hero Aesthetics | Geometric SVG patterns and refined gradients for a premium feel | `Home.jsx` |
| DF | Date Persistence | Dates now show on all job cards (including Today/Unpaid) for quick orientation | `Home.jsx` |

(Updated by Gemini CLI)

## Phase 21 Typography Standardization (Gemini CLI session, April 27, 2026)

Key refinements for design system maturity and future-proofing:

| # | Change | Detail | File |
|---|---|---|---|
| DG | Typography Suite | ✅ **Live** — Created `Title`, `Subheading`, `SectionLabel`, `Text`, `Caption` in `src/components/ui/typography/` | `src/components/ui/typography/` |
| DH | Semantic HTML | Typography components support `component` prop (h1, h2, etc.) for better SEO/Accessibility | `src/components/ui/typography/` |
| DI | Centralized Exports | Added `index.js` for clean named imports | `src/components/ui/typography/index.js` |
| DJ | Home Modernization | Fully migrated `Home.jsx` to use semantic typography components | `Home.jsx` |
| DK | Profile Modernization | Fully migrated `ClientProfile.jsx` to use semantic typography components | `ClientProfile.jsx` |
| DL | Legacy Cleanup | Deleted legacy `src/components/ui/SectionLabel.jsx` and updated all 10+ dependencies | `src/pages/*`, `src/components/sheets/*` |

(Updated by Gemini CLI)

## Next priorities (as of April 27, 2026)
1. **Configure Supabase redirect URL allowlist** — add `http://localhost:5173/**` and `https://supermom-v2.vercel.app/**`.
2. **Typography Migration (Batch 2)** — Migrate remaining pages (`Calendar`, `Clients`, `Finance`, `Settings`) to new typography components.
3. **Empty state illustrations** — Upgrade text-based empty states to use rich icon/svg illustrations.
4. **Self-serve client booking** — Start Phase 2 discovery.
