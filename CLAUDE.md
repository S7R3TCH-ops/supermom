# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers organizing, decluttering, caregiving, life coaching, and errands — all self-booked after client calls or texts.

This is a **managed service product** — Sandra is the first user, but the architecture should support onboarding other solo operators in future.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Styling | Tailwind CSS + CSS custom properties (see DESIGN.md) |
| Auth | Supabase Auth (email/password, no social login yet) |
| Database | Supabase (Postgres) |
| Hosting | Vercel ([supermom-v2.vercel.app](https://supermom-v2.vercel.app)) |
| Performance | Code-splitting (`React.lazy` + `Suspense`) |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context (chosen — no Zustand) |

---

## Repo structure (target: supermom-v2)

```
supermom-v2/
├── CLAUDE.md
├── DESIGN.md
├── .env.example               ← Template for secrets
├── public/
```

---

## Security & Environment
- **CRITICAL**: Never commit `.env` or the `docs/` folder. They are ignored in `.gitignore`.
- **API Keys**: Use `VITE_` prefix for all client-side env vars (e.g., `VITE_SUPABASE_URL`). Server-only keys (e.g. `GOOGLE_MAPS_API_KEY`) live in Vercel env without the `VITE_` prefix and are accessed only in `api/` serverless functions.
- **Mock Data**: Gone. All pages query live Supabase data. Do not re-introduce mock data.

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.** That file is a snapshot of the live Supabase project (`lskzzsjmmtsosfneuovt`) and reflects the actual schema the app queries. Do not invent a parallel/simpler schema — extend the existing one.

The schema is multi-tenant and agentic-AI-ready (richer than this app strictly needs today, designed to support multiple operators and future automation):

| Table | Purpose |
|---|---|
| `businesses` | One row per operator's business (Sandra → "Supermom for Hire") |
| `users` | Links `auth.users.id` → `business_id`, with role (`owner`/`admin`/`worker`) |
| `clients` | `first_name`/`last_name` (split), `business_id`-scoped, `ai_context` jsonb, `tags` array, soft-delete via `deleted_at` |
| `jobs` | `scheduled_date` + `scheduled_time` (separate cols, not a single `scheduled_at`), `pricing_type` (Hourly/Flat), `total_amount`, `job_status`, `payment_status`, `ai_context` jsonb |
| `services` | Service catalog per business (Deep Clean, Regular, Quick Tidy, Organize, Declutter+Org., Move Out, Custom) |
| `job_templates` + `template_schedule` | Recurrence engine — a template generates scheduled jobs |
| `invoices` + `invoice_jobs` + `payments` | Billing |
| `expense_log` | Mileage / supplies / etc. |
| `audit_log` / `communication_log` / `notification_log` | Activity history |
| `config` | Per-business key/value settings |

### Repo / data layer rules
- All queries go through `src/data/clientsRepo.js` + `src/data/jobsRepo.js` — pages do not call `supabase` directly.
- Queries are scoped by `business_id` resolved via `src/data/currentBusiness.js` (caches the lookup against `auth.users.id` → `users.business_id`). **Every** `select`, `insert`, `update`, and `delete` must include `.eq('business_id', businessId)` — including `updateJob` and `updateClient`.
- Display fields the schema doesn't store (initials, color hashes, derived `last`/`next`/`amt`) live in `src/data/selectors.js` (`toDisplayClient`, `toDisplayJob`).
- The UI's expected `scheduled_at` ISO is composed in `jobsRepo.decorateJob()` from `scheduled_date` + `scheduled_time` (Toronto local) via `composeTorontoISO()`. That function uses `nthSunday()` to correctly calculate DST boundaries — do not simplify it back to a month-range approximation.
- Pages subscribe to `supermom:data-changed` (dispatched by `notifyDataChanged()` after writes) so they auto-refresh. `notifyDataChanged` is defined in `src/data/useData.js` and imported by both `useData.js` hooks and `src/data/realtime.js`.
- Recurrence is stored in `ai_context.recurrence_rule` on each job today. When we add the templates UI, switch to `job_templates`.
- `signOut` in `src/context/Auth.jsx` must call `clearBusinessCache()` before `supabase.auth.signOut()` to prevent stale business_id after logout.

### GeofenceContext rules
- `src/context/GeofenceContext.jsx` uses a `trackingJobRef` ref that mirrors the `trackingJob` state. All state updates go through `setTracking()` (not `setTrackingJob()` directly) to keep the ref in sync.
- **Never put side effects inside the state updater.** The `watchPosition` callback reads `trackingJobRef.current` synchronously, updates state via `setTracking()`, then fires async side effects (`handleClockIn`, `setTimeout`) outside the updater. React 19 concurrent mode calls updater functions multiple times — side effects inside them cause duplicate DB writes.

### Field-name gotchas (real schema vs. naive expectations)
- `clients.first_name` + `clients.last_name` (not `name`)
- `jobs.scheduled_date` + `jobs.scheduled_time` (not `scheduled_at`)
- `jobs.estimated_hours` (decimal hours, not `duration_est` minutes)
- `jobs.total_amount` / `subtotal` / `flat_rate` (not `total`/`rate`)
- `jobs.job_status` (`'Scheduled'`/`'Completed'`/`'Cancelled'` — capitalized)
- `jobs.payment_status` (`''`/`'Partial'`/`'Paid'` — empty string for unpaid, capitalized)
- `jobs.job_notes` (not `notes`)
- Soft delete = `deleted_at IS NOT NULL` (not `is_deleted = true`)

---

## Key business rules

- **Sandra books all jobs herself** — no self-serve client booking yet
- **Payment is cash or e-Transfer only** — no Stripe, no online processing
- **Soft deletes only** — never hard delete jobs or clients. Set `deleted_at = now()`, never `is_deleted`. Filter with `.is('deleted_at', null)`.
- **Recurrence**: Jobs can repeat weekly, biweekly, or monthly. Each series is managed via the `job_templates` table. `jobs.template_id` links occurrences to their template.
- **Series Actions**: The UI and `jobsRepo` support `'this'`, `'future'`, and `'all'` actions for updates and deletions.
- **AI Module**: `src/data/ai.js` contains the logic for briefings and duration estimation.
- **HST is currently OFF** — Sandra is below the threshold. The toggle exists in config for when she crosses it
- **Timezone is always `America/Toronto`** — never use system timezone

---

## Core features (build status)

- [x] Auth (Supabase login)
- [x] Home screen — Today Card (3 states)
- [x] New Job booking flow (bottom sheet, 3 steps)
- [x] Calendar screen (Day view, Week, Agenda)
- [x] Client Search — live filtering in Clients roster
- [x] Payments Audit — `recordPayment` logs to `payments` table
- [x] Nudge Drafts — AI-ready SMS reminders for overdue jobs
- [x] Auto-timer via geofence (on GO! tap)
- [x] Auto-mileage tracking (Google Maps integration)
- [x] Storage bucket (photos + voice notes)
- [x] Google Calendar sync — OAuth via `/api/auth/google/` and sync via `/api/sync/gcal`
- [x] AI context features (duration estimate, prep notes)


---

## Critical rules — read before every build

- **Read `DESIGN.md` before writing any component** — all tokens, spacing, radius, typography, and component anatomy are defined there
- **Mobile-first** — design for 390px wide iPhone viewport first
- **No Start Timer button** — geofence auto-starts the timer on arrival
- **All dollar amounts use `font-variant-numeric: tabular-nums`** and Fraunces serif
- **No purple gradients, no Inter for display text, no generic AI aesthetics** — see DESIGN.md
- **Logo banner uses real PNG images** in production — SVG placeholders only in dev
- **Conflict warning** fires when any two jobs are within 1 hour of each other (including travel time estimate)
- **Google Calendar sync is core**, not Phase 2 — every job create/edit/cancel must sync
- **Increment version numbers** in package.json on every meaningful release

---

## Parked / not building yet

- [ ] Start Timer manual button (geofence handles it — revisit only if Sandra requests)
- [ ] Dark mode toggle (planned, not designed)
- [ ] Self-serve client booking link (Phase 2)
- [ ] Sandra's user guide (separate doc, after app stable)
- [ ] Settings / Profile screen (service rates config etc)
- [ ] Onboarding flow
- [ ] Minxy project (same template, different operator — after SMHQ ships)
