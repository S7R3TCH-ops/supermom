# Supermom · Build Tracker

> Single source of truth for what's built and what's next.
> Every new session reads this, picks the top unchecked item, builds it, commits, checks the box.

---

## How to run a new session (copy-paste this opener)

```
Read CLAUDE.md, DESIGN.md, and BUILD.md in that order.

Pick the next unchecked item from the BUILD.md roadmap.
Use the frontend-design skill. Enter plan mode if more than 1 file changes.
Follow existing page patterns exactly — study Home.jsx, ClientProfile.jsx,
Clients.jsx, Finance.jsx. Reuse AmtCell, SectionLabel, and T tokens.
Never hardcode colors. All money goes through AmtCell.

When done:
  1. Run `npx vite build` — must pass clean
  2. Check the box in BUILD.md and add a one-line note
  3. Commit: `feat: <page name>`
```

---

## Session rules (non-negotiable)

- **One page per session.** Start a fresh chat for every item. Token efficiency #1.
- **Model:** Opus 4.7 for building, Sonnet 4.6 for Q&A / small tweaks.
- **Plan mode** on for any item that touches more than 1 file.
- **Read CLAUDE.md + DESIGN.md first** every session. Non-negotiable.
- **Reuse primitives:** `AmtCell`, `SectionLabel`, `useAppTheme` T tokens. Never hardcode hex (except spec colors `#E91E6A`, `#FF78B0`, `#FCD34D`).
- **Mock data** goes in `src/data/*.js` with an ID + helper (`getXById`). Never inline mock data in a page.
- **Build before commit:** `npx vite build` must pass clean.
- **Commit after each page.** Small commits, clear messages.
- **Never break existing pages** — always rebuild and click through Home/Calendar/Clients/Finance before marking done.
- **Soft delete only** — `is_deleted = true`, never hard delete.
- **Always America/Toronto** timezone, never system tz.

---

## Roadmap

### ✅ Phase 0 — Foundation (DONE)
- [x] Design system (DESIGN.md)
- [x] AppTheme context (dark/warm/privacy)
- [x] Logo bar + bottom nav
- [x] `AmtCell`, `SectionLabel`, `CapeUpButton` primitives
- [x] Home page
- [x] Calendar page (Day view)
- [x] Clients list page
- [x] Finance page
- [x] Client Profile page — shared `src/data/clients.js`, tap-navigate from list

---

### 🎯 Phase 1 — Job lifecycle (build next, in this order)

- [x] **1. New Job bottom sheet** — 3 steps (Who → What/When → Review). Shared `src/data/jobs.js`. Per DESIGN.md §12. Opens from FAB or "Book" buttons.
  - Built as `src/components/sheets/NewJobSheet.jsx` + `src/context/NewJobSheet.jsx` + `src/data/jobs.js` + `src/components/ui/FAB.jsx`; global FAB + ClientProfile Book Job wired; conflict detection hits `findConflicts()`.
- [x] **2. Job Detail page** — tap any job (Home / Calendar / Profile) → full view. Shows service, time, client, address, notes, photos, voice note, payment status, timer state.
  - Built as `src/components/sheets/JobDetailSheet.jsx` + `src/context/JobDetailSheetContext.js`. Includes Mark Complete/Paid, Delete Job (soft delete), and Edit mode.
- [x] **3. Edit Job** — built as `EditMode` component inside `src/components/sheets/JobDetailSheet.jsx`; inline edit with series picker (this/future/all).
- [x] **4. Active Job state** — `LiveTimer` component in `src/pages/Home.jsx`; reads from `GeofenceContext`, shows running timer + "Auto-started on arrival".
- [x] **5. Post-job / Payment sheet** — built as `PostJobSheet.jsx` + `PostJobSheetContext.js`; opens from Active Job "Done" (awaits clock-out first) and Job Detail "Mark Paid"; UNPAID badge, Cash/e-Transfer toggle, editable amount, AI thank-you teaser.
- [x] **6. Cancel Job confirm sheet** — confirm + soft-delete flow wired in `JobDetailSheet.jsx` via `initiateDelete` / `onConfirmDelete`.
- [x] **7. Recurrence series editor** — "this / this+future / all" picker built into `EditMode` in `JobDetailSheet.jsx`. Safely implemented in `jobsRepo.js` with date-preservation and status guards.

