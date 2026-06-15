---
timestamp: 2026-06-15T13-04-11Z
slug: src-pages-login-jsx
---
# Login — Critique

**Score: 7/10** | P1: 3 | P2: 2 | P3: 2

## P1 — Critical

1. outline: none on inputs (line 48) — WCAG focus ring violation. Use sm-input class.
2. Label text EMAIL and PASSWORD all-caps — sentence case.
3. Password visibility toggle button padding: 4 — far below 44x44px tap target.

## P2 — UX

4. Input border is 1px — rest of system uses 1.5px.
5. No brand logo shown — first screen users see, should show identity.

## P3 — Minor

6. Forgot password button marginTop: 4 — should be 8-12px for visual separation.
7. inputStyle defined inline — could use sm-input class for focus ring consistency.
