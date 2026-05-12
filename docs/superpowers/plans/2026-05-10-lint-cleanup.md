# Lint Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve critical linting errors across the codebase to ensure stability, performance, and adherence to React best practices.

**Architecture:** Surgical cleanup of unused variables, refactoring of misplaced hooks, and optimization of `useEffect` state updates to avoid cascading renders.

**Tech Stack:** React, ESLint.

---

### Task 1: Cleanup `src/components/sheets/JobDetailSheet.jsx`

**Files:**
- Modify: `src/components/sheets/JobDetailSheet.jsx`

- [ ] **Step 1: Fix `react-hooks/set-state-in-effect`**
Move `setError(null)` logic or wrap in a condition to avoid synchronous updates on every render of the effect.

- [ ] **Step 2: Remove unused variables**
Remove `amtDisplay`, `mutErr`, `showMathChip`, `hrs`, `T` (if unused in scope), `onCancel`, and `uploading`.

- [ ] **Step 3: Verify with local lint**
Run: `npx eslint src/components/sheets/JobDetailSheet.jsx`

### Task 2: Cleanup `src/data/useData.js`

**Files:**
- Modify: `src/data/useData.js`

- [ ] **Step 1: Address cascading renders in `useEffect`**
Identify why `refresh()` is called synchronously in `useEffect` across multiple hooks (`useClients`, `useClient`, `useInvoices`, etc.). If these are "on-mount" refreshes, consider if they can be triggered differently or if the warning can be safely suppressed if the pattern is intentional for data syncing. However, the mandate is to fix them.

- [ ] **Step 2: Remove unused variables**
Remove unused error variable `e` in catch blocks if applicable.

- [ ] **Step 3: Verify with local lint**
Run: `npx eslint src/data/useData.js`

### Task 3: Cleanup `src/pages/Finance.jsx`

**Files:**
- Modify: `src/pages/Finance.jsx`

- [ ] **Step 1: Remove unused variables and functions**
Remove `updateJob`, `error` (unused assignment), `markPaid`, and `maxBar`.

- [ ] **Step 2: Fix `react-hooks/exhaustive-deps`**
Wrap `now` initialization in `useMemo` or move it inside the effect/memo that uses it to prevent constant re-renders.

- [ ] **Step 3: Address React Compiler warnings**
Investigate the `preserve-manual-memoization` error. It likely relates to `now` being a dependency that changes every render.

### Task 4: Cleanup `src/pages/Home.jsx`

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Remove unused variables**
Remove `e`, `scheduleMsg`, `handleToggleSpeak`, and `err`.

- [ ] **Step 2: Address React Compiler warnings**
Fix the `tightGap` memoization issue by ensuring dependencies are stable.

### Task 5: Cleanup `src/pages/Settings.jsx`

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Remove unused variables**
Remove `toggleMode`, `e`, and `urlError`.

### Task 6: Cleanup `src/data/selectors.js` and `src/components/sheets/EditClientSheet.jsx`

**Files:**
- Modify: `src/data/selectors.js`
- Modify: `src/components/sheets/EditClientSheet.jsx`

- [ ] **Step 1: Check for and fix any lint errors**
(These weren't fully shown in the truncated output but were requested).

### Task 7: Final Verification

- [ ] **Step 1: Run full project lint**
Run: `npm run lint`
Expected: 0 critical errors (warnings may remain if they are non-breaking).
