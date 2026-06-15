---
target: src/pages/Clients.jsx
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-15T09-30-45Z
slug: src-pages-clients-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading shown, filter state clear, but no result count after filtering |
| 2 | Match System / Real World | 4 | "Your people", "Owes $", "VIP" — Sandra's language throughout |
| 3 | User Control and Freedom | 3 | No clear/X on search input; filters easily switched |
| 4 | Consistency and Standards | 2 | Three different interactive element patterns (div, div+role, button); "Outstanding" in tiles vs "Owes $" in chips for same filter |
| 5 | Error Prevention | 3 | Filter system constrains navigation; smart defaults |
| 6 | Recognition Rather Than Recall | 3 | Actions visible; no count badges on chips |
| 7 | Flexibility and Efficiency | 3 | Dual-surface filters are an accelerator; one-tap reach to "Owes $" from hero |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and focused; dual filter system adds minor redundancy |
| 9 | Error Recovery | 2 | Raw error.message exposed; no retry action |
| 10 | Help and Documentation | 2 | Empty states good; no explanation of "Leads" vs "Active" |
| **Total** | | **28/40** | **Good — address weak areas** |

## Anti-Patterns Verdict

**LLM assessment**: No AI slop. Hero layout is tasteful: stat tiles doubling as filter shortcuts, compact client cards with right data density. No ghost cards, no gradient text, no eyebrow reflex. The design reflects real product thinking.

**Deterministic scan**: `detect.mjs` returned 0 findings. Clean pass.

## Overall Impression

Sharpest list view in the app. Hero+stats+search layout is well-composed and card content density is exactly right. Main damage is the a11y layer: three different interactive patterns within one screen, a killed focus ring on the search input, and sub-minimum tap target on the add button.

## What's Working

1. **Stat tiles as filter shortcuts** — clicking "Outstanding" or "VIP" in the hero instantly filters the list. Elegant shortcut that rewards power users without confusing first-timers.
2. **Client card data density** — avatar color, name, VIP badge, owed amount, next job date, and tags all on one row without feeling cluttered.
3. **`aria-pressed` on filter chips** — the chip strip has proper ARIA semantics. Just needs to be extended to hero tiles.

## Priority Issues

**[P1] `outline: none` on search input — WCAG focus ring killed**
- `src/pages/Clients.jsx:179` — `outline: 'none'` on the `<input>` eliminates keyboard focus indicator.
- **Why it matters**: Keyboard/AT users get no visible focus state. WCAG 2.4.7 violation. Same issue fixed in Home, NewJobSheet, ClientProfile.
- **Fix**: Remove `outline: 'none'`. Add wrapper border-color focus indicator via `onFocus`/`onBlur` toggling `border-color: T.pink`.

**[P1] Stat tiles are inaccessible `<div onClick>` — no role, tabIndex, or keyboard handler**
- `src/pages/Clients.jsx:145–159` — Three stat tiles use `onClick` on plain `<div>`. No `role="button"`, no `tabIndex={0}`, no `onKeyDown`.
- **Why it matters**: Keyboard users cannot access these filter shortcuts at all.
- **Fix**: Convert to `<button type="button">`.

**[P1] Add client `+` button is 36×36px — below 44×44px minimum**
- `src/pages/Clients.jsx:128` — `width: 36, height: 36`.
- **Why it matters**: Primary write action on this screen; miss-taps frustrate Sandra between jobs.
- **Fix**: Increase to `width: 44, height: 44`.

**[P2] `ClientCard` is `<div role="button">` — should be native `<button>`**
- `src/pages/Clients.jsx:12–72` — Functional but inconsistent with app-wide pattern from v0.12.52–55 passes.
- **Fix**: Replace outer `<div onClick role="button">` with `<button type="button">`.

**[P2] Dark mode stat tile sub-labels: 8px text at ~3.5:1 contrast — fails WCAG AA**
- `src/pages/Clients.jsx:156` — `rgba(255,255,255,0.38)` inactive on near-black ≈ 3.5:1. Needs 4.5:1.
- **Fix**: Raise inactive dark mode opacity to `0.55` or raise font size to 9px.

## Persona Red Flags

**Sam (Accessibility-Dependent)**: Stat tiles completely invisible to keyboard — no tabIndex. Most efficient hero shortcuts are keyboard-inaccessible. Search input has no focus ring.

**Casey (Distracted Mobile User)**: 36×36px `+` button causes miss-taps. Lead "Book" button at `padding: '4px 8px'` is ~25px tap target nested inside full-width tappable row.

**Sandra (Real User)**: "Outstanding" in hero vs "Owes $" in chips — same filter, different labels. Minor trust-eroder for a non-technical daily user.

## Minor Observations

- `error.message` at line 201 exposes raw Supabase error — should be friendly generic message with retry.
- Lead "Book" button: `padding: '4px 8px', fontSize: 9` — ~25px tap target, well under 44px minimum.
- No result count after filtering — a `"3 clients"` count line below chips would add meaningful context for free.
- Filter label mismatch between surfaces: hero says "Outstanding" / chips say "Owes $" — both map to same state but different labels.
- "Active" and "Leads" filters only exist in chips, not hero stat tiles.

## Questions to Consider

- "The stat tiles double as filters — but the hero and chips use different labels for the same filter. Should one surface be canonical filter and the other just informational?"
- "Would a simple (3) count badge on each chip tell Sandra more at a glance?"
- "The + button lives in the hero corner — is that the most discoverable place to add a client, or would a sticky footer CTA be more consistent with how other sheets are triggered?"
