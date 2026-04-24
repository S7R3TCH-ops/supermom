# Handoff Report — April 24, 2026 (PM)

## Overview
App is wired to the existing Supabase project (`lskzzsjmmtsosfneuovt`). All 5 pages read live data. Mark-paid affordance and forgot-password flow shipped this pass. Mock data files deleted. Schema source of truth: `supabase_schema.sql`.

---

## What works end-to-end (Supabase-backed)

| Path | Status |
|---|---|
| Login (`/`) | ✅ email/password + **Forgot password** (sends reset link via Supabase) |
| Sign out | ✅ tap avatar (top-right pink bar) |
| Home (`/`) | ✅ today's schedule, Opening Act, conflict detection, revenue today, overdue strip |
| Clients (`/clients`) | ✅ list + "+" → NewClientSheet |
| Client Profile (`/clients/:id`) | ✅ upcoming/history derived from real jobs |
| Calendar (`/calendar`) | ✅ Day/Week/Agenda, conflict detection, GO button |
| Finance (`/finance`) | ✅ Week/Month/Year/All toggle, Collected/Outstanding/Hours, last-7-day bars, Recent Activity |
| **Mark paid** | ✅ tap any unpaid row in Finance Recent Activity → confirm → `payment_status='Paid'`, `job_status='Completed'` |
| New Job FAB → NewJobSheet | ✅ books to `jobs` table |
| New Client (inline from NewJobSheet) | ✅ |

Auto-refresh: writes dispatch `supermom:data-changed`; pages refetch.

## Known gaps / not yet wired
- **GO button PNG** — `/branding/supermom-go.png` still missing. SVG fallback in place. Drop the real PNG at `public/branding/supermom-go.png` to use it.
- **Drive time / mileage** — hardcoded "—" placeholders. Needs Google Maps integration.
- **AI cards** (nudges, agent activity) — static UI, no LLM call.
- **`payments` table audit row** — mark-paid flips `jobs.payment_status` only; doesn't yet insert into `payments`. Add when invoice flow lands.
- **Real-time subscriptions** — refresh is event-driven from local writes only.

---

## Done this session (PM)
- **Mark-paid affordance** in Finance Recent Activity (`src/pages/Finance.jsx`). Tap unpaid row → confirm → `updateJob(id, { payment_status: 'Paid', job_status: 'Completed' })`.
- **Forgot password** on Login screen. Uses `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`.
- **Deleted mock data files** — `src/data/clients.js` and `src/data/jobs.js` are gone. NewJobSheet had its own inline SERVICES const, so nothing broke.
- **Deleted deprecated** `supabase/schema.sql` + `supabase/seed.sql` (wrong-direction v2 schema attempt).
- Build still green (520 kB raw / 144 kB gzipped).

---

## Provisioning (already done)
`node scripts/provision.mjs` already created admin user + business + 7 services. Idempotent — safe to re-run.

- `jlundie@gmail.com` / `TempPass2026!` (change in Supabase Authentication tab)
- Business: "Supermom for Hire" (Georgetown ON)
- 7 services seeded

**Sandra's account intentionally NOT created** until Joel signs off.

---

## Next steps (priority order)

### A. Vercel env vars (manual — needs your dashboard access)
Add to Vercel project settings → Environment Variables:
- `VITE_SUPABASE_URL` = `https://lskzzsjmmtsosfneuovt.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `sb_publishable_HIMt19mOuS7eHBeb7WhNkQ_UFhgLh70`

**Do NOT add `SUPABASE_SERVICE_ROLE_KEY`** — that's local-only for `scripts/`.

Also: in Supabase dashboard → Authentication → URL Configuration, add the Vercel deploy URL as a redirect URL so the password reset link works in prod.

### B. Drop the real GO button PNG
Save `public/branding/supermom-go.png` (current art). SVG fallback removes itself automatically once the PNG loads.

### C. `payments` audit row on mark-paid
When the invoice/payments flow lands, change `markPaid()` in Finance.jsx to also insert a row into `payments` (method='Cash'/'e-Transfer', amount, paid_at).

### D. Sign-up
Not needed — Joel/Sandra are admin-provisioned via `scripts/provision.mjs`. Skip unless we onboard a third operator.

### E. Code-split the bundle
`@supabase/supabase-js` pushed bundle from 320 → 520 kB. Lazy-load auth/repos. Not urgent.

---

## Known issues / gotchas
- **Toronto DST math** is hardcoded month-ranges in `jobsRepo.decorateJob` and `NewJobSheet.torontoISO`. Wrong on the boundary days (2nd Sun March, 1st Sun Nov).
- **Conflict detection** runs in JS over already-fetched jobs (not a DB query).
- **Recurrence** stored in `jobs.ai_context.recurrence_rule`. Migrate to `job_templates` when that UI ships.

## Verification
- `npm run build` → green, 519.96 kB raw / 144.37 kB gzipped
- DB row counts after provision: businesses=1, users=1, services=7, clients/jobs depend on what you've added through the UI

## Key files for next session
- `src/data/useData.js`, `selectors.js`, `clientsRepo.js`, `jobsRepo.js`, `currentBusiness.js` — data layer
- `src/pages/Finance.jsx` — mark-paid handler lives here
- `src/pages/Login.jsx` — forgot-password handler
- `supabase_schema.sql` — schema source of truth
- `scripts/provision.mjs`, `scripts/inspect.mjs`, `scripts/seed.mjs` — DB tools
