# Handoff Report — April 24, 2026

## Overview
Wired the app to the **existing** Supabase project (`lskzzsjmmtsosfneuovt`) and migrated the auth + write/read paths so the user can add real data through the UI. Three pages still read from mock data (Home, ClientProfile, Finance) — they're the next migration chunk.

> Important pivot from previous session: CLAUDE.md previously described a simplified v2 schema. **The real source of truth is `supabase_schema.sql`** (the elaborate multi-tenant schema already deployed). CLAUDE.md was rewritten to point at that file. The half-built `supabase/schema.sql` + `supabase/seed.sql` from yesterday should be ignored / can be deleted.

---

## What works end-to-end (Supabase-backed)

**All 5 pages now read from Supabase** — the prototype mock files (`src/data/clients.js`, `src/data/jobs.js`) are no longer imported anywhere except the SERVICES catalog inside `NewJobSheet.jsx`.

| Path | Status |
|---|---|
| Login (`/`) | ✅ email/password via `supabase.auth` |
| Sign out | ✅ click avatar (top-right pink bar) |
| Home (`/`) | ✅ today's schedule, Opening Act = next upcoming job, tight-gap detection, revenue today, overdue-jobs strip — all from real data |
| Clients (`/clients`) | ✅ list from Supabase, "+" header button opens NewClientSheet, filters work on display shape |
| Client Profile (`/clients/:id`) | ✅ uses `useClient(id)`, upcoming/history derived from real jobs |
| Calendar (`/calendar`) Day/Week/Agenda | ✅ live data, conflict detection, GO button on next today's job |
| Finance (`/finance`) | ✅ Week/Month/Year/All toggle filters, Collected/Outstanding/Hours computed live, last-7-day bar chart, Recent Activity = real jobs sorted desc |
| New Job FAB → NewJobSheet | ✅ lists clients from Supabase, inline "+ New client", books to `jobs` table |

Auto-refresh: any write dispatches `supermom:data-changed` on `window`; pages using `useClients/useJobs/useClient` subscribe and refetch.

## Known gaps / not yet wired
- **No "mark paid" affordance** — jobs are created with `payment_status: ''` (unpaid) and there's no UI to change it. Finance's "Collected" stays at $0 until this ships. Should be a tap on the job in Calendar Day or in Recent Activity.
- **GO button asset** — `/branding/supermom-go.png` is missing from `public/branding/`. Component falls back to an inline pink cape SVG so it still looks intentional. Drop the real PNG at `public/branding/supermom-go.png` to use it.
- **Drive time / mileage** — hardcoded "—" placeholders. Needs Google Maps integration.
- **AI cards** (nudges, agent activity) — still static UI, no LLM call yet.

---

## Files added / changed this session

### Added
- `.env` (gitignored) — Vite-prefixed Supabase URL + anon key + service role key
- `src/lib/supabase.js` — singleton client
- `src/context/Auth.jsx` + `AuthContext.js` — auth provider, exposes session/user/signIn/signOut
- `src/pages/Login.jsx` — themed sign-in screen
- `src/data/currentBusiness.js` — resolves `auth.users.id → users.business_id`, cached
- `src/data/clientsRepo.js` — `fetchClients`, `fetchClientById`, `createClient`, `updateClient`, `softDeleteClient`
- `src/data/jobsRepo.js` — `fetchActiveJobs`, `fetchJobsByClientId`, `fetchJobById`, `createJob`, `updateJob`, `softDeleteJob`, `findConflicts`, `decorateJob` (composes `scheduled_at` from date+time)
- `src/data/selectors.js` — `toDisplayClient` / `toDisplayJob` derive UI fields (init, color, last/next/amt, tags) from raw DB rows
- `src/data/useData.js` — `useClients` / `useClient` / `useJobs` hooks + `notifyDataChanged()` event helper
- `src/components/sheets/NewClientSheet.jsx` — bottom-sheet form for creating a client
- `scripts/inspect.mjs` — read-only DB inspection
- `scripts/provision.mjs` — minimal one-time setup (admin user + business + users link + services)
- `scripts/seed.mjs` — full mock-data seed (NOT auto-run — admin already provisioned without it)
- `supabase/schema.sql`, `supabase/seed.sql` — leftover from the wrong-direction v2 schema attempt; **ignore / delete**

