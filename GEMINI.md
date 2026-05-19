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
- **Hosting**: Vercel ([supermom-v2.vercel.app](https://supermom-v2.vercel.app))
- **Auto-deploy**: Connected to GitHub (`S7R3TCH-ops/supermom-v2`). `git push origin main` deploys to production. Do NOT run `vercel --prod` manually.

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
- `total_amount` = booking-time estimate only. Never updated after job completion.
- True completed total = `flat_rate × actual_duration + additional_cost + hst_amount`
- `payments` table = source of truth for what's collected. `payment_status` is a cached status only.

---

## Current State (v0.6.6 — May 19, 2026)

| Feature | Status |
|---|---|
| Auth (login / forgot password) | ✅ Live |
| Home — always-today dashboard | ✅ Live — Command Brief hero; Today/Needs Action/Rest of Week/Done This Week sections (v0.6.5) |
| Home hero banner text | ✅ Live — Fraunces serif; time-of-day + nickname system |
| Calendar — Day/Week/Agenda | ✅ Live — dynamic timeline bounds, cancelled jobs shown grey (v0.6.3) |
| Job cancellation (all users) | ✅ Live — cancel with required reason; status → Cancelled; shown in history (v0.6.3) |
| Job delete (admin only) | ✅ Live — "Delete Job (Admin)" in JobDetailSheet; soft-delete (v0.6.3) |
| Client archive (admin only) | ✅ Live — danger zone in ClientProfile; cascades to all jobs (v0.6.3) |
| Financial math unification | ✅ Live — computeJobFinancials single source of truth everywhere (v0.6.3) |
| Clients list + profile | ✅ Live — A-Z sort; interactive hero stat filters; Owes $ filter fixed for null payment_status (v0.6.6) |
| Clients "Owes $" filter | ✅ Live — uses computeJobTotal (correct hourly math); null payment_status treated as unpaid (v0.6.6) |
| Finance — period filtering + drill-down tiles | ✅ Live — Week/Month/Year/All; all 4 tiles clickable; correct hourly math (v0.6.4) |
| Finance — trend chart | ✅ Live — SVG area/line chart, revenue vs expenses, real data (v0.6.4) |
| Finance — mark paid, expenses, CSV export | ✅ Live |
| New Job sheet — Start/End/Duration sync | ✅ Live — Start → End row; duration stepper all in sync; start is anchor (v0.6.6) |
| Job Detail sheet — Start/End/Duration sync | ✅ Live — Start → End row in edit mode; Est. hours synced with end time (v0.6.6) |
| Post-job / Wrap-up sheet | ✅ Live — hours prompt removed, liveTotal includes HST |
| Financial Math Breakdown | ✅ Live — shows payment history + remaining balance |
| Automated Invoicing | ✅ Live — actual total, only on Paid, rate from flat_rate |
| AI Prep Notes + Duration Estimator | ✅ Live |
| Recurrence series editor | ✅ Live — this / future / all |
| GCal Sync | ✅ Live |
| Drive time / mileage | ✅ Live |
| Geofence / auto-timer | ✅ Live |
| Super Admin + Viewpoint switching | ✅ Live |
| Dark mode toggle | ✅ Live |
| Swipe-to-dismiss sheets | ✅ Live |
| Privacy toggle | ✅ Live |
| Storage (photos + voice notes) | ✅ Live |
| Conflict detection | ✅ Live — cancelled jobs excluded from conflict input (v0.6.3) |
| Code-split bundle | ✅ Live |

---

## Next priorities

1. **Sandra user testing** — gather live friction points from real use; test new Start/End time UX on Sandra's iPhone
2. **WeekView cancelled job treatment** — currently shows pink/green based on paid status; should go grey for cancelled (minor oversight from v0.6.3)
3. **Daily job briefing email** — Vercel Cron (7am Toronto), Resend for transactional email; today + tomorrow jobs, outstanding payments (Phase 2, parked)
4. **Client engagement tools** — AI-suggested follow-ups and re-booking reminders
5. **Offline mode** — app crashes if Supabase unreachable on initial load
6. **Credential rotation** — DB password + GitHub token were in a public repo commit; may still need rotation (check memory file)

(Updated by Claude Code — May 19, 2026 — v0.6.6)
