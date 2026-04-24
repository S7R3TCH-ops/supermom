# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers cleaning, organizing, decluttering, caregiving, and errands — all self-booked after client calls or texts.

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
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context or Zustand (decide before first data fetch) |

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
- **API Keys**: Use `VITE_` prefix for all environment variables (e.g., `VITE_SUPABASE_URL`).
- **Mock Data**: Current version uses mock data for visual prototype; backend integration pending.

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
- Queries are scoped by `business_id` resolved via `src/data/currentBusiness.js` (caches the lookup against `auth.users.id` → `users.business_id`).
- Display fields the schema doesn't store (initials, color hashes, derived `last`/`next`/`amt`) live in `src/data/selectors.js` (`toDisplayClient`, `toDisplayJob`).
- The UI's expected `scheduled_at` ISO is composed in `jobsRepo.decorateJob()` from `scheduled_date` + `scheduled_time` (Toronto local).
- Pages subscribe to `supermom:data-changed` (dispatched by `notifyDataChanged()` after writes) so they auto-refresh.
- Recurrence is stored in `ai_context.recurrence_rule` on each job today. When we add the templates UI, switch to `job_templates`.

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
- **Soft deletes only** — never hard delete jobs or clients (`is_deleted = true`)
- **Recurrence**: jobs can repeat weekly/biweekly/monthly. Each occurrence is its own row with a `recurrence_parent_id` pointer
- **HST is currently OFF** — Sandra is below the threshold. The toggle exists in config for when she crosses it
- **Timezone is always `America/Toronto`** — never use system timezone

---

## Core features (build order)

1. Auth (Supabase login)
2. Home screen — Today Card (3 states)
3. New Job booking flow (bottom sheet, 3 steps)
4. Calendar screen (Day view first, then Week + Agenda)
5. Auto-timer via geofence (on GO! tap)
6. Auto-mileage tracking
7. Clients screen (list + profile)
8. Finance screen
9. Google Calendar sync
10. AI context features (duration estimate, nudge drafts, prep notes)

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
