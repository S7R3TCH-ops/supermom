# Handoff Report — April 24, 2026 (Evening)

## Overview
App is wired to Supabase (`lskzzsjmmtsosfneuovt`). All 5 pages read live data. Vercel env vars added and redeployed. GO button PNG committed to `public/branding/`. Schema source of truth: `supabase_schema.sql`.

---

## What works end-to-end (Supabase-backed)

| Path | Status |
|---|---|
| Login (`/`) | ✅ email/password + **Forgot password** |
| Sign out | ✅ tap avatar (top-right pink bar) |
| Home (`/`) | ✅ today's schedule, conflict detection, revenue, overdue strip |
| Clients (`/clients`) | ✅ list + NewClientSheet |
| Client Profile (`/clients/:id`) | ✅ upcoming/history from real jobs |
| Calendar (`/calendar`) | ✅ Day/Week/Agenda, conflict detection, GO button |
| Finance (`/finance`) | ✅ Week/Month/Year/All, mark-paid |
| New Job FAB → NewJobSheet | ✅ books to `jobs` table |
| New Client (inline from NewJobSheet) | ✅ |

---

## Done this session (Evening)
- **Vercel env vars added**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set in Vercel dashboard → redeployed → live site now Supabase-connected
- **Supabase redirect URL** added for password reset in prod
- **GO button PNG** (`public/branding/Supermom_go.png`) committed and pushed
- **`.gitignore` fixed**: changed `branding/` → `/branding/` so root design assets stay ignored but `public/branding/` is tracked

---

## Known gaps / not yet wired
- **Drive time / mileage** — hardcoded "—" placeholders. Needs Google Maps integration.
- **AI cards** (nudges, agent activity) — static UI, no LLM call.
- **`payments` table audit row** — mark-paid flips `jobs.payment_status` only; doesn't insert into `payments` yet.
- **Real-time subscriptions** — refresh is event-driven from local writes only.

---

## Provisioning (already done)
- `jlundie@gmail.com` / `TempPass2026!` (change in Supabase Authentication tab)
- Business: "Supermom for Hire" (Georgetown ON), 7 services seeded
- **Sandra's account intentionally NOT created** until Joel signs off

---

## Next steps (priority order)

### A. Verify live site
Visit `https://supermom-v2.vercel.app` — login should work, GO button should show real PNG, all pages should load real data.

### B. `payments` audit row on mark-paid
Change `markPaid()` in `src/pages/Finance.jsx` to also insert into `payments` (method, amount, paid_at) when invoice flow lands.

### C. Google Maps integration
Drive time + mileage — currently hardcoded "—". Wire Google Maps API for routing.

### D. Code-split the bundle
`@supabase/supabase-js` pushed bundle to 520 kB. Lazy-load auth/repos. Not urgent.

---

## Known issues / gotchas
- **Toronto DST math** hardcoded in `jobsRepo.decorateJob` and `NewJobSheet.torontoISO` — wrong on boundary days
- **Conflict detection** runs in JS over fetched jobs, not a DB query
- **Recurrence** stored in `jobs.ai_context.recurrence_rule` — migrate to `job_templates` when that UI ships

## Key files
- `src/data/useData.js`, `selectors.js`, `clientsRepo.js`, `jobsRepo.js`, `currentBusiness.js` — data layer
- `src/pages/Finance.jsx` — mark-paid handler
- `src/pages/Login.jsx` — forgot-password handler
- `supabase_schema.sql` — schema source of truth
- `scripts/provision.mjs`, `scripts/inspect.mjs`, `scripts/seed.mjs` — DB tools
