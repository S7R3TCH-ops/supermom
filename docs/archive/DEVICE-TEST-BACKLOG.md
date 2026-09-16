# Device Test Backlog

> Consolidated 2026-09-16. Every item below is **shipped and live** but has never
> been confirmed working on a real device (Joel's Pixel 10 Pro or Sandra's
> iPhone) — full detail on each stays in `CLAUDE.md`'s per-version changelog
> entries; this file exists so the list of "still needs eyes on it" doesn't
> get lost in that changelog's length. **Nothing here is marked confirmed
> until someone actually opens the app on the named device and checks it.**
> When an item is confirmed, delete its row here and note the confirmation
> date in its CLAUDE.md entry — don't just delete silently.

| Version | What to check | Device | Notes |
|---|---|---|---|
| `53fe23b` (2026-09-16) | Invoice/receipt web preview — client/business/invoice-meta blocks now render as 3 side-by-side columns instead of stacked | Sandra's iPhone | She's the one who reported the original "addresses stacking" bug — needs her confirm specifically |
| sm-scroll → sm-scroll-sheet swap (2026-09-16) | 11 modal sheets (AiChatSheet, EditClientSheet, FinanceDetailSheet, NewClientSheet, NewExpenseSheet, NewJobSheet ×2, PostJobSheet, PrepNoteSheet, ServiceCatalogSheet, WorkerCatalogSheet) — dead-space gap between short content and footer should be gone | Joel's Pixel | Same pattern already confirmed working on JobDetailSheet (v0.13.52's `.sm-scroll-sheet` origin) |
| v0.13.66 | JobCard/UpcomingCard consolidation; PostJobSheet carried-note keep/remove check | Joel's Pixel (tunnel died mid-test last time) | |
| v0.13.62 | Client-notes carry-forward UI (checkbox at completion, pre-fill on next booking, dismissible tile on ClientProfile) | Sandra's iPhone | She's the one who asked for this feature |
| v0.13.52 | JobDetailSheet header-pills visibility fix, black dead-space fix, Invoice/Receipt CTA button | Joel's Pixel + Sandra's iPhone | Verified via Playwright only so far |
| v0.13.51 | Schedule/Agenda "happening now" pink badge vs "Next up" | Joel's Pixel | |
| v0.13.49 | Client account credit: "Mark as tip instead" reclassify control; auto-apply-to-next-job | Joel testing on prod with a real account | Two specific paths unverified: reclassify control, auto-apply flow |
| v0.13.48 | Keyboard scroll `block:'center'` fix; "End of roster"/"All caught up" empty-state markers | Joel's Pixel + Sandra's iPhone | |
| v0.13.40 | Sheet scroll dead-space round 2 (ServiceCatalogSheet, NewExpenseSheet, PostJobSheet, NewJobSheet) | Sandra's iPhone | |
| v0.13.39 | Sheet dead-space fix, GrabBar safe-area-inset-top | Sandra's iPhone | Notch/Dynamic Island clearance specifically |
| v0.13.36 | JobDetailSheet admin actions collapsed-by-default toggle | Either | Confirm it's discoverable, not just present |

**Batching note (2026-09-16):** the sm-scroll swap and `53fe23b` are going out in the same push as everything above — one device pass can cover the whole table at once instead of generating another backlog entry per fix.
