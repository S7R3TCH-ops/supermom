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

> The following 6 issues were identified in the Claude Code audit (April 25, 2026). None are critical/blocking but should be resolved in the next dedicated fix session.

- [ ] **Home.jsx missing imports** — `useBusiness` not imported from `useData.js`; `generatePrepNote` not imported from `ai.js`. Will cause ReferenceError at runtime if those code paths are hit. Fix: add both to their respective import lines. *(Found April 25, 2026 — Claude Code audit)*

- [ ] **NewJobSheet aiDuration prop not destructured** — `Step2What` component receives `aiDuration` but doesn't destructure it in the function signature, so the Smart Estimate panel silently receives `undefined`. Fix: add `aiDuration` to the `Step2What` destructured props. *(Found April 25, 2026 — Claude Code audit)*

- [ ] **Recurring series GCal sync incomplete** — `createRecurringSeries` in `jobsRepo.js` only syncs the first job in the series to Google Calendar. Fix: loop through all results and call `triggerGCalSync(job.id, 'upsert')` for each. *(Found April 25, 2026 — Claude Code audit)*

- [ ] **recordPayment always sets status to 'Paid'** — Logic doesn't check whether the amount paid covers the total. Fix: fetch `total_amount` from the job and set `payment_status` to `'Partial'` if `amount < total_amount`, otherwise `'Paid'`. *(Found April 25, 2026 — Claude Code audit)*

- [ ] **Duplicate DST/timezone logic** — `NewJobSheet.jsx` has its own local `torontoISO()` function that duplicates `composeTorontoISO()` in `jobsRepo.js`. Risk of divergence. Fix: export `composeTorontoISO` from `jobsRepo.js` and import it in `NewJobSheet.jsx`; remove the local copy. *(Found April 25, 2026 — Claude Code audit)*

- [ ] **Stale TODAY constant in Calendar.jsx** — `TODAY` is set once at module load time, meaning a user who leaves the app open past midnight gets stale date logic. Fix: replace `const TODAY = ...` with `const NOW = () => new Date()` and update all references. *(Found April 25, 2026 — Claude Code audit)*

---

## Notes for both agents
- All DB writes must include `.eq('business_id', businessId)` — see CLAUDE.md
- Never hard-delete; use `deleted_at = now()`
- Timezone is always `America/Toronto`
- After fixing, move item to the "fixed" section above with date + agent name
