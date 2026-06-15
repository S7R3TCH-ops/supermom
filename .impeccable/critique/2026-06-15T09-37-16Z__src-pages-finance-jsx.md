---
target: src/pages/Finance.jsx
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-06-15T09-37-16Z
slug: src-pages-finance-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good skeleton; transaction count in header; no visual feedback on period switch |
| 2 | Match Between System / Real World | 3 | Clear financial language; "Financial Command" is on-brand |
| 3 | User Control and Freedom | 2 | Period toggle always reachable; no undo for new expense |
| 4 | Consistency and Standards | 2 | StatCard + TransactionRow still use div onClick — pattern fixed on every other page |
| 5 | Error Prevention | 2 | No visible validation; CSV is safe; no guards around empty periods |
| 6 | Recognition Rather Than Recall | 3 | Labels clear; VIEW affordance at 9px opacity 0.7 is nearly invisible |
| 7 | Flexibility and Efficiency | 2 | Period switching fast; no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Clean structure; hero underused; disabled "coming soon" placeholder is dead weight |
| 9 | Error Recovery | 2 | No error UI visible in source |
| 10 | Help and Documentation | 1 | No contextual help |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: No AI slop. Design system applied consistently. The main aesthetic issue is underuse: the dark hero is static and doesn't show a headline financial number per DESIGN.md spec.

**Deterministic scan**: detect.mjs returned [] — no pattern violations.

## Overall Impression

Structurally sound, design system applied faithfully. Hero is a missed opportunity — Sandra opens Finance to see her headline number and gets a static page title instead. div onClick on stat cards and transaction rows is the same a11y gap fixed on every other page.

## What's Working

1. Period toggle — dark pill, solid pink active, correct per spec, fast.
2. TrendChart — hand-rolled SVG with dual revenue/expense lines, area fill, adaptive label spacing. Clean.
3. Skeleton loading — matches real layout, staggered pulse, no spinner.

## Priority Issues

**[P1] StatCard uses div onClick — no button semantics**
- Why: Not keyboard accessible, no focus indicator, WebkitTapHighlightColor transparent means tap feedback is invisible. Every other page converted.
- Fix: Convert to button type="button". Restore focus ring.

**[P1] TransactionRow uses div onClick when tappable**
- Why: Interactive rows that open JobDetailSheet aren't keyboard accessible, no role, no focus indicator.
- Fix: button type="button" when tappable, plain div otherwise. Add aria-label.

**[P1] Hero missing headline financial number**
- Why: DESIGN.md specifies large $ amount + sub-label + trend pill in the hero. Currently hero shows static "Revenue & Expenses" heading regardless of selected period. Sandra has to read 4 cards to find the answer the hero should give in one glance.
- Fix: Display stats.revenue as hero headline (Fraunces ~40px, white) with periodLabel as sub-label. Reflect selected period in hero.

**[P2] "+ ADD EXPENSE" should be sentence case**
- Why: Prior passes on NewJobSheet, Home, Clients all converted ALL CAPS labels. Finance is inconsistent.
- Fix: "+ Add expense"

**[P2] "VIEW ALL INVOICES · Coming soon" disabled placeholder**
- Why: Dead UI. Looks interactive, does nothing, signals unfinished product.
- Fix: Remove entirely until the feature ships.

## Persona Red Flags

**Sandra (Solo Operator)**: Hero showing "Revenue & Expenses" every time doesn't answer her question. Div stat cards may not give visual tap feedback, causing distrust.

**Casey (Distracted Mobile User)**: "+ Add expense" at 10px in section header is easily missed. "VIEW ›" affordance at 9px/opacity 0.7 essentially invisible one-handed.

**Sam (Accessibility)**: Period toggle buttons work. Stat cards (div) invisible to keyboard. Transaction rows (div) invisible to keyboard. Cannot access any drilldown views via keyboard.

## Minor Observations

- border: 1px on trend chart card vs 1.5px on stat cards — use --border-card (1.5px) consistently.
- Hero h2 missing fontWeight: 500 (Fraunces defaults to 400).
- Formal Invoices section ignores active period filter — shows last 3 from all time.
- Worker cost amber text (#F59E0B on white) is ~2.7:1 contrast — use #92400E instead.
- Tax Ready section much sparser than DESIGN.md spec (missing YTD summary rows).

## Questions to Consider

- "What if the hero showed Sandra's net profit for the selected period — 'You cleared $X this month' — rather than a static page title?"
- "Does Tax Ready need to be visible at all times, or would a collapsed tax view reduce scroll depth for daily use?"
- "The 'coming soon' placeholder signals unfinished product — is nothing better than a broken affordance?"
