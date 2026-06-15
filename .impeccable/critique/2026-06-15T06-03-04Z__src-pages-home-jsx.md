---
timestamp: 2026-06-15T06-03-04Z
slug: src-pages-home-jsx
---
---
score: 73
p0: 0
p1: 3
p2: 5
p3: 7
target: src/pages/Home.jsx
---

# Home.jsx — Impeccable Critique

## Score: 73/100

**Strengths:** Multi-state architecture is excellent — active/next/upcoming/owing/done each handled distinctly with appropriate visual weight. The Supermom GO! button is the best-executed branded interaction in the app. The owing collapsible is smart IA — surfaces financial urgency without clogging the main flow.

**Priority gaps:** Three P1 accessibility failures (outline removal in modal inputs, non-semantic revenue widget, sub-44px tap targets on notification banner). Missing loading skeleton is the biggest UX gap — a blank screen on slow connections reads as broken, not loading.

---

## P1 — Fix Before Next Release

### P1-A: `outline: none` on Add Cost modal inputs — WCAG failure
**Lines 1242, 1254** — Both inputs in the Add Cost sheet suppress focus rings with no replacement. WCAG 2.4.7 violation.  
Fix: Remove `outline: 'none'` or replace with `onFocus` that applies `boxShadow: '0 0 0 2px var(--pink)'`. Match the pattern used on other sheet inputs.

### P1-B: Weekly revenue widget is a non-semantic click target
**Lines 632–667** — The "This Week" revenue tap area is a `div onClick` with no `role`, `tabIndex`, or `aria-label`. Unreachable by keyboard.  
Fix: Convert to `<button type="button">` or add `role="button" tabIndex={0}` + `onKeyDown` (Enter/Space) + `aria-label="View this week's jobs"`.

### P1-C: Notification banner buttons under 44px tap target
**Lines 697–711** — "Enable" button uses `padding: '6px 12px'` (~28px height). The × dismiss is even smaller. Sandra uses this on iPhone.  
Fix: Add `minHeight: 44` to both Enable and × buttons. The × also needs `minWidth: 44` and `aria-label="Dismiss"`.

---

## P2 — High Priority Polish

### P2-A: No loading skeleton state
When `loading` is true and `allJobs` is null, the scroll area renders blank. Per product register: skeleton states, not blank content.  
Fix: When `loading && !allJobs`, render 2–3 skeleton card placeholders (grey animated rects at the right dimensions).

### P2-B: Add Cost modal missing sheet handle
**Line 1219** — Every other bottom sheet has a 40×4px handle pill at the top. The Add Cost modal is missing it.  
Fix: Add `<div style={{ width: 40, height: 4, background: 'var(--pink-border)', borderRadius: 4, margin: '8px auto 0' }} />` as first child inside the sheet content div.

### P2-C: Owing rows — tappable with no visual affordance
**Lines 1116–1144** — Each owing group row has `onClick` but no right-side chevron or arrow. Sandra won't know it opens the job detail.  
Fix: Add `›` or a Lucide `ChevronRight` icon (16px, `T.inkMuted`) to the right side of each owing row.

### P2-D: Hero border-bottom missing in light mode
**Line 605** — `borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none'` means light mode has no visual separator between the hero and scroll content below.  
Fix: In light mode use `borderBottom: '1.5px solid var(--pink-border)'` for a subtle but present separator.

### P2-E: MissionIntel label inconsistent with DESIGN.md AI spec
`MissionIntel` renders `"Good to know"` at 9px/0.5px letter-spacing using `theme.accent`. DESIGN.md requires: `✦` prefix, 9.5px, 700 weight, 1.1px letter-spacing, `#FF78B0`.  
Fix: Update MissionIntel label to `✦ GOOD TO KNOW` at the correct spec values.

---

## P3 — Polish Pass

### P3-A: `max-height` layout transition causes jank (detector flagged)
**Line 1199** — `transition: 'max-height 0.2s ease-out'` on the keyboard spacer div triggers layout recalc on every keyboard open/close.  
Fix: Replace with a fixed-height `height: 80px` div that is conditionally `visibility: hidden` or use `transform: translateY`.

### P3-B: Owing disclosure arrow is a text character `▶`
**Line 1081** — Text-rendered `▶` can't be cleanly sized and the rotation animation is janky at small sizes.  
Fix: Replace with Lucide `ChevronRight` (12px) rotated 90° when open, or a CSS triangle.

### P3-C: Revenue amount missing thousands separator
**Line 649** — `$${displayRevenue.toFixed(0)}` shows "$1450" not "$1,450". Sandra will hit four-digit weeks.  
Fix: `$${displayRevenue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}` — same for `collectedThisWeek`.

### P3-D: Client name in Next Up card clips at 26px with no wrap
**Line 859** — `fontSize: 26, whiteSpace: 'nowrap', textOverflow: 'ellipsis'`. Long names like "Beaumont-Robertson" will clip on a 390px screen.  
Fix: Allow two lines via `-webkit-line-clamp: 2` and `whiteSpace: 'normal'`, or reduce to 22px.

### P3-E: `type="button"` missing on active job action buttons
**Lines 807–809** — +30 MIN, +COST, WRAP UP have no `type="button"`.  
Fix: Add `type="button"` to all three.

### P3-F: × dismiss button in notification banner has no `aria-label`
**Line 703** — Screen readers announce "×" literally.  
Fix: Add `aria-label="Dismiss notification reminder"`.

### P3-G: `COMING UP TODAY` section label has hardcoded all-caps in prop
**Line 1015** — `<SectionLabel color={T.pink} style={{ marginBottom: 8 }}>COMING UP TODAY</SectionLabel>`. The SectionLabel component already applies `text-transform: uppercase`, so the text content should be sentence-case `Coming up today` to avoid double-casing if the CSS ever changes.  
Fix: Minor — change string to `Coming up today`.
