# Fix-It List — Supermom for Hire

> Shared between Claude Code and Gemini CLI. Update this file when bugs are found or fixed.
> Format: `- [ ] open` / `- [x] fixed (session date, agent name)`

---

## Fixed Issues

- [x] **Realtime Crash** — `realtime.js` called `.on()` after `.subscribe()`. Fixed: Added explicit channel cleanup and variable reset. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **ClientProfile Crash** — `mode` was missing from `useAppTheme` destructuring. Fixed: Added `mode` to the destructured props. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **NewJobSheet Crash** — `onFixTime` was missing/incorrect in Step 3. Fixed: Verified prop destructuring is present. *(Verified May 1, 2026 — Gemini CLI)*
- [x] **Onboarding Persistence** — DB saves failed due to missing RLS policies. Fixed: Created `20260501070000_harden_rls.sql` migration. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **GCal Sync Series Limit** — Capped at 5 occurrences. Fixed: Increased limit to 20 and added `await` for single-job syncs. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Design: View Toggles** — Backgrounds were inconsistent in light mode. Fixed: Standardized to `#2C2C2E` (dark) per design brief. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Design: Hero Borders** — Border-bottom missing in light mode. Fixed: Set static `3px solid #E91E6A` on hero containers. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Design: FAB Visibility** — FAB showed on Settings/Admin pages. Fixed: Added route-based hiding logic in `App.jsx`. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Typography Standardization** — Home and Settings headers used raw styles. Fixed: Migrated to `<SectionLabel>`. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Password reset link does nothing** — `redirectTo` pointed to `/` but no component handled the `PASSWORD_RECOVERY` event. Fixed: `Auth.jsx` now sets `recoveryMode` on that event; `App.jsx` renders `SetNewPasswordShell` when active. *(Fixed April 26, 2026 — Claude Code)*
- [x] **GCal Sync: Series deletes were capped at 5** — Same fix as series updates. *(Fixed May 1, 2026 — Gemini CLI)*
- [x] **Duplicate DST/timezone logic** — `NewJobSheet.jsx` and `jobsRepo.js` both had DST logic. Fixed: `NewJobSheet` now imports `composeTorontoISO`. *(Verified May 1, 2026 — Gemini CLI)*
- [x] **Stale TODAY constant in Calendar.jsx** — Fixed: Replaced with `NOW()` dynamic getter. *(Verified May 1, 2026 — Gemini CLI)*

---

## Open Issues

- [ ] **Mobile Keyboard Layout** — Keyboard covers the "Save" button in sheets on small iOS devices. Need to add `paddingBottom` to `SheetContainer` based on focus state.
- [ ] **Swipe to Delete** — Client request for swipe gestures on job cards.
- [ ] **Offline Mode** — App crashes if Supabase is unreachable on initial load. Need better `Suspense` fallbacks.

---

## Notes for both agents
- All DB writes must include `.eq('business_id', businessId)` — see CLAUDE.md
- Never hard-delete; use `deleted_at = now()`
- Timezone is always `America/Toronto`
- After fixing, move item to the "fixed" section above with date + agent name
