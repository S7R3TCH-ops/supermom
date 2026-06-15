---
timestamp: 2026-06-12T15-44-18Z
slug: src-pages-calendar-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | GCAL pill + badge system clear; no skeleton loading or week-transition animation |
| 2 | Match System / Real World | 3 | Plain language throughout; "⚠ HOURS NEEDED" badge reads as internal/operational language |
| 3 | User Control and Freedom | 2 | Native `window.confirm` for delete; no in-app undo path; no uncancel affordance |
| 4 | Consistency and Standards | 3 | Badge system and card styling well-aligned to DESIGN.md; hero border-bottom absent in light mode |
| 5 | Error Prevention | 2 | Soft delete exists; delete confirm exists but via native dialog; no pre-booking conflict prevention visible |
| 6 | Recognition Rather Than Recall | 3 | All job state visible in cards; DIRECTIONS button discoverable; swipe-to-delete has zero affordance |
| 7 | Flexibility and Efficiency | 2 | Day-tap filter and week swipe are good accelerators; no quick actions on cards (log payment, call client) |
| 8 | Aesthetic and Minimalist Design | 3 | Clean density overall; badge overflow (5+ on one card) is a real risk |
| 9 | Error Recovery | 1 | Delete failure uses `alert()` — native dialog, no in-app recovery path |
| 10 | Help and Documentation | 1 | No contextual help, no gesture onboarding, no GCAL pill tooltip |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** No, not strongly. The badge system, semantic coloring, and conflict detection feel deliberate and earned. The overall aesthetic is consistent with the established DESIGN.md system.

**LLM assessment:** The design avoids the most common AI tells: no gradient text, no glassmorphism-as-default, no identical card grids, no side-stripe borders. The "kick-ass Mary Poppins" register is present — warm but operational, not toy-like. The 7-day strip swipe with cubic-bezier snap animation shows real craft. The biggest tell is the `window.confirm` / `window.alert` pair — these are developer-default patterns that break the custom design language every time they fire. A designed confirmation state would cost one afternoon and would make the app feel 30% more polished overnight.

**Deterministic scan:** Detector returned zero findings on `src/pages/Calendar.jsx` — no automated anti-patterns detected.

---

## Overall Impression

This is the strongest of the three pages critiqued so far — a functioning, semantically rich schedule view that does real work. The NEXT UP badge creates a clear daily anchor, the conflict detection is genuinely useful, and the week swipe gesture is a standout moment of craft. The two problems that need fixing are the native dialog pattern (all browser alerts/confirms must go) and the tap target sizes on the hero navigation, both of which undercut the trust this page has otherwise earned.

---

## What's Working

**1. Semantic badge system.** The full 4-state coloring (scheduled / unpaid-completed / paid / cancelled) plus the recurrence, conflict, and directional badges gives Sandra an instant visual read on her week's financial and logistical state. The decision to use ambers for "needs attention" and greens for "closed" is exactly right for the ops register.

**2. Day-filter accelerator.** Tapping a day in the WeekStrip filters the agenda to that day and shows the chip with a dismiss ×. This is a clean, no-modal shortcut that lets Sandra quickly focus on "what's today" without losing context of the week above. The solid-pink active chip vs. muted inactive chip communicates state immediately.

**3. Week swipe with cubic-bezier snap.** The `cubic-bezier(0.2, 0.8, 0.2, 1)` snap at 380ms with haptic feedback on commit is a premium mobile detail. The three-panel track pattern (prev / current / next) handles the carousel without any jank. This is the kind of moment that makes the app feel native.

---

## Priority Issues

### [P1] Navigation arrows are 22×22px — unreliable tap targets
**What:** The `‹` / `›` week-navigation buttons in the hero are `width: 22, height: 22` — half the 44×44px minimum for mobile tap targets.  
**Why it matters:** Sandra uses this app one-handed between jobs. A missed tap on a 22px target is a routine failure, not an edge case. On the Pixel she's already on a sub-optimal screen size for small targets.  
**Fix:** Wrap in a larger transparent hit area or increase to `min-width: 44px, min-height: 44px` with the visual element centered inside. The `TODAY` button also needs a larger hit area — its `padding: 3px 7px` resolves to roughly 25–30px tall.  
**Suggested command:** `$impeccable polish`

### [P1] `window.confirm` / `window.alert` break the design language
**What:** `handleDeleteJob` uses `window.confirm('Delete this job?')` for confirmation and `alert('Could not delete job.')` for errors. Both fire native browser dialogs.  
**Why it matters:** On mobile, native dialogs look like system-level warnings ("is this app crashing?"). They are off-brand, jarring, and non-dismissable via swipe. Sandra is a non-technical user — a native browser alert is exactly the kind of surprise that erodes trust in a tool she relies on.  
**Fix:** Replace both with in-app patterns. Confirmation: a small toast or inline card swap with a red "Confirm delete" / "Cancel" pair. Error: a transient toast or an inline error card that disappears after 3 seconds. Both are 30-minute jobs.  
**Suggested command:** `$impeccable polish`

### [P2] Loading state is bare text, not a skeleton
**What:** During `loading`, the page shows `<div>Loading…</div>` in `T.inkMuted` — no skeleton, no visual shape of what's about to appear.  
**Why it matters:** On Sandra's phone with any latency, the page flashes from the hero header to a bare text string then snaps to a full list. This creates a jarring layout shift and looks unfinished against the premium hero above it.  
**Fix:** A 3-item skeleton agenda — 1 date header placeholder + 2 card-shaped pulse placeholders (the same pattern used on Finance). Matches the established skeleton pattern in the app.  
**Suggested command:** `$impeccable polish`

