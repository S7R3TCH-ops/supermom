# Design Spec: Phase 25 Feature Restoration

> **Topic:** Restoring 6 core features removed during Phase 25 cleanup and fixing NewJobSheet data fetching.
> **Date:** 2026-05-12
> **Status:** Draft

## 1. Overview
This project restores critical operational features lost during a stabilization cleanup. The goal is to return to 100% design compliance while maintaining the 0.5.1 lint-free code quality.

## 2. Features to Restore

### A. Conflict Detection & Resolution (NewJobSheet.jsx)
- **Logic:** Re-import `findConflicts` from `jobsRepo.js`. Fetch `activeJobs` on mount and store in `jobRows` state.
- **Trigger:** Calculate overlaps in Step 2.
- **UI:** A visual warning showing \"Gap vs Drive Time\".
- **Strict Confirmation:** A checkbox with playful text: \"Taking chances and driving fast? Confirm anyway.\"
- **Booking Guard:** \"Book It\" button disabled until checkbox is ticked IF a conflict exists.

### B. Live Timer (Home.jsx)
- **Logic:** Restore `LiveTimer` sub-component. Use `setInterval` (1s) to track elapsed time since `activeJob.ai_context.clock_in_time`.
- **UI:** Display formatted `HH:MM:SS` inside the HAPPENING NOW card.

### C. AI Voice Briefing (Home.jsx)
- **Logic:** Re-import `generateCommandBrief`, `speakBrief`, and `stopSpeaking` from `data/ai.js`.
- **UI:** Restore \"Read Aloud\" button on MISSION READY card with `isSpeaking` state management.

### D. Booking Validation (NewJobSheet.jsx)
- **Logic:** Re-add explicit per-field validation in `handleBook`.
- **UI:** `setBookErr()` with specific messages like \"Please select a client\" instead of silent returns.

### E. AI Persona Messages (Home.jsx)
- **Logic:** Restore `persona` prop on `EmptyState`.
- **UI:** Use persona-specific message variants (Casual/Coach/Professional) for schedule empty states.

### F. 3-Step Booking Flow (NewJobSheet.jsx)
- **UI:** Restore Step 3 Review screen showing math breakdown (`X hrs x $Y = $Z`) and final confirmation.

## 3. Technical Fixes
- **NewJobSheet Data Fetching:** Ensure `Promise.all([fetchClients(), fetchActiveJobs()])` correctly populates `clientRows` AND `jobRows`.

## 4. Canonical Import Verification
- `addDays`, `sameDay`: Inline in `Home.jsx`
- `findConflicts`, `composeTorontoISO`: `src/data/jobsRepo.js`
- `speakBrief`, `generateCommandBrief`: `src/data/ai.js`
- `useKeyboardFocus`: `src/hooks/useKeyboardFocus.js` (Named export)

