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

## Current State (as of April 25, 2026 — updated post auto-learning session)

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
| **Post-job / Payment sheet** | ✅ **Live** — UNPAID badge, Cash/e-Transfer toggle, editable amount, AI thank-you teaser |
| **Edit Client / AI context** | ✅ **Live** — Inline edit on Profile "What I know" card; Notes + Prefs/Access/Comms/Personal buckets |
| **7-day week strip** | ✅ **Live** — Mon–Sun on Home, today dark plum pill, pink job dots |
| **Loading / error states** | ✅ **Live** — Error cards added to Home, Calendar, Finance |
| **Thank-you / Receipt sheet** | ✅ **Live** — AI-drafted messages with "Receipt" toggle; respects AI Persona style |
| **Expense logging** | ✅ **Live** — NewExpenseSheet (5 categories); Finance Expenses stat card + Recent Activity amber rows |
| **CSV Export / Tax Ready** | ✅ **Live** — Finance Tax Ready section: YTD stats + date range picker + CSV download |
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
| **Settings page (#18)** | ✅ **Live** — Business profile edit (name, phone, email, address, hourly rate) + HST toggle; saves to `businesses` table |
| **Sandra's Profile (#19)** | ✅ **Live** — "Personal Profile" section in Settings: avatar upload (job-assets bucket via `uploadAsset()`), signature field stored in `ai_profile.signature` |
| **Onboarding flow (#20)** | ✅ **Live** — `OnboardingWalkthrough` shown on first run; gated on `ai_profile.onboarding_complete`; completion persisted to DB |
| **Auto-learning / client intelligence** | ✅ **Live** — After each payment, fires `POST /api/ai/enrich-client` (fire-and-forget). Computes duration patterns, payment preference, preferred time/day in pure JS, then calls Claude Haiku (150 tokens) for `synthesis_note` + `behavioral_flags`. Stored in `clients.ai_context.learned`. Feeds prep notes, duration estimates, and command brief automatically. Gates: skip if <2 jobs, skip if <24h + <3 new jobs. |
| **Conflict detection (#29)** | ✅ **Live** — `findConflicts()`, Home `tightGap`, Calendar `findSameDayConflicts` all use `ai_context.drive_to.durationValue` as gap threshold (driveMin + 15 buffer); falls back to 60 min when drive data absent |
| **Accessibility pass (#31)** | ✅ **Live** — Focus trap + Escape-to-close on all 8 sheet modals; `aria-label` on LogoBar buttons; `aria-hidden` on decorative nav icons; `aria-pressed` on filter chips; `role="radio"` + `aria-checked` on toggle groups; `<label htmlFor>` on all form inputs; `aria-live` on status messages |
| **Automated Invoicing** | ✅ **Live** — Sequential `YYYY-XXX` numbering; unguessable public `/i/:id` web view; auto-generation on job completion; integrated SMS/Email sending with AI drafts |

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

## Auto-learning architecture notes
- Trigger: `recordPayment()` in `src/data/jobsRepo.js` → `triggerLearningEnrichment(clientId)` (fire-and-forget, same pattern as `triggerGCalSync`)
- Endpoint: `api/ai/enrich-client.js` — service-role Supabase + Anthropic, POST-only
- Schema: `clients.ai_context.learned` — `{ version, last_enriched_at, last_enriched_job_count, duration_patterns, payment_method_preference, preferred_time_of_day, preferred_day_of_week, behavioral_flags, synthesis_note }`
- `actual_duration` stored in DB as decimal hours — multiply × 60 for minutes
- Consumers: `generateCommandBrief()` (ai.js), `/api/ai/prep-notes.js`, `/api/ai/estimate-duration.js`
- Bug fixed: `prep-notes.js` was selecting `client_notes` (wrong column); now `notes + ai_context`
- Bug fixed: `estimate-duration.js` was treating `actual_duration` (hours) as minutes in prompt; now × 60

## Next priorities
1. Test auto-learning with seed data; verify `ai_context.learned` populates in Supabase after payment
2. Review any remaining open GitHub issues
3. Phase 8 monitoring: Google Calendar sync and Geofence reliability in the field
4. Future: dark mode UI polish, self-serve client booking link (Phase 2)
