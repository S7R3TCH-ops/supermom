# Week Date Helpers & State Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `Home.jsx` to support a fixed 7-day grid and Weekly Summary mode by defaulting `selectedDate` to `null`.

**Architecture:** Modify `Home.jsx` state and memoized values to use a Monday-Sunday week range helper.

**Tech Stack:** React (hooks, useMemo).

---

### Task 1: Add getWeekRange helper and update selectedDate state

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Add getWeekRange helper**
    Add the `getWeekRange` function outside the `Home` component.
    
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
    Change `selectedDate` to default to `null`.
    
    ```javascript
    const [selectedDate, setSelectedDate] = useState(null);
    ```

- [ ] **Step 3: Update weekDays useMemo**
    Use `getWeekRange(today)` to populate the grid.
    
    ```javascript
    const weekDays = useMemo(() => {
      return getWeekRange(today);
    }, [today]);
    ```

- [ ] **Step 4: Verify implementation**
    Check that `weekDays` now always returns the current week (Monday to Sunday) and `selectedDate` starts as `null`.

- [ ] **Step 5: Commit**
    ```bash
    git commit -am "feat: update home state and date helpers for weekly summary"
    ```
