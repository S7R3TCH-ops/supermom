# Design Doc: Supermom Spirit, UI Polish & Service List Bug Fix

**Date**: April 27, 2026
**Author**: Gemini CLI
**Status**: Approved (Design Concepts)

## 1. Problem Statement
The application currently feels "sterile" in Light Mode and on empty Home states. Greetings are repetitive and sometimes logically awkward (e.g., "Ready, Sandra?" when no jobs are left). Additionally, a critical bug prevents services from appearing in the edit dropdown in `JobDetailSheet`.

## 2. Goals
- Inject "Supermom Spirit" through dynamic, persona-aware AI greetings.
- Refine Home page grouping logic to prevent "empty box" syndrome (3-Job Rule).
- Standardize and enhance status visibility in Light Mode (Aesthetic Pop).
- Fix the `useServices` hook to correctly filter by `business_id`.

## 3. Detailed Design

### 3.1 AI Greetings & "Command Brief" Logic
- **Dynamic Closers**: Update `getTimeBasedGreeting` in `src/lib/greetings.js` to use a randomized pool of closers (e.g., "Go crush it!", "Coffee first, then world domination.") instead of just "Ready, Sandra?".
- **Conditional Logic**: Only append a closer if `hasJobsLeft` is true. If false, use a celebratory "Mission Accomplished" style message.

### 3.2 Smart Grouping (The "3-Job Rule")
- **Logic**: In `src/pages/Home.jsx`, if `categorizedJobs.upcoming`, `done`, or `incomplete` has 3 or fewer items, the `SectionLabel` for that group will be hidden.
- **Visuals**: The list will flow naturally without being interrupted by headers for small counts.

### 3.3 Visual Pop & Status Stand-out (Light Mode)
- **Unpaid Jobs**: Enhance `JobCard` to show a bold Amber left border (`#F59E0B`) and a subtle background glow (`#FEFDF0` in light mode).
- **Paid Jobs**: Use a vibrant Emerald Green (`#22C55E`) accent.
- **Hero Section**: Add a subtle decorative pattern (CSS-based dots or sparkles) to the hero background to make it feel premium.

### 3.4 Empty States with "Spirit"
- **Dynamic Content**: When the schedule is clear, replace "Schedule clear" with persona-based messages:
    - *Casual*: "The world is safe for now! Tactical nap? I won't tell."
    - *Coach*: "All missions accomplished! Go get that glass of wine."
- **Icons**: Include contextually relevant emojis (🦸‍♀️, ☕, 🍷).

### 3.5 Service List Bug Fix
- **Root Cause**: `useServices` in `src/data/useData.js` fetches all active services but lacks a `.eq('business_id', bid)` filter.
- **Fix**: Update the hook to resolve the current `business_id` before fetching.

## 4. Technical Implementation
1. **Modify `src/lib/greetings.js`**: Add `CLOSERS` pool and update `getTimeBasedGreeting`.
2. **Modify `src/data/useData.js`**: Update `useServices` to include `business_id` filtering.
3. **Modify `src/pages/Home.jsx`**:
    - Implement the "3-Job Rule" in the rendering logic.
    - Update empty state messages with richer content/icons.
    - Enhance `JobCard` styling for unpaid/paid statuses.
4. **Modify `src/lib/tokens.js`**: (Optional) Refine amber/green tokens for better pop.

## 5. Verification Plan
- **Manual Test**: Check Home page with 1 job, 2 jobs, and 4 jobs to verify grouping logic.
- **Manual Test**: Toggle between Dark/Warm modes to verify status color "pop".
- **Manual Test**: Open `JobDetailSheet`, click Edit, and verify the Service dropdown is populated.
- **Automated Test**: Add a test case to `happy-path.spec.ts` for verifying service loading in edit mode.
