---
timestamp: 2026-06-15T13-04-11Z
slug: src-components-sheets-newclientsheet-jsx
---
# NewClientSheet — Critique

**Score: 6/10** | P1: 5 | P2: 3 | P3: 2

## P1 — Critical

1. outline:none on all inputs (line 52) — WCAG focus ring removed. Use sm-input class per v0.12.59 convention.
2. Close button 30x30px (line 128) — minimum 44x44px tap target.
3. All-caps labels throughout (FIRST NAME, LAST NAME, etc.) — sentence case as fixed in every other sheet.
4. Raw DB error message exposed to user (line 99) — friendly copy required.
5. VIP checkbox is tiny native element with no enlargement.
6. transition: height on keyboard spacer (line 290) — layout thrash (detector hit).

## P2 — UX

7. Recurrence buttons hardcode #E91E6A instead of T.pink token (line 199).
8. Intel field labels cryptic: PREFS, ACCESS, COMMS — expand to full names.
9. type="button" missing on recurrence buttons (line 197).

## P3 — Minor

10. STATUS label div lacks matching htmlFor (uses div not label).
11. Form gap 10px — could use 12-14px for breathing room.
