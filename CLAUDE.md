# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.

---

## What we're building

A mobile-first CRM & operations web app for **Sandra**, a solo personal-life-operations business owner in Georgetown, ON. She offers organizing, decluttering, caregiving, life coaching, and errands — all self-booked after client calls or texts.

This is a **managed service product** — Sandra is the first user, but the architecture should support onboarding other solo operators in future.

### Platform Hierarchy
- **Super Admin (Joel)**: Global admin role (`admin` in DB). Not linked to any specific business. Has ultimate authority to switch "Viewpoints" and manage the platform.
- **Business Owners (Sandra, etc.)**: Linked to their own `business_id` as `owner` role. They see only their own data.

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

## Common Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start local development server |
| `node scripts/reset-platform.mjs` | Wipes all client data, preserves Super Admin (Joel) |
| `node scripts/provision-sandra.mjs`| Re-creates Sandra's business and owner account fresh |
| `node scripts/inspect.mjs` | Summary of current DB tables and users |

---

## Security & Environment
- **CRITICAL**: Never commit `.env`. They are ignored in `.gitignore`.
- **API Keys**: Use `VITE_` prefix for all client-side env vars (e.g., `VITE_SUPABASE_URL`). Server-only keys live in Vercel env without the `VITE_` prefix.

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.**

| Table | Purpose |
|---|---|
| `businesses` | One row per operator's business (Sandra → "Supermom for Hire") |
| `users` | Links `auth.users.id` → `business_id`, with role (`owner`/`admin`/`worker`) |
| `clients` | `business_id`-scoped, `ai_context` jsonb, `tags` array |
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `total_amount`, `job_status`, `payment_status` |

### Repo / data layer rules
- **Multi-tenancy**: Every `select`, `insert`, `update`, and `delete` must include `.eq('business_id', businessId)`.
- **Null Business Support**: `currentBusiness.js` and `useData.js` support `null` business IDs for global admins (Joel) to allow platform-level access without being tied to a specific client business.
- **Viewpoint**: Super Admins switch between client businesses via `ViewpointContext.jsx`, which sets `window.__SUPER_VIEW_ID` and triggers a data refresh.
- **LogoBar**: Redirects Super Admins to `/admin` dashboard; regular owners to `/settings`.

(Updated by Gemini CLI)

---

## Key business rules

- **Sandra books all jobs herself** — no self-serve client booking yet
- **Payment is cash or e-Transfer only** — no Stripe, no online processing
- **Soft deletes only** — never hard delete jobs or clients. Set `deleted_at = now()`.
- **Timezone is always `America/Toronto`** — never use system timezone

---

## Core features (build status)

- [x] Auth (Supabase login)
- [x] Home screen — Today Card (Dynamic greeting; Next Up filtering; Interactive Week Strip)
- [x] New Job booking flow (bottom sheet, 3 steps)
- [x] Payments Audit — `recordPayment` logs to `payments` table
- [x] Automated Invoicing — public `/i/:id` web view; auto-generation on payment
- [x] Super Admin Dashboard — Viewpoint switching, platform management
- [x] Onboarding flow — EA Mission persona; Magic Button showoff
- [x] Dark mode toggle (Settings > Appearance)

---

## Critical rules — read before every build

- **Read `DESIGN.md` before writing any component** — all tokens, typography, and component anatomy are defined there
- **Mobile-first** — design for 390px wide iPhone viewport first
- **Increment version numbers** in package.json on every meaningful release

---

## Parked / not building yet

- [ ] Self-serve client booking link (Phase 2)
- [ ] Sandra's user guide (separate doc, after app stable)

