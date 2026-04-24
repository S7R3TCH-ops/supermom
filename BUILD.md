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
- [ ] **3. Edit Job** — reuses New Job sheet in edit mode (pass `jobId` prop).
- [ ] **4. Active Job state** — Home Today card variant when geofence triggers. Big running timer, "Auto-started on arrival" label, Voice note / Photo / Done buttons.
- [ ] **5. Post-job / Payment sheet** — UNPAID badge, Cash / e-Transfer pill toggle, Log Payment button. Opens from Active Job "Done" or Job Detail.
- [ ] **6. Cancel Job confirm sheet** — small confirm sheet, soft-deletes.
- [ ] **7. Recurrence series editor** — on edit/cancel of recurring job: "this one / this + future / all" picker.

### 🎯 Phase 2 — Clients

- [x] **8. New Client form** — bottom sheet or page. Name, phone, email, address, recurrence, initial AI context.
  - Built as `src/components/sheets/NewClientSheet.jsx`, opens from Clients page and Who step of NewJobSheet.
- [x] **8.1 Client search** — wire the search bar on Clients page.
  - Implemented as live filtering by name/address in `src/pages/Clients.jsx`.
- [ ] **9. Edit Client / AI context** — tap "Edit" on Profile AI card → opens this. Separate editor for each context bucket (prefs/access/comms/personal).

### 🎯 Phase 3 — Calendar expansion

- [ ] **10. Calendar Week view** — 7-column grid, color-coded cells (pink=unpaid, green=paid, amber=conflict).
- [ ] **11. Calendar Agenda view** — date headers, full job cards with badge set.

### 🎯 Phase 4 — AI-powered sheets (Claude API)

- [x] **12. Nudge Draft sheet** — AI-drafted text for overdue client. Opens from Finance Outstanding card or Client Profile. Edit before send.
  - Built as `src/components/sheets/NudgeDraftSheet.jsx`, wired to Finance page "Draft nudges" buttons.
- [ ] **13. Thank-you / Receipt draft sheet** — AI-drafted post-job message. Opens from Post-job state.
- [ ] **14. Prep Notes generator** — AI summarizes client history into prep notes. Opens from Job Detail.
- [ ] **15. Duration Estimator card** — inline in New Job Step 2. "X hrs based on last N visits."

### 🎯 Phase 5 — Finance

- [ ] **16. Expense logging sheet** — category (gas/supplies/other), amount, receipt photo upload.
- [ ] **17. CSV Export flow** — tax-ready export with date range picker.

### 🎯 Phase 6 — Settings & onboarding

- [ ] **18. Settings page** — service rates, hourly rate, HST toggle, working hours.
- [ ] **19. Sandra's Profile** — account info, avatar, signature line.
- [ ] **20. Onboarding flow** — first-run walkthrough.

### 🎯 Phase 7 — Auth & backend wiring

- [ ] **21. Supabase client wiring** — env vars, supabase-js client, auth hooks.
- [ ] **22. Login page** — email/password, Supabase Auth.
- [ ] **23. Schema migration** — run SQL for all tables from CLAUDE.md.
- [ ] **24. Replace mock data with live queries** — one table at a time (clients → jobs → payments → expenses → config).

### 🎯 Phase 8 — Real services

- [ ] **25. Google Calendar OAuth + sync service** — create/edit/cancel events on every job mutation.
- [ ] **26. Geofence service** — auto-start timer on arrival, auto-stop on departure (3min, 250m).
- [ ] **27. Mileage tracker** — start on GO! tap, log drive to + drive from.
- [ ] **28. Storage bucket** — photos + voice notes for jobs.

### 🎯 Phase 9 — Polish

- [ ] **29. Conflict detection** — real logic (any 2 jobs within 1 hr incl. drive time).
- [ ] **30. 7-day week strip** on Home (below Today card).
- [ ] **31. Keyboard / accessibility pass** — ARIA labels, tab order, focus states.
- [ ] **32. Loading / empty / error states** — every page.

---

## How to mark an item done

When you finish an item:
1. Change `[ ]` → `[x]`
2. Add a one-line note after it, e.g.:
   `[x] 1. New Job bottom sheet — built as src/components/sheets/NewJobSheet.jsx, opens from FAB`
3. Commit with message `feat: <item name>`

---

## Parked (don't build yet)

- Start Timer manual button (geofence handles it — only revisit if Sandra asks)
- Dark mode toggle UI polish (functionality works, design is fine)
- Self-serve client booking link (Phase 2 product)
- Minxy project (different operator — after Supermom ships)
