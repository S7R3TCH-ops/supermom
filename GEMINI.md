# Gemini CLI · Project Instructions

> Foundational mandates. Read at session start. Take precedence over default behaviors.

---

## Session Lifecycle Mandates

### 1. Auto-Documentation
At the end of every productive session:
- **Update `GEMINI.md`**: Current State table + Next priorities. **No separate `handoff.md`.**
- **Update `CLAUDE.md`**: If tech stack, commands, or architecture changed.
- **Sign updates**: Mark every doc change with `(Updated by Gemini CLI — [date])`.

### 2. Version Management
Increment patch version in `package.json` after a successful production deploy.
State: "I am incrementing the version to [X] as per GEMINI.md" before doing so.

### 3. Deployment
- **Hosting**: Vercel ([supermom-s7-r3-tch.vercel.app](https://supermom-s7-r3-tch.vercel.app))
- **Auto-deploy**: Connected to GitHub (`S7R3TCH-ops/supermom`). `git push origin main` deploys to production. Do NOT run `vercel --prod` manually.

---

## ⚠️ Read Before Any Refactor or Lint Pass

`docs/gemini-import-map.md` — mandatory before touching imports, renaming functions, or running cleanup. Lists canonical symbol locations. A refactor in May 2026 (Phase 25) broke 11 imports and had to be repaired by Claude Code. Do not repeat.

### Canonical symbol locations (updated v0.6.2)
After the v0.6.2 refactor, these symbols moved. The old locations no longer exist:

| Symbol | Old location | New location |
|---|---|---|
| `sameDay`, `addDays`, `getWeekRange`, `fmtTime12`, `fmtTimeRange`, `dateBrief` | `src/pages/Home.jsx` | `src/lib/dateUtils.js` |
| `composeTorontoISO` | `src/data/jobsRepo.js` (defined) | `src/lib/dateUtils.js` (defined); `jobsRepo.js` re-exports for compat |
| `computeJobTotal` (was `computeTotal`) | `src/pages/Home.jsx` | `src/lib/financialMath.js` |
| `getBriefingMessage` (was inline useMemo) | `src/pages/Home.jsx` | `src/lib/briefingMessages.js` |
| `JobCard`, `UpcomingCard`, `EmptyState`, `LiveTimer`, `MissionIntel`, `PaymentBreakdown` | `src/pages/Home.jsx` | `src/components/cards/` |

---

## Technical Context

- **Timezone**: `America/Toronto` (always)
- **Target viewport**: Mobile-first, `100svh`
- **Supabase project**: `lskzzsjmmtsosfneuovt`
- **Schema source of truth**: `supabase_schema.sql` at repo root
- **App status**: Live. All 5 pages (Home, Calendar, Clients, Finance, Settings) read real data.

### Hourly job field conventions — critical
- `flat_rate` = $/hr rate for Hourly jobs (not a flat fee). NewJobSheet always writes it this way.
- `total_amount` = finalized actual total written on job completion (as of v0.12.1). For Scheduled jobs it still holds the booking estimate. Always use `computeJobFinancials()` in UI — never read `total_amount` raw in components.
- `subtotal` (DB) = base labor. `hst_amount` = finalized HST. Both written on completion alongside `total_amount`.
- `payments` table = source of truth for what's collected. `payment_status` is a cached status only.

---

## Current State (v0.12.74 — Jun 16, 2026)

| Feature | Status |
|---|---|
| Auth (login / forgot password) | ✅ Live — sm-input focus rings, 44px tap targets, brand logo, sentence-case labels (v0.12.61) |
| Home — always-today dashboard | ✅ Live — loading skeleton, revenue widget as button, owing flat rows, visibilitychange handler, per-route ErrorBoundary (v0.12.54–69) |
| Calendar | ✅ Live — hero border always visible, nav/today typed buttons, AgendaCard div→button, filter chip div→button (v0.12.60) |
| Clients list | ✅ Live — stat tiles as buttons w/ aria-pressed, search focus ring restored, count badges on chips, "Owes $" label, clear × on search (v0.12.56) |
| Client profile | ✅ Live — back→/clients, 44px tap targets, focus rings on AI textareas, job rows as buttons, AI insights label (v0.12.52–53) |
| Finance | ✅ Live — Fraunces revenue hero, dynamic period label, StatCard/TransactionRow as buttons, Tax Ready collapsible, "You cleared $X after expenses" sub-label (v0.12.57–58) |
| Settings | ✅ Live — in-app two-tap Reset All Data, focus rings, avatar as button, save button in persistent footer, sentence-case labels, 44px password toggle (v0.12.59) |
| New Job sheet | ✅ Live — focus rings, step progress bar (3-segment), recent-client/service as buttons, 44px close, sentence-case, step review date formatted (v0.12.55) |
| Job Detail sheet | ✅ Live — in-app future-date confirm, EditMode 4 named sections, "Revert to Scheduled (Admin)" replaces "Mark as Unpaid" (v0.12.74) |
| New Client sheet | ✅ Live — focus rings, 44px close, sentence-case, VIP checkbox enlarged, Intel labels expanded (v0.12.61) |
| Edit Client sheet | ✅ Live — focus rings, 44px close, sentence-case, VIP enlarged, dark-mode delete tint (v0.12.60) |
| Post-job / Wrap-up sheet | ✅ Live — send nudge screen, pre-flight bundle/settle step, haptic feedback on submit (v0.12.60–72) |
| Prep Note sheet | ✅ Live — sentence-case, type="button" on close (v0.12.60) |
| Finance Detail sheet | ✅ Live — JobRow div→button, worker cost amber text (v0.12.60) |
| Admin | ✅ Live — ToolRow div→button, in-app confirms for delete/restore, persona cards as buttons, sm-input on inputs (v0.12.61) |
| Invoicing | ✅ Live — payment rows show service name + date/method + green amount; flat-rate "Flat rate" sub-label; brand pink #FC4693 heading; multi-job invoices; settlement; receipt layout (v0.12.67–73) |
| Daily briefing email | ✅ Live — `api/briefing/daily.js`, 7am EDT via Vercel cron (`0 11 * * *`) |
| AI Prep Notes + Duration Estimator | ✅ Live |
| GCal Sync | ✅ Live — `sync_status` column detects `invalid_grant`; amber banner on Home if expired; Settings warning card (v0.12.63) |
| Drive time / mileage | ✅ Live — GPS timeout 12s, visibilitychange handler, stale-guard >10 min (v0.12.64) |
| Geofence / auto-timer | ✅ Live |
| Super Admin + Viewpoint switching | ✅ Live |
| Dark mode toggle | ✅ Live — warm/dark via smTokens(); toggle in logo bar |
| Privacy toggle | ✅ Live |
| Storage (photos + voice notes) | ✅ Live |
| Conflict detection | ✅ Live |
| Haptic feedback | ✅ Live — `src/lib/haptics.js`, triggered on book/complete/pay/submit/destructive (v0.12.64) |
| DESIGN.md | ✅ Regenerated v2.0 — Stitch-compliant frontmatter, dual-theme documented, `.impeccable/design.json` sidecar with 9 component snippets (v0.12.62) |

---

## Next priorities

1. **⚠️ Device verification** — v0.12.52–74 not fully phone-tested. v0.12.67 crash fix deployed but unverified on real devices. Test Home page + invoice flow on Pixel 10 Pro + Sandra's iPhone.
2. **GCal sync — root cause unfixed** — OAuth app still in "Testing" mode → refresh tokens expire after 7 days. Joel must go to Google Cloud Console → OAuth consent screen → Publish App. Sandra reconnects once after.
3. **AI chat interface** — `api/ai/[action].js` + `ANTHROPIC_API_KEY` in place. Needs chat UI + conversation state. HIGH PRIORITY.
4. **Client invoice history** — Add "Invoices" section to ClientProfile listing all invoices per client, tappable to `/i/:id`.
5. **Offline mode** — app crashes if Supabase unreachable on first load. Per-page `ErrorBoundary` exists (v0.12.64) but no "tap to reload" fallback copy yet.
6. **Vercel function slot** — 9/12 used. Consider consolidating `transcribe` into `ai/[action]` to free a slot.

### Key data-layer rules (NEVER skip)
- `revertJobToPreCompletion(id)` — admin revert: deletes payments, voids invoice (`status='Void'` + `deleted_at`), resets job to `Scheduled`, nulls `actual_duration`/`subtotal`/`hst_amount`/`total_amount`/`completion_notes`.
- `markJobUnpaid` no longer exists — renamed to `revertJobToPreCompletion`.
- `jobs.tax_enabled` nullable: NULL = inherit from `business.tax_enabled`.
- Always `computeJobFinancials()` for UI math — never read `total_amount` raw.

### Vercel function count
9 of 12 serverless functions used: `maps`, `invoice`, `auth/google/login`, `auth/google/callback`, `briefing/daily`, `sync/gcal`, `ai/[action]`, `transcribe`, `admin/provision`. 3 remaining.

(Updated by Claude Code — June 16, 2026)
