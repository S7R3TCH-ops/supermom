# Home Page Revenue Logic Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the revenue display in the Hero section of the Home page to correctly reflect the selected date's revenue and memoize the calculation for performance.

**Architecture:** Utilize `useMemo` to compute `displayRevenue` based on whether a date is selected. If no date is selected, show weekly revenue. If a date is selected, show that day's revenue.

**Tech Stack:** React (Hooks)

---

### Task 1: Refactor Revenue Calculation in Home.jsx

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Replace revenueToday and revenueWeek with memoized displayRevenue**

In `src/pages/Home.jsx`, find the lines calculating `revenueToday` and `revenueWeek`. Replace them with a single `useMemo` hook.

```javascript
  // Replace:
  // const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);
  // const revenueWeek = weekJobs.reduce((s, j) => s + Number(j.total || 0), 0);

  // With:
  const displayRevenue = useMemo(() => {
    const jobs = selectedDate ? selectedDateJobs : weekJobs;
    return jobs.reduce((s, j) => s + Number(j.total || 0), 0);
  }, [selectedDate, selectedDateJobs, weekJobs]);
```

- [ ] **Step 2: Update Hero section to use displayRevenue and dynamic labels**

Update the Hero section UI to use `displayRevenue` and ensure the "Projected" vs "Revenue" label logic is consistent with the selected state.

```javascript
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div 
              onClick={openDetail}
              style={{ cursor: 'pointer', padding: '4px 0' }}
            >
              <Text style={{ fontSize: 18, fontWeight: 600, color: mode === 'dark' ? 'white' : T.pink }}>
                {privacyOn ? '•••' : `$${displayRevenue.toFixed(0)}`}
              </Text>
              <Caption style={{ fontWeight: 700, color: mode === 'dark' ? T.pinkLabel : T.pink, textTransform: 'uppercase' }}>
                {!selectedDate ? 'Projected' : 'Revenue'}
              </Caption>
            </div>
          </div>
```

- [ ] **Step 3: Verify the changes**

Ensure there are no lint errors and the logic works as expected.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "fix(home): fix revenue logic bug and memoize calculation"
```
