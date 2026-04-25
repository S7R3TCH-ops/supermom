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

## Current State (as of April 24, 2026 — updated post Claude Code review)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live |
| Home — today's schedule + revenue | ✅ Live |
| Calendar — Day/Week/Agenda | ✅ Live |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live |
| **Job Detail sheet** | ✅ **Live** — tap any job card (Home or Calendar) to view/edit/act |
| **Drive time / mileage** | ✅ **Live** — Google Maps Distance Matrix API proxy |
| **payments table audit row** | ✅ **Live** — mark-paid inserts into `payments` via `recordPayment()` |
| **Client search** (Clients page) | ✅ **Live** — live filter by name/address |
| **Finance nudge buttons** | ✅ **Live** — `NudgeDraftSheet` drafts SMS reminders |
| **Code-split bundle** | ✅ **Live** — `React.lazy` + `Suspense` on all pages |
| **Real-time subscriptions** | ✅ **Live** — Supabase Realtime auto-refresh |
| **Storage bucket** | ✅ **Live** — Photos + Voice Notes in Job Detail |
| **Geofence / auto-timer** | ✅ **Live** — Auto-start/stop with Live Timer card |
| **Google Calendar sync** | ✅ **Live** — One-way sync (Supermom -> Google) |

## Phase 8 bug fixes (Claude Code session, April 24, 2026)

Five bugs were found and fixed after Phase 8 landed. Do not regress these:

| # | Bug | Fix | File |
|---|---|---|---|
| A | `composeTorontoISO` — `(month === 11 && day < 1)` always false; Nov 1–6 showed 1hr off | Replaced with `nthSunday()` helper computing exact DST boundary per year | `src/data/jobsRepo.js` |
| B | `GeofenceContext` — `handleClockIn`, `setTimeout`, `clearTimeout` called inside `setTrackingJob()` updater; React 19 can call updaters multiple times → duplicate DB writes | Added `trackingJobRef` + `setTracking()` wrapper; side effects moved outside updater | `src/context/GeofenceContext.jsx` |
| C | `updateJob` / `updateClient` — no `business_id` scope on UPDATE queries | Added `.eq('business_id', await getCurrentBusinessId())` to both | `src/data/jobsRepo.js`, `src/data/clientsRepo.js` |
| D | `signOut` — never called `clearBusinessCache()`; stale business_id after logout | Added `clearBusinessCache()` call before `supabase.auth.signOut()` | `src/context/Auth.jsx` |
| E | Circular dep — `useData.js` ↔ `realtime.js` import each other | Vite handles this via live bindings; deferred until next touch of either file | `src/data/realtime.js` |

## Job Detail Sheet — architecture notes
- Context: `src/context/JobDetailSheetContext.js` → `useJobDetailSheet()` → `{ openJob, closeJob, jobId }`
- Provider: `src/context/JobDetailSheet.jsx` — wraps AuthedShell in App.jsx
- UI: `src/components/sheets/JobDetailSheet.jsx` (~899 lines) — read mode + edit mode + MediaCard
- Shared catalog: `src/data/services.js` — SERVICES and RECURRENCE (used by NewJobSheet, NewClientSheet, JobDetailSheet)
- Named action handlers: `markComplete`, `markPaid`, `cancelJob`, `saveEdit` — AI voice ready
- `service_name` stored as label (e.g. "Deep Clean") matching NewJobSheet convention
- Mutation errors shown inline; fetch errors replace the sheet body

## Next priorities
1. Google Calendar sync (create/edit/cancel events)
2. AI Prep Notes generator (summarize history)
3. Recurrence series editor (this / future / all)
4. AI Duration Estimator (Step 2 of New Job)