### [P2] Swipe-to-delete has no visual affordance
**What:** The `Swipeable` wrapper enables swipe-to-delete on every job card. There is no visual hint — no trailing edge indicator, no "swipe to delete" label on first use, no gentle reveal animation.  
**Why it matters:** Sandra will never discover this gesture without being told. A hidden power feature that bypasses the only safe delete path (`window.confirm`) is a liability if discovered accidentally.  
**Fix:** Two options: (a) add a subtle red-tinted left-reveal behind the card on first swipe, with a trash icon appearing as the reveal grows — making the gesture affordance obvious. Or (b) remove swipe-to-delete entirely and rely on the job detail sheet for deletion. Given Sandra's UX profile ("no surprises"), option (b) is the safer call unless the gesture has explicit demand.  
**Suggested command:** `$impeccable polish`

### [P2] No conflict banner at page level — only badge-level
**What:** DESIGN.md specifies "Conflict banner (amber) if any jobs within 1hr of each other" — a full-width banner in the agenda area. Currently conflicts are only indicated via the `⚠ <1HR GAP` badge on individual cards. The top-level banner does not exist.  
**Why it matters:** Sandra may not notice a conflict badge buried in a 5-badge row. A top-level amber banner saying "2 jobs overlap this week — check Tuesday" puts the issue at the right level of visibility.  
**Fix:** After the scope chip row, conditionally render an amber banner: `⚠ 2 jobs may overlap — check {day names}`. Tap to filter to the conflict day. This is roughly 20 lines of JSX.  
**Suggested command:** `$impeccable polish`

---

## Persona Red Flags

### Sandra (Solo Operator, Supermom's primary user)
The primary project-specific persona: non-technical, uses app mid-task, one-handed, won't report bugs.

- Accidentally swipes a job card → sees a delete affordance she didn't expect → panics and doesn't know if she just deleted it → closes the app
- Taps ‹ week nav on a bumpy car ride → misses the 22px target three times in a row → uses Google Calendar directly instead ("the app is fiddly")
- A native `window.confirm` fires → Sandra reads "This page says: Delete this job?" with the domain in the dialog title → unclear if this is the app or the phone → hesitates, possibly cancels on instinct
- Sees "⚠ HOURS NEEDED" badge → unclear what action is being requested; "hours needed for what?" → taps the card to see if it explains itself (it does, in the job detail) → correct behavior, but the badge copy could be clearer: "LOG HOURS" would be unambiguous

### Casey (Distracted Mobile User)
Closest predefined persona match for Sandra's real-world usage pattern.

- Hero nav buttons at 22×22px: regular miss rate on-the-go. Expects a response, taps again → double-fires → unexpected week skip
- `TODAY` button tap area too small with padding `3px 7px` — likely to miss and hit the GCAL pill or month label instead
- App is mid-task; gets a phone call; returns to the Schedule page. The week filter state is preserved (week navigation is persistent). This is good. But if she had a day filter active, it persists across navigation away and back — may be confusing on return

### Sam (Accessibility-Dependent User)
- WeekStrip day cells have no `aria-label`. A screen reader announces the date number only, no weekday, no "has jobs" information
- Navigation arrows `‹` / `›` have no accessible label — screen reader announces nothing or the raw entity
- State conveyed via card border color alone in some cases (the border changes but no text label for "is next job" state beyond the badge — badge is present, so this is acceptable)
- DIRECTIONS button: `↗ DIRECTIONS` — the arrow character may be read as "northeast" or silently skipped by some screen readers; add `aria-label="Get directions to {address}"` for safety

---

## Minor Observations

- **"Today · Friday, Jun 6"** — "Friday" is redundant when you already said "Today". Cleaner: "Today, Jun 6" or just "Today" with the date shown elsewhere.
- **Week summary row text sizes** (10.5px, weight 600) — the Collected/Owed/Booked labels and amounts share equal weight. The "Owed" value (orange) is the most actionable but gets no visual priority. Consider making the Owed amount slightly larger or bolder when it's non-zero.
- **Empty state has no CTA.** "No jobs this week." ends with nothing to do. Even a subtle "Tap + to add a job" link would be more useful than a static message.
- **`job.total` rendered raw** (`$${job.total}`) — if `total` is `null` or an un-formatted float, this will show "$" or "$45.5" instead of "$45.50". Should use a format helper.
- **The light-mode hero border-bottom is omitted** (`borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none'`) — DESIGN.md says the 3px border is what separates a dark hero from the pink logo banner. In light mode the hero is presumably the pink gradient (same as the banner above), which is a direct violation of "Never show a pink section directly touching the pink banner." Check what `T.hero` resolves to in light mode.
- **Inter weight 800 used in WeekStrip home variant** (`fontWeight: 800` for weekday name and date number). Inter is loaded at weights 400/500/600/700 per DESIGN.md. Weight 800 is not in the load set — the browser falls back to 700. Not broken, but unintentional. Change to 700.

---

## Questions to Consider

- "Should the Schedule page offer any quick actions directly on the agenda card — log payment, call client — or is the tap-to-detail pattern sufficient for Sandra's real workflow?"
- "The conflict detection is drive-time-aware. Does Sandra know that? Is there value in surfacing the conflict logic briefly ('Based on 25min drive time, this gap is too tight') or does that add complexity she doesn't want?"
- "The 'Whole week' scope chip does nothing when tapped. Should it open a date picker or week picker for quick navigation, or is the week strip the only navigation surface?"
