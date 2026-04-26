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

## Phase 12 Platform Reset & Hierarchy (Gemini CLI session, April 26, 2026)

Key architectural changes to support the platform/client model:

| # | Change | Detail | File |
|---|---|---|---|
| AC | Platform Reset Script | New script to wipe client data but preserve Super Admin (Joel) | `scripts/reset-platform.mjs` |
| AD | Sandra Provisioning | New script to set up Sandra as a client of the platform | `scripts/provision-sandra.mjs` |
| AE | Null Business Support | Updated data hooks to not crash when business_id is null (for global admins) | `src/data/currentBusiness.js`, `src/data/useData.js` |
| AF | Admin Navigation | Profile button now goes to `/admin` for Super Admins | `src/components/layout/LogoBar.jsx` |

(Updated by Gemini CLI)

## Next priorities (as of April 26, 2026)
1. **Live test viewpoint switching** — Log in as Joel, go to `/admin`, switch to Sandra's business, and verify you see a clean slate.
2. **Onboard Sandra's first client** — While in Sandra's viewpoint, try adding a new client and job to verify the "fresh start" flow works.
3. **Configure Supabase redirect URL allowlist** — add `http://localhost:5173/**` and `https://supermom-v2.vercel.app/**` so password reset emails work.
4. Future: dark mode UI polish, self-serve client booking (Phase 2).
