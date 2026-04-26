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

## Current State (as of April 26, 2026 — updated post robustness audit)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live |
| Home — today's schedule + revenue | ✅ Live (Robust personalization) |
| Calendar — Day/Week/Agenda | ✅ Live (Robust personalization) |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live (Strict validation) |
| **Job Detail sheet** | ✅ **Live** — tap any job card (Home or Calendar) to view/edit/act |
| **AI Prep Notes** | ✅ **Live** — Robust API error handling + dynamic context |
| **AI Duration Estimator** | ✅ **Live** — Step 2 prediction; fixed syntax error |
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
| **Settings page (#18)** | ✅ **Live** — Business profile edit + strict validation |
| **Sandra's Profile (#19)** | ✅ **Live** — avatar upload + signature field |
| **Onboarding flow (#20)** | ✅ **Live** — `OnboardingWalkthrough` shown on first run |
| **Auto-learning / client intelligence** | ✅ **Live** — Robust API initialization |
| **Conflict detection (#29)** | ✅ **Live** — gap threshold logic |
| **Accessibility pass (#31)** | ✅ **Live** — Focus trap + Escape-to-close on all modals |
| **Automated Invoicing** | ✅ **Live** — sequential numbering + public web view |

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

## Phase 9 robustness fixes (Gemini CLI session, April 26, 2026)

Key personalization and API stability fixes:

| # | Issue | Fix | File |
|---|---|---|---|
| H | "Welcome Sandra" hardcode | Replaced with dynamic `business.owner_name` fallback; default "there" | `Home.jsx`, `Calendar.jsx` |
| I | AI API 500 Errors | Moved Supabase/Anthropic init inside handler; added env var validation | `api/ai/*.js` |
| J | Duration Prompt Syntax | Fixed invalid markdown string syntax in estimate prompt | `api/ai/estimate-duration.js` |
| K | Form Validation | Added `required` attributes and JS validation to critical sheets | `NewClientSheet.jsx`, `NewJobSheet.jsx`, `NewExpenseSheet.jsx`, `Settings.jsx` |

(Updated by Gemini CLI)

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

## Next priorities (as of April 26, 2026 — v0.1.7 deployed)
1. **Live test invoicing flow** — mark a job paid on production, verify VIEW button appears, `/i/:id` renders correctly, SMS/Email prefill works
2. **Live test auto-learning** — after payment, check `clients.ai_context.learned` in Supabase dashboard for `synthesis_note` + `behavioral_flags`
3. **E2E edit flows** — verify edit-job and edit-client flows end-to-end on production data
4. Review any remaining open GitHub issues
5. Future: dark mode UI polish, self-serve client booking link (Phase 2)
