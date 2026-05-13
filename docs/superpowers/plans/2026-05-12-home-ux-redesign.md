# Home UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Home page into a high-performance weekly command center with fixed navigation and summary modes.

**Architecture:** Update `Home.jsx` state management to support a \"Summary\" mode (null `selectedDate`). Introduce a fixed 7-day grid. Update `NewJobSheet` to support deep pre-filling for duplication.

**Tech Stack:** React, CSS Grid, existing project tokens.

---

### Task 1: Week Date Helpers & State Update
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Add getWeekRange helper**
Add a helper to find the Monday and Sunday of the current week.
```javascript
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const mon = new Date(d.setDate(diff));
  mon.setHours(0,0,0,0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return days;
}
```
- [ ] **Step 2: Update selectedDate state**
Change `selectedDate` to default to `null` (Weekly Summary mode).
- [ ] **Step 3: Update weekDays useMemo**
Use `getWeekRange(today)` to populate the grid.
- [ ] **Step 4: Commit**
`git commit -am \"feat: update home state and date helpers for weekly summary\"`

### Task 2: 7-Day Fixed Grid UI
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Implement CSS Grid Navigation**
Replace the scrolling week strip with a fixed `display: grid; grid-template-columns: repeat(7, 1fr)`.
- [ ] **Step 2: Update Day Click Logic**
Toggle selection: If clicking the already selected day, set `selectedDate` to `null`.
- [ ] **Step 3: Commit**
`git commit -am \"feat: implement fixed 7-day calendar grid\"`

### Task 4: Weekly Summary Filtering & Hero
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Update Hero Section**
If `!selectedDate`, show the \"WEEKLY SUMMARY\" hero with projected revenue.
- [ ] **Step 2: Update categorizedJobs logic**
If `!selectedDate`, filter `allJobs` for the entire Mon-Sun range and group by status (Unpaid/Upcoming/Completed).
- [ ] **Step 3: Commit**
`git commit -am \"feat: implement home weekly summary mode\"`

### Task 5: Duplicate Mission (NewJobSheet Prefill)
**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Update NewJobSheet to accept prefillData**
Allow the sheet to accept an object of pre-filled values (`serviceId`, `duration`, `notes`, `recurrence`).
- [ ] **Step 2: Update handleBook for prefill**
Ensure prefilled fields are correctly initialized in state.
- [ ] **Step 3: Commit**
`git commit -am \"feat: support pre-filling for job duplication\"`

### Task 6: JobCard Copy Button & Mini-Spotlight
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Update JobCard UI**
Add a small \"Copy\" icon button for completed jobs.
- [ ] **Step 2: Implement handleDuplicateJob**
Open `NewJobSheet` with data from the clicked job.
- [ ] **Step 3: Add Mini-Spotlight label**
Add the subtle \"Next up: [Time]\" text near the calendar when `selectedDate` is not today.
- [ ] **Step 4: Commit**
`git commit -am \"feat: add job duplication and mini-spotlight\"`
