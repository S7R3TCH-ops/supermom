# Scroll Performance Audit — Design Spec
**Date:** 2026-05-06  
**Scope:** Clients, Finance, Calendar pages  
**Expected scale:** 20–100 clients, 100–500 jobs (A–B range)

---

## Problem

All three scroll-heavy pages render their full dataset via plain `.map()` with no memoization on card components and no cap on list length. No virtualization or CSS containment is in place. On low-end Android at B-scale (500 jobs, 12 months of transactions), this causes:

- Finance page: all transactions rendered at once, growing unbounded over time
- Clients page: every search keystroke re-renders all cards
- Calendar: Agenda and Week views re-render all cells on any state change

---

## Approach: Option C — Memoization + Pagination + CSS Containment

No new libraries required. All changes are additive and non-breaking.

---

## 1. React.memo on Card Components

**Files:** `Clients.jsx`, `Finance.jsx`, `Calendar.jsx`

Extract the inline `.map()` render bodies into named memoized components:

| New component | Extracted from | Props |
|---|---|---|
| `ClientCard` | `Clients.jsx` line ~152 | `client`, `onPress`, `theme` |
| `TransactionRow` | `Finance.jsx` line ~340 | `tx`, `onPress`, `theme` |
| `AgendaJobCard` | `Calendar.jsx` line ~512 | `job`, `onDelete`, `onPress`, `theme` |

Each handler passed as a prop gets wrapped in `useCallback` in the parent to preserve referential stability. This prevents all cards re-rendering when search input changes, filter toggles, or theme switches.

**Success criteria:** Changing the search filter in Clients only re-renders cards whose inclusion in the filtered list changed, not all cards.

---

## 2. Finance Pagination

**File:** `Finance.jsx`

The `transactions` array (built from all jobs + expenses ever) is rendered in full. Cap it:

- Default: show the 50 most recent transactions
- "Show N more" button appends the next 50
- Pagination state is local (`useState` in `Finance.jsx`) — no context changes
- The existing `useMemo` filtered/sorted list stays; pagination slices the result: `filtered.slice(0, visibleCount)`
- "Show more" increments `visibleCount` by 50
- If `filtered.length <= visibleCount`, the button is hidden

**Success criteria:** Finance page mounts with ≤50 DOM nodes in the transaction list regardless of total history length.

---

## 3. CSS Scroll Containment

**Files:** `Clients.jsx`, `Finance.jsx`, `Calendar.jsx`

Add `contain` property to the outermost scrolling div in each page:

| Page | Container | Value |
|---|---|---|
| Clients scroll area | Main list wrapper div | `contain: layout style paint` |
| Finance scroll area | Transaction list wrapper div | `contain: layout style paint` |
| Calendar Agenda | Grouped list wrapper div | `contain: layout style paint` |
| Calendar Week grid | Hour grid wrapper div | `contain: strict` (fixed dimensions) |

`contain: layout style paint` tells the browser that layout, style recalc, and paint inside the container don't affect anything outside it. `contain: strict` additionally implies fixed size (safe for the week grid which has known dimensions).

**Safety check:** Bottom sheets are rendered at App level via context/portal — not inside any of these containers — so `position: fixed` scoping is not an issue.

**Success criteria:** No visual regression. DevTools shows reduced repaint regions during scroll.

---

## Out of Scope

- Full list virtualization (react-window etc.) — overkill at A–B scale
- Calendar Week view cell memoization — the `useMemo` on `jobsByDay` already prevents the expensive computation; individual cell memo adds complexity for minimal gain at this scale
- Service Worker / offline caching — separate concern

---

## Implementation Order

1. CSS containment (lowest risk, no logic change)
2. React.memo card components (additive, no behavioral change)
3. Finance pagination (only logic change, isolated to Finance.jsx)