### 🎯 Phase 2 — Clients

- [x] **8. New Client form** — bottom sheet or page. Name, phone, email, address, recurrence, initial AI context.
  - Built as `src/components/sheets/NewClientSheet.jsx`, opens from Clients page and Who step of NewJobSheet.
- [x] **8.1 Client search** — wire the search bar on Clients page.
  - Implemented as live filtering by name/address in `src/pages/Clients.jsx`.
- [x] **9. Edit Client / AI context** — tap "Edit" on Profile AI card → opens this. Separate editor for each context bucket (prefs/access/comms/personal).
  - Built inline in `ClientProfile.jsx`; "Edit" toggles textareas for Notes, Prefs, Access, Comms, Personal; saves to `clients.notes` + `clients.ai_context` via `updateClient`.

### 🎯 Phase 3 — Calendar expansion

- [x] **10. Calendar Week view** — built in `src/pages/Calendar.jsx`; 7-column grid, color-coded by payment status.
- [x] **11. Calendar Agenda view** — built in `src/pages/Calendar.jsx`; date headers, full job cards.

### 🎯 Phase 4 — AI-powered sheets (Claude API)

- [x] **12. Nudge Draft sheet** — AI-drafted text for overdue client. Opens from Finance Outstanding card or Client Profile. Edit before send.
  - Built as `src/components/sheets/NudgeDraftSheet.jsx`, wired to Finance page "Draft nudges" buttons.
- [x] **13. Thank-you / Receipt draft sheet** — AI-drafted post-job message with "Receipt" toggle. Respects AI Persona style.

  - Built as `ThankYouDraftSheet.jsx` + `api/ai/thank-you-draft.js`; teaser in PostJobSheet replaced with live button; SMS deep-link send, clipboard fallback if no phone.
- [x] **14. Prep Notes generator** — AI summarizes client history (last 5 visits) into prep notes via Claude API. Built as `PrepNoteSheet.jsx` wired to `JobDetailSheet.jsx`.
- [x] **15. Duration Estimator card** — AI-powered in `NewJobSheet.jsx` Step 2. Analyzes history/notes via Claude API to predict duration and explain reasoning.

### 🎯 Phase 5 — Finance

- [x] **16. Expense logging sheet** — category (gas/supplies/other), amount, receipt photo upload.
  - Built as `expensesRepo.js` + `useExpenses()` + `NewExpenseSheet.jsx`; Finance page Expenses stat card (amber) with "+ Add" entry; expenses merged into Recent Activity (amber 🧾 rows). Photos deferred.
- [x] **17. CSV Export flow** — tax-ready export with date range picker.
  - Tax Ready section in Finance.jsx: YTD Income/Deductibles/Mileage/Est.Taxable 2×2 grid, date range pickers, client-side CSV download merging jobs + expenses.

### 🎯 Phase 6 — Settings & onboarding

- [x] **18. Settings page** — Business profile edit (name, phone, email, address, hourly rate) + HST toggle; saves to businesses table.
- [x] **19. Personal Profile** — account info, avatar upload, and digital signature line added to Settings.
- [x] **20. Onboarding flow** — Multi-step first-run walkthrough implemented in OnboardingWalkthrough.jsx.

### ✅ Phase 7 — Auth & backend wiring (DONE)

- [x] **21. Supabase client wiring** — `src/lib/supabase.js`, `src/data/currentBusiness.js`, auth context in `src/context/Auth.jsx`.
- [x] **22. Login page** — email/password via `src/pages/Login.jsx`, Supabase Auth, session gate in `App.jsx`.
- [x] **23. Schema migration** — SQL stored in `supabase_schema.sql` at repo root; live on project `lskzzsjmmtsosfneuovt`.
- [x] **24. Replace mock data with live queries** — all pages (Home, Calendar, Clients, Finance, ClientProfile) query Supabase. Mock data is gone.

### 🎯 Phase 8 — Real services

