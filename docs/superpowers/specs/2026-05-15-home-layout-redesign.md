# Home Screen Layout Redesign
**Date:** 2026-05-15  
**Status:** Approved — pending implementation plan

---

## Goal

Replace the current home screen (which defaults to a weekly summary with an inconsistent job list) with a clear 3-zone layout that always centres Sandra's most urgent item — the next job — and surfaces anything she's fallen behind on immediately below it.

---

## Default Behaviour Change

- `selectedDate` initializes to `today` (not `null`) — home loads in today view by default
- The week strip highlights today on load
- Weekly summary mode (no date selected) is removed as the default — it only appears when a non-today day is tapped
- Tapping today in the strip while another day is selected returns to today's 3-zone view
- Revenue in the header shows today's total when today is selected; week total when a non-today day is viewed

---

## Today View — 3-Zone Layout

### Zone 1 · Today's Schedule

A visually grouped container (deep pink border, subtle tinted background) that holds the entire day's upcoming work.

**Next Up hero card (top of Zone 1)**
- The single most prominent element on the screen
- Color: deep rose — `#B5004E` (darker than the app's standard `#E91E6A` pink, rich and bold but not garish)
- Complementary color alternative to A/B test: deep teal `#00695C` — warm contrast against rose, strong without competing
- Contents:
  - Client name (large serif, ~28px)
  - Service name (uppercase label)
  - Start–end time (monospace, prominent)
  - **Drive time row**: shows Google Maps estimated drive duration + NAVIGATE button (opens Maps). Shows "🚗 calculating…" if not yet loaded, hidden if no address on job.
  - **Job notes**: shows `job_notes` and/or `prep_note` if present — same MissionIntel card style, below drive row
  - START NOW button (full width, deep rose)
  - READ BRIEF button (small, inline with section label)
- If a job is actively clocked in (Mission Active), it takes the top spot instead; Next Up appears below it inside Zone 1

**Remaining today jobs (below hero, still in Zone 1 container)**
- All future-scheduled jobs for today that aren't the Next Up job
- Blue color scheme: border `#1565C0`, background `rgba(21,101,192,0.07)`, status badge blue
- Standard JobCard layout (client name, service, time, duration)
- Label: "COMING UP TODAY" in blue

**When today has no upcoming jobs**
- Zone 1 shows the empty state illustration with persona-appropriate message
- Completed today jobs are NOT shown on home screen (see Zone 3 note)

---

### Zone 2 · Needs Attention

Amber zone. Appears below Zone 1. Persists until Sandra explicitly wraps up or marks paid.

**Qualification:** Any job where:
- `scheduled_at < now` (job is in the past)
- AND (`status !== 'Completed'` OR `payment_status !== 'Paid'`)
- AND `status !== 'Cancelled'`
- Across ALL time (not just this week)

**Sort order:** Oldest first (most overdue at top)

**Card variants:**
- Incomplete (not wrapped up): amber card with WRAP UP button → opens PostJobSheet
- Completed but unpaid: amber card with PAY button → opens PostJobSheet

**Staleness banner:**
- If any attention item is more than 48 hours past its scheduled time, show a persistent amber banner strip at the top of the scroll area (below the hero section, above Zone 1):
  - Text: "⚠️ {n} job{s} need{s} your attention"
  - Tapping it scrolls to Zone 2
  - Dismissed once all items are resolved

**Data scope note:** `allJobs` from `useData` must include past weeks' jobs. If the current query is windowed to the current week only, a separate lightweight fetch is needed: `fetchAttentionItems()` — jobs before today that are incomplete or unpaid. Check `useData.js` / `jobsRepo.js` query range before implementing.

---

### Zone 3 · Completed + Paid

**Not shown on the home screen.** Completed and paid jobs are accessible via the client profile or Finance tab only. Removing them from home reduces noise.

---

## Other Day Selected View

When a non-today day is tapped from the week strip:
- Header shows week label + week-total revenue (existing weekly summary header)
- Body shows that day's jobs in chronological order — existing simple JobCard list
- No attention queue shown (it lives on the today view only)
- Tapping today in the strip returns to today's 3-zone view

---

## Color Reference

| Element | Color | Hex |
|---|---|---|
| Next Up hero (primary option) | Deep rose | `#B5004E` |
| Next Up hero (A/B alt) | Deep teal | `#00695C` |
| Upcoming today jobs | Blue | `#1565C0` / `rgba(21,101,192,0.07)` bg |
| Needs Attention | Amber | `#F59E0B` / `rgba(245,158,11,0.10)` bg |
| Completed + paid | Green (Finance tab only) | `#16A34A` |

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/Home.jsx` | Default `selectedDate` → today; full 3-zone render; staleness banner; blue upcoming cards; remove Zone 3 |
| `src/data/jobsRepo.js` | Check/add `fetchAttentionItems()` if `allJobs` doesn't cover past weeks |
| `src/pages/Home.jsx` | Next Up card: deeper rose color, drive time row always present, job notes block |

---

## Out of Scope

- Push notifications (OS-level) — future phase
- Notification bell / badge count — could add later as part of a broader notification system
- Changing the weekly summary header stats
