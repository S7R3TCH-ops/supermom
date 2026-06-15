---
timestamp: 2026-06-15T07-52-24Z
slug: src-components-sheets-newjobsheet-jsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Step progress is text-only; AI/drive loading shown well |
| 2 | Match System / Real World | 3 | Raw ISO date in Step 3 review ("2026-06-15" not "Mon, Jun 15") |
| 3 | User Control and Freedom | 3 | Back/close all present; no undo after booking (acceptable) |
| 4 | Consistency and Standards | 2 | Clickable divs and buttons mixed; outline:none everywhere |
| 5 | Error Prevention | 3 | Past booking + conflict warnings solid; required field gating works |
| 6 | Recognition Rather Than Recall | 3 | Recent clients + AI time suggestion help; service grid visible |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; pre-fill helps but limited power paths |
| 8 | Aesthetic and Minimalist Design | 3 | Step 2 is dense but serves the task; Step 3 hero is premium |
| 9 | Error Recovery | 2 | Error message renders below the footer — easy to miss entirely |
| 10 | Help and Documentation | 2 | No tooltips, no inline hints on any required fields |
| **Total** | | **26/40** | **Acceptable — improvements needed** |

### Anti-Patterns Verdict

**LLM assessment:** The sheet doesn't look AI-slop overall — the dark hero in Step 3, the AI duration suggestion card, and the swipe-to-dismiss are all above-average touches. The main aesthetic risk is the AI reason callout (borderLeft: 3px solid) which is an explicit absolute ban. Step 2 is dense but purposefully so. The step progress area is underdeveloped vs. DESIGN.md spec (visual dots promised, text label delivered). No glassmorphism, no gradient text, no side-stripe cards on main content.

**Deterministic scan:** 2 findings:
- Line 681 — borderLeft: 3px solid on the AI reason callout. Classic side-tab; banned.
- Line 332 — transition: padding-bottom on the scroll container. Layout property animation.

### Overall Impression

A solid, functional booking flow that does the hard things right (pre-fill, conflict detection, drive time, AI duration estimate). The single biggest drag is accessibility — every input strips its focus ring with outline:none, and client rows + service cards are div onClick not button, making the entire flow keyboard-unusable. Error messaging is also broken in placement: it renders below the footer buttons, outside the visible viewport on most phones.

### What's Working

1. **Step 3 dark hero** — follows DESIGN.md exactly. Client name in Fraunces, pink label strip, radial glow, drive time in the same block. Premium feel at the highest-stakes moment.
2. **AI duration suggestion** — loading state, "AI Suggested" green badge, italic reasoning callout. Right level of disclosure.
3. **Conflict + past booking warnings** — both implement the in-app confirm pattern (not window.confirm). Non-blocking, recoverable, clear copy.

### Priority Issues

**[P1] Focus rings stripped on all inputs — WCAG AA violation**
- Every input, textarea, and select has outline: none. Keyboard navigation is invisible.
- Fix: Remove outline: none from all form fields. Match JobDetailSheet EditMode pattern from v0.12.50.

**[P1] Clickable div elements for client rows and service cards — not keyboard navigable**
- Step 1 client bubbles (line 473) and list rows (line 484) use div onClick. Step 2 service cards (line 576) also use div onClick. Not focusable or reachable by keyboard or screen reader.
- Fix: Convert to button type="button" with reset styles.

**[P1] Error message renders below the footer — invisible on most phones**
- bookErr at line 424 renders after the footer div. On a 390px iPhone with footer pinned, this text is off-screen.
- Fix: Move bookErr inside the footer div, above the button row.

**[P2] Step progress: text-only "Booking: Step 2 of 3" — DESIGN.md specifies visual step dots**
- DESIGN.md section 12 defines .step-dot and .step-dot.active/.done for this exact sheet.
- Fix: Replace SectionLabel text with a 3-dot progress bar row.

**[P2] Step 3 review shows raw ISO date — unfriendly**
- Line 911 renders {date} directly producing "2026-06-15".
- Fix: Format with Intl.DateTimeFormat to "Sun, June 15".

**[P2] Close button 32x32px — below 44x44 minimum tap target**
- Line 323. Same fix applied to every other sheet in v0.12.52; missed here.
- Fix: Change to width: 44, height: 44.

### Minor Observations

- Line 681: borderLeft: 3px solid on AI reason callout — banned side-tab. Use background tint instead. (P3)
- Line 332: transition: padding-bottom — same layout animation removed from Home.jsx in v0.12.54. Remove it. (P3)
- Line 454: "+ NEW CLIENT" all-caps — use sentence case "+ New client". (P3)
- Line 411: Disabled button uses T.pinkTint with white text — low contrast. Use T.inkMuted text color. (P3)
- Lines 665, 675: Stepper buttons missing aria-label. Add "Decrease duration" / "Increase duration". (P3)
- Line 726: "+ ADD ANOTHER COST" button missing type="button". (P3)
- Line 463: Search input has outline:none and missing aria-label. (P3)

### Questions to Consider

- "The suggestedTime pill only appears when !time — what if Sandra taps the wrong time and wants to reset? Should it also appear when time is set?"
- "Step 2 is long enough to require significant scrolling. Would grouping Schedule and Financials into two visual sections reduce the feeling of length?"
- "The pre-fill system is wired but invisible in Step 2 — no banner saying 'Pre-filled from last visit'. Intentional, or was the DESIGN.md toggle meant to appear?"