- [x] **25. Google Calendar OAuth + sync service** — create/edit/cancel events on every job mutation. Built as `/api/auth/google/` and `/api/sync/gcal`.
- [x] **26. Geofence service** — Auto-start timer on arrival (150m), auto-stop on departure (250m for 3min). Uses `navigator.geolocation.watchPosition` via `GeofenceContext`. Active job UI with live timer implemented on Home dashboard. ⚠️ `trackingJobRef` pattern — do not put side effects back inside state updaters (see CLAUDE.md GeofenceContext rules).
- [x] **27. Mileage tracker** — Google Maps Distance Matrix integration (Home -> Job A -> Job B -> Home) via Vercel API proxy (`api/distance.js`, `api/geocode.js`). Estimates stored in `ai_context` for AI voice readiness. GO! buttons deep-link to navigation.
- [x] **27.1 Real-time Subscriptions** — UI auto-refreshes on database changes (jobs, clients, payments, expenses) using Supabase Realtime, filtered by `business_id`. Manager in `src/data/realtime.js`.
- [x] **28. Storage bucket** — Private `job-assets` bucket implemented for photos and voice notes. Secure signed URLs (1hr expiry) generated for viewing/playback. Built-in voice recorder (MediaRecorder API) added to Job Detail sheet.
- [x] **Phase 8 bug fixes (Claude Code)** — DST calc, geofence state updater, updateJob/Client business_id scoping, signout cache clear. See handoff.md for details.

### 🎯 Phase 9 — Polish

- [x] **29. Conflict detection** — `findConflicts()` implemented in jobsRepo.js; integrated into Home Today card and Calendar Day/Agenda views. Uses drive time data + 15m buffer.
- [x] **30. 7-day week strip** on Home (below Today card).
  - Built inline in `Home.jsx`; Mon–Sun, today highlighted dark plum, pink job dots per day.
- [x] **31. Keyboard / accessibility pass** — Focus trap + Escape-to-close on all 8 sheet modals; aria-labels and roles added across core UI components.
- [x] **32. Loading / empty / error states** — every page.
  - Error cards added to Home, Calendar, Finance (using `T.redBg`/`T.redBorder`); `error` destructured from `useJobs()` on all three pages.

### ✅ Phase 10 — Automated Invoicing (DONE)

- [x] **33. Database records** — `invoices` and `invoice_jobs` tables used to file formal records.
- [x] **34. Sequential numbering** — `YYYY-XXX` format with auto-increment within current year.
- [x] **35. Client-facing web view** — Secure, unguessable `/i/:id` route matching the operator's branding.
- [x] **36. Download PDF** — Integrated `window.print()` functionality for clients to save their invoice.
- [x] **37. Post-job automation** — Auto-generation upon completion/payment; integrated preview in PostJobSheet.
- [x] **38. Multi-channel sending** — AI-drafted messages now include invoice links with "Send via SMS" and "Send via Email" options.
- [x] **39. Finance history** — Dedicated "Formal Invoices" list in Finance page with quick-view links.

### ✅ Phase 11 — Robustness & Personalization (DONE)

- [x] **40. Safe API Initialization** — Environment variable validation and internal client initialization for all `api/ai/*.js` endpoints to prevent cold-start crashes (500 errors).
- [x] **41. Dynamic Personalization** — Replaced hardcoded "Sandra" fallbacks with `business.owner_name` in Home, Calendar, and AI briefings; default fallback is "there".
- [x] **42. Field Validation** — Added HTML5 `required` attributes and JS-level validation for critical fields in New Client, New Job, New Expense, and Settings.

---

## Parked / Future Ideas

When you finish an item:
1. Change `[ ]` → `[x]`
2. Add a one-line note after it, e.g.:
   `[x] 1. New Job bottom sheet — built as src/components/sheets/NewJobSheet.jsx, opens from FAB`
3. Commit with message `feat: <item name>`

---

## Parked (don't build yet)

- Start Timer manual button (geofence handles it — only revisit if the operator asks)
- Dark mode toggle UI polish (functionality works, design is fine)
- Self-serve client booking link (Phase 2 product)
- Minxy project (different operator — after Supermom ships)
