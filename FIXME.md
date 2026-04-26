# Fix-It List — Supermom for Hire

> Shared between Claude Code and Gemini CLI. Update this file when bugs are found or fixed.
> Format: `- [ ] open` / `- [x] fixed (session date, agent name)`

---

## Fixed Issues

- [x] **Password reset link does nothing** — `redirectTo` pointed to `/` but no component handled the `PASSWORD_RECOVERY` event. Fixed: `Auth.jsx` now sets `recoveryMode` on that event; `App.jsx` renders `SetNewPasswordShell` when active. *(Fixed April 26, 2026 — Claude Code)*

- [x] **Onboarding shown to admin users** — `OnboardingWalkthrough` gated on `business.ai_profile.onboarding_complete` (business-level). Fixed: added `profile?.role !== 'owner'` guard. **Further Refined:** Added email-based Super Admin check to bypass even if role is owner. *(Updated April 26, 2026 — Gemini CLI)*

- [x] **"Good morning" hardcoded** — Home screen greeting didn't respect time of day. Fixed: Added `getGreeting()` helper for Morning/Afternoon/Evening. *(Fixed April 26, 2026 — Gemini CLI)*

- [x] **Done jobs in "Next Up"** — Home hero area showed jobs already paid or completed. Fixed: Updated `next` filtering to skip `Paid` or `Completed` status. *(Fixed April 26, 2026 — Gemini CLI)*

- [x] **Edit Job "Black Page" crash** — Tapping Edit in Job Detail sheet occasionally crashed the app. Fixed: Added null checks for `job` and passed missing `mode` prop to `EditMode`. *(Fixed April 26, 2026 — Gemini CLI)*

- [x] **Viewpoint switching for Super Admin** — Joel (Creator) was incorrectly linked to Sandra's business, preventing multi-tenant testing. Fixed: Decoupled Joel from client businesses in DB; updated `currentBusiness.js` to handle null business for global admins. *(Fixed April 26, 2026 — Gemini CLI)*

---

## Open Issues

*(add new bugs here)*

---

## Notes for both agents
- All DB writes must include `.eq('business_id', businessId)` — see CLAUDE.md
- Never hard-delete; use `deleted_at = now()`
- Timezone is always `America/Toronto`
- After fixing, move item to the "fixed" section above with date + agent name
