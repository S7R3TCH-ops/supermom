# Gemini CLI · Project Instructions

> These instructions are foundational mandates for Gemini CLI. They are read at the start of every session and take precedence over default behaviors.

---

## Session Lifecycle Mandates

### 1. Auto-Documentation
At the end of every productive session, or upon major milestone completion, Gemini MUST:
- **Update `handoff.md`**: Add a new entry detailing changes, technical decisions, and status.
- **Sign Updates**: Every documentation change (in `handoff.md`, `CLAUDE.md`, or `DESIGN.md`) must be clearly marked with `(Updated by Gemini CLI)`.
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

## Current State (as of April 25, 2026 — updated post AI Prep Notes)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live |
| Home — today's schedule + revenue | ✅ Live |
| Calendar — Day/Week/Agenda | ✅ Live |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live |
| **Job Detail sheet** | ✅ **Live** — tap any job card (Home or Calendar) to view/edit/act |
| **AI Prep Notes** | ✅ **Live** — Summarizes last 5 visits via Claude API |
| **AI Duration Estimator** | ✅ **Live** — Step 2 prediction with Claude reasoning |
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
| **Google Calendar sync** | ✅ **Live** — One-way sync (Supermom -> Google); CSRF nonce + multi-tenant `business_id` in OAuth `state` |

## Phase 8 bug fixes (Claude Code session, April 24-25, 2026)

Key stability fixes implemented:

| # | Bug | Fix | File |
|---|---|---|---|
| A | `composeTorontoISO` — Nov 1–6 showed 1hr off | Replaced with `nthSunday()` helper computing exact DST boundary per year | `src/data/jobsRepo.js` |
| B | `GeofenceContext` — duplicate DB writes | Side effects moved outside `setTracking()` updater | `src/context/GeofenceContext.jsx` |
| C | `updateJob`/`Client` — scoping | Added `.eq('business_id', await getCurrentBusinessId())` to all writes | `src/data/jobsRepo.js` |
| D | `signOut` — stale cache | Added `clearBusinessCache()` call before signout | `src/context/Auth.jsx` |
| E | Series Editor — data flattening | Strips `scheduled_date` from series updates; adds `job_status = 'Scheduled'` filter | `src/data/jobsRepo.js` |
| F | `api/sync/gcal.js` — brittle dates | Replaced with pure string arithmetic for end-time calculation | `api/sync/gcal.js` |
| G | `softDeleteJob` — redundant sync | Explicit `triggerGCalSync(id, 'delete')` on delete | `src/data/jobsRepo.js` |

## Job Detail Sheet — architecture notes
- Context: `src/context/JobDetailSheetContext.js` → `useJobDetailSheet()` → `{ openJob, closeJob, jobId }`
- Provider: `src/context/JobDetailSheet.jsx` — wraps AuthedShell in App.jsx
- UI: `src/components/sheets/JobDetailSheet.jsx` (~899 lines) — read mode + edit mode + MediaCard
- Shared catalog: `src/data/services.js` — SERVICES and RECURRENCE (used by NewJobSheet, NewClientSheet, JobDetailSheet)
- Named action handlers: `markComplete`, `markPaid`, `cancelJob`, `saveEdit` — AI voice ready
- `service_name` stored as label (e.g. "Deep Clean") matching NewJobSheet convention
- Mutation errors shown inline; fetch errors replace the sheet body

## Next priorities
1. Expense logging (Finance Phase 5)
2. Thank-you / Receipt draft sheet (AI Phase 4)
3. Edit Client / AI context (AI Phase 3)
