---
target: Admin
total_score: 23
p0_count: 1
p1_count: 3
timestamp: 2026-06-10T14-34-45Z
slug: src-pages-admin-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Saving/loading states covered; no skeleton on initial business data load |
| 2 | Match System / Real World | 3 | "Viewpoint" and "Provision" technical but scoped to super-admin only |
| 3 | User Control and Freedom | 2 | No undo on soft-delete; window.confirm() as sole safety net |
| 4 | Consistency and Standards | 2 | Super Admin blocks hardcode dark tokens; error color uses brand pink not semantic red; side-stripe on test result |
| 5 | Error Prevention | 3 | Button disabled states and field validation solid |
| 6 | Recognition Rather Than Recall | 3 | Tools have descriptive sub-labels; persona options have names + descriptions |
| 7 | Flexibility and Efficiency | 2 | Single path for all actions; window.confirm() jarring on mobile |
| 8 | Aesthetic and Minimalist Design | 2 | Dead tool row; side-stripe border; stat shows raw total_amount |
| 9 | Error Recovery | 2 | Inline errors exist but password error uses brand pink |
| 10 | Help and Documentation | 1 | No contextual help explaining what AI Persona changes |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

1 detector finding: side-tab accent border at Admin.jsx:430 (borderLeft: 3px solid). LLM assessment: functional tooling with uneven polish. No slop patterns beyond the side-stripe.

## Priority Issues

[P0] Super admin viewpoint reset disappears after switching — Joel gets trapped (reset button is gated behind !viewingAsId, same as the panel it lives in).

[P1] Revenue YTD uses raw total_amount (includes HST) — inflates Sandra's stat by ~13%.

[P1] Side-stripe border on persona test result (line 430) — exact anti-pattern match.

[P1] "Detailed Reports" tool row is dead but looks tappable — no feedback on tap.

[P2] Error messages use brand pink #E91E6A instead of semantic error red.

[P2] Super Admin blocks hardcode dark theme (#1C1C1E) — breaks light mode.

## Persona Red Flags

Sandra: Revenue YTD silently wrong; dead tool row; AI Persona section does not explain what it changes.
Joel/Alex: Viewpoint reset trapped after switch (P0); window.confirm() on mobile.
Sam: ToggleBtn no aria-label; pwError not in live region; persona divs not keyboard-focusable.

## Minor Observations

- RESET_TABLES array (lines 547-559) dead code.
- Revenue stat missing thousands separator.
- Sign Out button lacks visual distinction from other ghost buttons.
- Persona test result not persisted — blank on every page load.
