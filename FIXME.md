# Fix-It List — Supermom for Hire

> Shared between Claude Code and Gemini CLI. Update this file when bugs are found or fixed.
> Format: `- [ ] open` / `- [x] fixed (session date, agent name)`

---

## Auth / Login

- [x] **Password reset link does nothing** — `redirectTo` pointed to `/` but no component handled the `PASSWORD_RECOVERY` event. Fixed: `Auth.jsx` now sets `recoveryMode` on that event; `App.jsx` renders `SetNewPasswordShell` when active. *(Fixed April 26, 2026 — Claude Code)*

- [x] **Onboarding shown to admin users** — `OnboardingWalkthrough` gated on `business.ai_profile.onboarding_complete` (business-level), so Joel's admin account triggered the Sandra welcome flow. Fixed: added `profile?.role !== 'owner'` guard so only the `owner` role sees onboarding. *(Fixed April 26, 2026 — Claude Code)*

---

## Open Issues

*(add new bugs here)*

---

## Notes for both agents
- All DB writes must include `.eq('business_id', businessId)` — see CLAUDE.md
- Never hard-delete; use `deleted_at = now()`
- Timezone is always `America/Toronto`
- After fixing, move item to the "fixed" section above with date + agent name
