# Design Spec: Home UX Redesign

> **Topic:** Improving Home page navigation, filtering, and job management.
> **Date:** 2026-05-12
> **Status:** Draft

## 1. Overview
The current scrolling week strip is non-functional and visually broken. This redesign replaces it with a fixed 7-day grid and introduces a \"Weekly Summary\" mode as the default Home state.

## 2. UI Components

### A. 7-Day Calendar Grid (Mon–Sun)
- **Layout:** A fixed `display: grid; grid-template-columns: repeat(7, 1fr)` layout.
- **Behavior:**
    - Standard Monday through Sunday of the current week.
    - Clicking a day filters the list to that specific day.
    - Clicking an already selected day deselects it, returning to \"Weekly Summary\" mode.
- **Styling:**
    - `white` background with `pink-border` for inactive days.
    - `pink` background for the currently selected day.
    - A dark plum pill for \"Today\" if it is NOT the selected day.

### B. Dynamic Hero Section
- **Mode 1: Weekly Summary (Default)**
    - Displays \"✦ WEEKLY SUMMARY\".
    - Title: \"Your week at a glance\".
    - Meta: Projected revenue and total job count for the current Mon–Sun week.
- **Mode 2: Daily View**
    - Displays the standard \"✦ COMMAND BRIEF\".
    - Title: Person-aware greeting (e.g., \"Good Morning, Sandra\").
    - Meta: Daily status message.

### C. The Mini-Spotlight
- When viewing a day other than \"Today\", the large pulsing Spotlight is hidden.
- A subtle \"Next up: [Time]\" label is added to the top of the job list or near the calendar grid to maintain time awareness.

### D. Job List Filtering & Grouping
- **Weekly Summary Mode:**
    - Group 1: \"Needs Attention\" (Completed but Unpaid jobs from the past week).
    - Group 2: \"Upcoming This Week\" (All remaining scheduled jobs for the week).
    - Group 3: \"Completed This Week\" (Paid jobs).
- **Daily View:**
    - Shows all jobs for the selected day, sorted by time.

### E. \"Duplicate Mission\" Feature
- **UI:** A \"Copy\" or \"Duplicate\" icon added to `JobCard` for completed jobs.
- **Behavior:** Tapping opens `NewJobSheet` with:
    - `clientId`, `serviceId`, `duration`, `notes`, and `recurrence` pre-filled from the source job.
    - User only needs to select the new `date` and `time`.

## 3. Technical Changes
- **Date Logic:** Use a helper to calculate the start (Monday) and end (Sunday) of the current week.
- **Filtering:** Update the `useMemo` hooks for `todayJobs` and `categorizedJobs` in `Home.jsx` to respect the `selectedDate` (or lack thereof for Summary mode).
- **NewJobSheet Prefill:** Extend `NewJobSheet` to accept a `sourceJobId` or full pre-fill payload via context/props.

## 4. Design Compliance
- Grid must fit within the `390px` mobile viewport without scrolling.
- All colors must use established `--pink`, `--plum`, and `--ink` tokens.
