# Device Test Backlog

> **CLOSED 2026-09-17** — Joel had Sandra's phone overnight, all 11 items below
> confirmed working. A few minor unrelated issues turned up during that pass;
> those are parked (not yet written up) rather than tracked here. Table kept
> for history — see `CLAUDE.md`'s per-version changelog for full detail on
> each fix.

| Version | What was checked | Device | Notes |
|---|---|---|---|
| `53fe23b` (2026-09-16) | Invoice/receipt web preview — 3 side-by-side columns instead of stacked | Sandra's iPhone | Confirmed 2026-09-17 |
| sm-scroll → sm-scroll-sheet swap (2026-09-16) | 11 modal sheets — dead-space gap between short content and footer gone | Joel's Pixel | Confirmed 2026-09-17 |
| v0.13.66 | JobCard/UpcomingCard consolidation; PostJobSheet carried-note keep/remove check | Joel's Pixel | Confirmed 2026-09-17 |
| v0.13.62 | Client-notes carry-forward UI (checkbox at completion, pre-fill on next booking, dismissible tile on ClientProfile) | Sandra's iPhone | Confirmed 2026-09-17 — **note**: separate underlying persistence bug (stale note re-inheriting on a new job) is still open, this only confirms the UI |
| v0.13.52 | JobDetailSheet header-pills visibility fix, black dead-space fix, Invoice/Receipt CTA button | Joel's Pixel + Sandra's iPhone | Confirmed 2026-09-17 |
| v0.13.51 | Schedule/Agenda "happening now" pink badge vs "Next up" | Joel's Pixel | Confirmed 2026-09-17 |
| v0.13.49 | Client account credit: "Mark as tip instead" reclassify control; auto-apply-to-next-job | Joel, prod | Confirmed 2026-09-17 |
| v0.13.48 | Keyboard scroll `block:'center'` fix; "End of roster"/"All caught up" empty-state markers | Joel's Pixel + Sandra's iPhone | Confirmed 2026-09-17 |
| v0.13.40 | Sheet scroll dead-space round 2 | Sandra's iPhone | Confirmed 2026-09-17 |
| v0.13.39 | Sheet dead-space fix, GrabBar safe-area-inset-top | Sandra's iPhone | Confirmed 2026-09-17 |
| v0.13.36 | JobDetailSheet admin actions collapsed-by-default toggle | Either | Confirmed 2026-09-17 |

**New, not yet device-confirmed (added 2026-09-17):**

| Version | What to check | Device | Notes |
|---|---|---|---|
| v0.13.69 | "Tell Joel" bug/idea submission — bottom-nav "+" menu → sheet → submit → confirmation | Either | Web-QA'd end-to-end already (real submit, email, export all confirmed); device pass is for the UI/keyboard/touch feel only |
| v0.13.71 | Job-note visibility v2 — full QA scenario table is the design doc's §7 (15 rows). Not verifiable without a phone: JobDetailSheet's hoisted note callout + Done/Undo tap targets, header/footer `flexShrink:0` still holding with the extra top block on a long-content job; Home's Happening-now hero card height with the new callout + LiveTimer stacked, and its direct Done tap; Next-up hero on a 2-line client name; the `T.pink` TO DO pill on the Next-up hero's `DEEP_ROSE` gradient in both themes (fallback documented in the design doc §3.2 if it visually muddies); the `wrapUp` card's (Scheduled job past end time, yellow `T.status.attention` fill) pink pill/border legibility in both themes; PostJobSheet's new Section 0 gate sitting above the keyboard when the amount field is focused | Joel's Pixel + Sandra's iPhone | Not yet run — migration must be applied first (`notes_resolved_at` column), then repo-layer QA on the QA business, then this device pass, before push |
| v0.13.72 | Lockscreen job notifications (Web Push) — full design + build-order: `second-brain/00-inbox/2026-09-18-supermom-lockscreen-notifications-design.md`. **Cannot be QA'd at all until Joel runs both migrations and the `pg_cron` schedule.** Then, in order: (1) **Test push arrival** — Settings → "Job alerts on this phone" toggle (permission prompt, RLS insert lands in `push_subscriptions`) → "Send me a test" → confirm the notification actually reaches the lock screen, both apps installed (not a browser tab). (2) **Tap-to-open-job-sheet with the app killed** — force-quit the PWA, wait for a real leave/wrap-up alert (or trigger one by booking a job ~10-15 min out with a known address), tap the lockscreen notification, confirm it cold-launches straight to `JobDetailSheet` for that job (`?job=` deep link) and that the back button closes the sheet, not the app (explicitly outside `useBackClose`, needs its own verification — the mechanism is new). (3) **Subscription revoke-on-uninstall** — remove the PWA from the home screen, confirm the next sweep tick 404s/410s the dead endpoint and deletes the `push_subscriptions` row (visible in Admin's tail going from a matching sent-count drop, or by direct query). Also verify: leave-alert body reads correctly with and without a known drive time; wrap-up body's carried-note/job-notes/balance lines render legibly at lock-screen width in both themes; the Settings "Job alerts for this business" master toggle actually stops alerts; VAPID env vars are live in the deployed build (not just `vercel env ls` — an actual subscribe must succeed). | Joel's Pixel, then Sandra's iPhone with Joel present (this feature's whole value is the iOS half — nothing here is closed until seen on her lock screen) | Not yet run — needs both migrations, the `pg_cron` schedule, and a production deploy first |
