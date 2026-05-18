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

## Current State (v0.6.2 — May 18, 2026)

| Feature | Status |
|---|---|
| Auth (login / forgot password) | ✅ Live |
| Home — schedule, revenue, week strip | ✅ Live — payment clarity overhaul (v0.6.0) |
| Home hero banner text | ✅ Live — live briefing message promoted to hero; Fraunces serif; time-of-day + nickname system (May 18) |
| Calendar — Day/Week/Agenda | ✅ Live |
| Clients list + profile | ✅ Live — A-Z sort; interactive hero stat filters |
| Finance — mark paid, expenses, CSV export | ✅ Live |
| New Job sheet | ✅ Live — stepper duration, service rates, custom price, additional costs |
| New Job flat rate breakdown | ✅ Fixed — liveForm.flat_rate now correctly read by FinancialMathBreakdown (May 18) |
| Job Detail sheet | ✅ Live — payment history in financial summary (v0.5.9) |
| Post-job / Wrap-up sheet | ✅ Live — hours prompt removed, liveTotal includes HST (v0.6.1) |
| Financial Math Breakdown | ✅ Live — shows payment history + remaining balance (v0.5.9) |
| Home card payment display | ✅ Live — green paid, pink owing, rate math, job notes on upcoming cards (v0.6.0) |
| Automated Invoicing | ✅ Live — uses actual total, only created when Paid, rate from flat_rate (v0.6.1) |
| AI Prep Notes + Duration Estimator | ✅ Live |
| AI Thank-you / Receipt sheet | ✅ Live |
| Recurrence series editor | ✅ Live — this / future / all |
| GCal Sync | ✅ Live |
| Drive time / mileage | ✅ Live |
| Geofence / auto-timer | ✅ Live |
| Super Admin + Viewpoint switching | ✅ Live |
| Dark mode toggle | ✅ Live |
| Onboarding flow | ✅ Live |
| Swipe-to-dismiss sheets | ✅ Live |
| Privacy toggle | ✅ Live |
| Storage (photos + voice notes) | ✅ Live |
| Conflict detection | ✅ Live |
| Haptic feedback | ✅ Live |
| Code-split bundle | ✅ Live |

---

## Next priorities

1. **Sandra user testing** — gather live friction points from real use; v0.6.0+ has significant UI changes to verify on her iPhone
2. **Hero layout stability** — prevent layout jumps when navigating week strip days
3. **Client engagement tools** — AI-suggested follow-ups and re-booking reminders
4. **Offline mode** — app crashes if Supabase unreachable on initial load
5. **Credential rotation** — DB password + GitHub token were in a public repo commit; may still need rotation (check memory file)

(Updated by Claude Code — May 18, 2026 — v0.6.2 refactor)
