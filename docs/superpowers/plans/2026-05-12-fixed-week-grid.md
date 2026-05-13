# 7-Day Fixed Grid UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling week strip with a fixed 7-day grid and implement toggle logic for day selection to enable a Weekly Summary mode.

**Architecture:** Use CSS Grid for the 7-day layout and update React state logic in `src/pages/Home.jsx` to handle the `selectedDate` toggle and rendering conditions.

**Tech Stack:** React, CSS Grid, Inline Styles.

---

### Task 1: Update Grid UI and Toggle Logic

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Update `isSelectedToday` and main rendering condition**
Modify the logic so that the "Today" view (Spotlight/Next Up) is shown both when today is explicitly selected AND when no day is selected (Summary mode).

- [ ] **Step 2: Replace Week Strip with Fixed Grid**
Replace the scrolling flex container and navigation buttons with a 7-column grid.

- [ ] **Step 3: Update Day Click Handler**
Implement the toggle logic: if the clicked day is already selected, set `selectedDate` to `null`.

- [ ] **Step 4: Update Day Styling**
Apply `white` background for inactive days and `pink` for selected days as per instructions.

- [ ] **Step 5: Refine "Weekly Summary" visibility**
Ensure `futureWeekGroups` only shows when in Summary mode (`selectedDate === null`) to avoid redundancy.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: implement fixed 7-day calendar grid"
```

---

### Task 2: Verification

- [ ] **Step 1: Check build**
Run `npm run build` or `npm run lint` to ensure no regressions.

- [ ] **Step 2: Manual review of grid layout**
Verify the grid fits well (7 columns).
