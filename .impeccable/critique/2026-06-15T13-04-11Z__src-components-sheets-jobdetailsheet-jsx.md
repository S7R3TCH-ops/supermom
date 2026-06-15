---
timestamp: 2026-06-15T13-04-11Z
slug: src-components-sheets-jobdetailsheet-jsx
---
# JobDetailSheet (re-pass, EditMode focus) — Critique

**Score: 7/10** | P1: 5 | P2: 3 | P3: 2

## P1 — Critical

1. + ADD COST all-caps text (line 781) — sentence case "Add cost".
2. Flat/Hourly toggle buttons missing type="button" (line 738).
3. EditMode inputs use iStyle() — no focus ring class applied.
4. window.confirm for invoice edit warning (line 536) — in-app confirm required.
5. Client name in ReadMode is div onClick (line 452) — must be button.

## P2 — UX

6. EditMode Field labels use textTransform: uppercase — sentence case per system.
7. Cancel booking textarea outline: none (line 559) — focus ring violation.
8. SectionDivider uses Fraunces 10px — slightly inconsistent with ink-mid system labels.

## P3 — Minor

9. EditMode footer: "Cancel" could be "Discard changes".
10. SeriesPicker "Apply changes to..." 16px — could use T.font token size.
