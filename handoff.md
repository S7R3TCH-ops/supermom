# Handoff Report — April 24, 2026 (Night #2)

## Session: Google Maps Integration (Phase 8)
- **Vercel API Proxy:** Created `api/distance.js` to securely proxy Google Maps Distance Matrix API calls. This hides the `GOOGLE_MAPS_API_KEY` on the server and bypasses browser CORS restrictions.
- **Option C Routing Logic:** Implemented `src/lib/maps.js` with `updateDailyRoutes(jobs)`. It calculates travel times and distances for the sequence: Home -> Job 1 -> Job 2 -> ... -> Home.
- **Estimate Storage:** Calculated durations (e.g., "12 mins") and distances are now persisted directly into the `jobs.ai_context` JSON field (`drive_to` and `drive_home` objects). This ensures "AI voice readiness" for future prep notes.
- **Navigation Deep-Linking:** Updated `src/components/ui/CapeUpButton.jsx` to launch Google Maps Navigation (`https://www.google.com/maps/dir/...`) when the "GO!" button is tapped.
- **Auto-Update:** Added a `useEffect` to `Home.jsx` that automatically triggers route recalculation if today's jobs are missing estimates.
- **Data Layer Enhancement:** Updated `src/data/selectors.js` to denormalize `address` and `ai_context` into the job objects consumed by the UI.

---

## Overview
App is fully live. All 5 pages read from Supabase (`lskzzsjmmtsosfneuovt`). Login works. Live site at `supermom-v2.vercel.app` confirmed showing auth + real data. Vercel is connected to GitHub (`S7R3TCH-ops/supermom-v2`) — every push to `main` auto-deploys to production. Schema source of truth: `supabase_schema.sql`. (Updated by Gemini CLI)

---

## What works end-to-end (Supabase-backed)

| Path | Status |
|---|---|
| Login (`/`) | ✅ email/password + **Forgot password** |
| Sign out | ✅ tap avatar (top-right pink bar) |
| Home (`/`) | ✅ today's schedule, **Google Maps drive estimates**, conflict detection, revenue, overdue strip |
| Clients (`/clients`) | ✅ list + NewClientSheet + Search |
| Client Profile (`/clients/:id`) | ✅ upcoming/history from real jobs |
| Calendar (`/calendar`) | ✅ Day/Week/Agenda, conflict detection, **GO button navigation** |
| Finance (`/finance`) | ✅ Week/Month/Year/All, mark-paid, **Nudge Drafts** |
| New Job FAB → NewJobSheet | ✅ books to `jobs` table |
| New Client (inline from NewJobSheet) | ✅ |

---

## Implementation Details (Phase 8)
- **API Key**: Requires `GOOGLE_MAPS_API_KEY` set in Vercel environment variables (and local `.env`).
- **Home Base**: `HOME_ADDRESS` is currently hardcoded to "Georgetown, ON, Canada" in `src/lib/maps.js`.
- **Trigger**: Recruitment of estimates happens on-the-fly when the Home dashboard is loaded and detect missing data.

---

## Next steps (priority order)

### 1. Geofence Service (Phase 8 continued)
Auto-start timer on arrival, auto-stop on departure (3min, 250m).

### 2. Google Calendar OAuth + Sync
Create/edit/cancel events on every job mutation.

### 3. Storage Bucket
Photos + voice notes for jobs.

### 4. Real-time Subscriptions
Refresh UI immediately on DB changes using Supabase Realtime.

---

## Known issues / gotchas
- **CORS**: Direct client-side calls to Google Maps API are blocked; always use the `/api/distance` proxy.
- **API Quota**: `updateDailyRoutes` updates the DB. Be mindful of excessive re-renders triggering multiple writes (added `loading` and `length` checks).
- **Toronto DST math** hardcoded in `jobsRepo.decorateJob` and `NewJobSheet.torontoISO` — wrong on boundary days.
- **Recurrence** stored in `jobs.ai_context.recurrence_rule` — migrate to `job_templates` when that UI ships.

## Key files
- `api/distance.js` — Vercel API proxy
- `src/lib/maps.js` — Distance Matrix & Navigation logic
- `src/components/ui/CapeUpButton.jsx` — Navigation launcher
- `src/data/selectors.js` — Denormalization layer
- `src/pages/Home.jsx` — Auto-trigger for estimates
