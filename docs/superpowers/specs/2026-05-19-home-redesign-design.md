# Home Page Redesign — Design Spec
**Date:** 2026-05-19  
**Status:** Approved

---

## Context

The Home page currently doubles as a week browser (WeekStrip, day picker, week-change navigation) AND a daily command center. This split purpose broke several things: non-today views silently break the spotlight logic, revenue figures show mismatched scopes depending on selected day, and the page is confusing to read at a glance. The Schedule page already handles week/agenda browsing. Home should be a focused, action-oriented daily dashboard Sandra can glance at and immediately know what needs her attention — today and this week.

---

## Design

### Always anchored to today — no week navigation

The WeekStrip, day picker, week-change buttons (‹/›), and the "TODAY" pill are all removed from Home. There is no `selectedDate` state or `weekStart` navigation. Home always shows the real current day and current week.

---

### Section 1 — Live Status Header

Retained from current implementation. Shows:
- "Command Brief" heading
- Dynamic `briefingMsg` (AI-generated or rule-based status message based on today's jobs)
- Projected/today revenue ticker

This is the first thing Sandra sees. It sets context for the day.

---

### Section 2 — Today

**Active Job** (if clocked in): Full spotlight — client name, service badge, LiveTimer, address link, MissionIntel, action buttons (+30 MIN, +COST, WRAP UP). Unchanged from current.

**Next Up**: Prominent deep-rose card with client, service, time range, countdown, drive time, notes, MissionIntel, NAVIGATE / START NOW buttons. Unchanged from current.

**Remaining today**: Any other Scheduled jobs for today (not Active, not Next) shown in a compact, less-prominent list below Next Up. Uses a simpler card style than the Next Up hero — time, client, service, amount. No drive time bar.

**Alert banners** (tight transition, stale attention) retained if applicable.

**Empty state**: Shown when Sandra has nothing scheduled today.

---

### Section 3 — Needs Action (carry-forward)

Any job from any prior date where:
- Status is not `Completed`, OR
- `payment_status` is not `Paid`

Sorted oldest → newest (chronological). These are the jobs Sandra needs to close out — wrap up, collect payment, or both. Uses the existing `attentionItems` / `PaymentBreakdown` card pattern.

**Week rollover behavior**: When a new week starts (Monday), only unresolved jobs carry into this section. Jobs that were completed+paid before the week ended drop off entirely. The section is a persistent catch-all for anything left open.

---

### Section 4 — Rest of This Week

Scheduled jobs for the days remaining in the current week (after today), sorted chronologically. Status must be `Scheduled` — completed, cancelled, and carried-forward past jobs are excluded.

Displayed as compact job cards (time, date label, client, service, amount). No drive time or MissionIntel here — those are Today-only details.

Hidden entirely if today is Sunday or no future jobs exist this week.

---

### Section 5 — Done This Week

Completed + paid jobs from the current Mon–Sun window. Displayed in a muted/subtle visual treatment (lighter color, smaller text, no action buttons) so Sandra can see her weekly progress without it competing for attention.

When the next Monday arrives, this section is empty (those jobs no longer fall in the current week window). No explicit archiving needed — it's purely a date filter.

---

## What is Removed

| Element | Reason |
|---|---|
| WeekStrip | Lives on Schedule page |
| Week-change buttons ‹/› | Not needed on action dashboard |
| Day picker / selectedDate state | Home is always today |
| "TODAY" pill | No longer needed |
| "Weekly Summary" hero mode | Replaced by always-on Command Brief |
| Non-today date view (swipeable JobCard list) | Lives on Schedule / Calendar |

---

## Files to Modify

- `src/pages/Home.jsx` — primary change; remove week navigation state and non-today rendering path; reorganize sections per spec
- `src/components/cards/JobCard.jsx` — may need a `compact` or `subtle` variant for "Done This Week" muted treatment
- `src/components/ui/WeekStrip.jsx` — no changes; just no longer imported by Home

## Reuse

- `attentionItems` derived list — same filter logic, just rendered in its own named section
- `computeJobFinancials()` from `src/lib/financialMath.js` — all amounts
- `LiveTimer`, `MissionIntel`, `PaymentBreakdown`, `UpcomingCard`, `EmptyState` — all retained
- `briefingMessages.js` — Command Brief message logic retained

---

## Verification

1. `npm run dev` — open Home on mobile viewport (390px)
2. Confirm Command Brief renders at top with today's status message
3. If a job is active (clocked in): spotlight shows, LiveTimer ticks
4. Next Up card renders for the next scheduled today job
5. Remaining today jobs appear below Next Up in compact form
6. Navigate to Schedule page — confirm week picker still works there (regression check)
7. Jobs from prior weeks with open status appear in Needs Action
8. Future jobs this week appear in Rest of Week, sorted by date/time
9. Completed+paid jobs from this week appear subtly at bottom
10. On a day with no jobs: Empty state shows, no broken sections