### Changed
- `src/App.jsx` — wraps in `AuthProvider`, gates routes via `<Gate />`, shows LoginShell when no session
- `src/components/layout/LogoBar.jsx` — avatar is now a sign-out button (confirms first), shows current user's first initial
- `src/components/sheets/NewJobSheet.jsx` — fetches clients via repo, persists via `createJob`, opens NewClientSheet from step 1
- `src/pages/Clients.jsx` — uses `useClients`, "+" button opens NewClientSheet, empty state, loading state, computes Total/Outstanding/VIP from real data
- `src/pages/Calendar.jsx` — uses `useJobs`, `TODAY` is real `new Date()` (was hardcoded to 2026-04-22)
- `CLAUDE.md` — rewrote schema section to point at `supabase_schema.sql`, added field-name gotchas, documented data-layer rules
- `package.json` — added `@supabase/supabase-js`, `dotenv` (devDep)

---

## Provisioning (already done — don't re-run unless DB is wiped)

`node scripts/provision.mjs` created:
- auth user `jlundie@gmail.com` / `TempPass2026!` (change in Supabase Authentication tab)
- business: "Supermom for Hire" (Georgetown ON)
- users link: Joel as owner of that business
- 7 services (Deep Clean / Regular / Quick Tidy / Organize / Declutter+Org. / Move Out / Custom)

The script is idempotent — safe to re-run.

**Sandra's account is intentionally NOT created yet** (per project preference: don't provision end-users until owner signs off).

---

## Next steps (priority order)

### A. Wire "mark paid" affordance (highest impact)
Right now jobs are created with `payment_status: ''` (unpaid). Need a UI affordance to mark a job paid (`'Paid'`) — maybe a tap on the job card in Calendar Day view, or a swipe action. Inserts into `payments` table for the audit trail.

### B. Delete the mock data files
`src/data/clients.js` is no longer imported anywhere. `src/data/jobs.js` only exports the SERVICES catalog used by `NewJobSheet.jsx` — move SERVICES into a small `src/data/serviceCatalog.js` and delete the rest.

### C. Sign-up + password reset
Login screen only signs in. Add "Forgot password" link using `supabase.auth.resetPasswordForEmail`. Sign-up isn't needed — Joel/Sandra are admin-provisioned.

### D. Vercel env vars
For prod deploys: add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to Vercel project settings. **Do NOT add `SUPABASE_SERVICE_ROLE_KEY`** — that's local-only for the scripts in `scripts/`.

### E. Code-split the bundle
`@supabase/supabase-js` pushed bundle from 320 → 522 kB. Could lazy-load auth/repos. Not urgent.

---

## Known issues / gotchas
- **Toronto DST math** is hardcoded month-ranges in `jobsRepo.decorateJob` and `NewJobSheet.torontoISO`. Wrong on the boundary days (2nd Sun March, 1st Sun Nov). Move to `Intl.DateTimeFormat` later.
- **Conflict detection** runs in JS over already-fetched jobs (not a DB query). Fine at small scale.
- **Recurrence** is stored in `jobs.ai_context.recurrence_rule` for now. When `job_templates` UI ships, migrate.
- **No real-time** subscriptions yet. Refresh is event-driven from local writes only — if Sandra opens the app on phone + laptop, they won't sync.

## Verification
- `npm run build` → green, 522.16 kB raw / 145.18 kB gzipped
- DB row counts after provision: businesses=1, users=1, services=7, clients=0, jobs=0
- Dev server starts cleanly on `:5173`

## Key files for next session
- `src/data/useData.js`, `selectors.js`, `clientsRepo.js`, `jobsRepo.js`, `currentBusiness.js` — the data layer
- `src/pages/Home.jsx`, `ClientProfile.jsx`, `Finance.jsx` — next to migrate
- `supabase_schema.sql` — schema source of truth
- `scripts/provision.mjs`, `scripts/inspect.mjs`, `scripts/seed.mjs` — DB tools
