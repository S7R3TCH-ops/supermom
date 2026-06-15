---
timestamp: 2026-06-15T13-04-11Z
slug: src-pages-admin-jsx
---
# Admin — Critique

**Score: 6/10** | P1: 5 | P2: 4 | P3: 2

## P1 — Critical

1. ToolRow is div onClick (line 575) — must be button type="button".
2. window.confirm in handleSoftDeleteBiz (line 179) and handleRestoreBiz (line 191) — in-app confirm per v0.12.59 pattern.
3. AI Persona cards use role="button" on div (line 401) — should be button.
4. All inputs have outline: none — WCAG violation throughout.
5. Delete/Restore action buttons all-caps DELETE, RESTORE — sentence case.

## P2 — UX

6. console.error and console.warn in production code (lines 79, 132) — remove.
7. Security section input labels all-caps New Password, Confirm — sentence case.
8. Password inputs outline: none — WCAG violation.

## P3 — Minor

9. UPDATED check badge all-caps — minor.
10. Section labels hardcode colon notation — style nit.
