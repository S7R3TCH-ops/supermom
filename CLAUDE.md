# Supermom for Hire · CLAUDE.md

> Read this file at the start of every session. Read `DESIGN.md` before touching any UI code.
> **Living document rule**: After completing any meaningful task — building a feature, adding/removing a script, changing architecture, cleaning up files — update this file immediately to reflect the current state. Remove stale entries. Add new ones. Keep it accurate.

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

> **First time or after a clean:** `node_modules/` is gitignored. Run `npm install` before `npm run dev` if the folder is missing.

| Script | Purpose |
|---|---|
| `npm install` | Restore dependencies (run after cloning or cleaning) |
| `npm run dev` | Start local development server |
| `node scripts/reset-platform.mjs` | Wipes all client data, preserves Super Admin (Joel) |
| `node scripts/provision-sandra.mjs`| Re-creates Sandra's business and owner account fresh |
| `node scripts/inspect.mjs` | Summary of current DB tables and users |
| `node scripts/dedup-data.mjs` | Merge duplicate clients/jobs/services in local DB |

---

## Security & Environment
- **CRITICAL**: Never commit `.env`. They are ignored in `.gitignore`.
- **API Keys**: Use `VITE_` prefix for all client-side env vars (e.g., `VITE_SUPABASE_URL`). Server-only keys live in Vercel env without the `VITE_` prefix.

---

## Supabase Schema

> **Source of truth: `supabase_schema.sql` at repo root.**

| Table | Purpose |
|---|---|
| `businesses` | One row per operator's business (Sandra → "Supermom for Hire"); includes `ai_profile` for persona settings. |
| `users` | Links `auth.users.id` → `business_id`, with role (`owner`/`admin`/`worker`). |
| `clients` | `business_id`-scoped, `ai_context` jsonb, `tags` array. |
| `jobs` | `scheduled_date` + `scheduled_time`, `pricing_type` (Hourly/Flat), `total_amount`, `job_status`, `payment_status`. |
| `services` | Service catalog with `default_price` and `default_duration`. |
| `integrations`| OAuth tokens and settings for external services (e.g. Google Calendar). |
| `storage.job-assets` | Private bucket for job-related photos and voice notes. |

### Repo / data layer rules
- **Multi-tenancy**: Every `select`, `insert`, `update`, and `delete` must include `.eq('business_id', businessId)`.
- **Null Business Support**: `currentBusiness.js` and `useData.js` support `null` business IDs for global admins (Joel) to allow platform-level access without being tied to a specific client business.
- **Viewpoint**: Super Admins switch between client businesses via `ViewpointContext.jsx`, which sets `window.__SUPER_VIEW_ID` and triggers a data refresh.
- **LogoBar**: Redirects Super Admins to `/admin` dashboard; regular owners to `/settings`.

### RLS policy rules (verified May 4, 2026)
- All core tables have RLS enabled. Policies use two SECURITY DEFINER helper functions: `is_admin()` and `my_business_id()`.
- `businesses` and `services` modify policies now correctly allow owners: `USING (is_admin() OR <scope>) WITH CHECK (same)`.
- **Supabase migrations are NOT auto-applied** — the `supabase/migrations/` folder is documentation only. Any schema changes must be pasted and run manually in the Supabase dashboard SQL Editor. The Supabase CLI is not set up on this project.
- Silent write failures (RLS blocking with no error) are now surfaced in `ServiceCatalogSheet.jsx` — upsert and soft-delete both call `.select()` and throw if 0 rows are returned.

(Updated by Claude Code — May 4, 2026)

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
- [x] Test Isolation — Dedicated `tester@supermom.io` account
- [x] Platform Hierarchy — Joel as Global Admin; Viewpoint switcher verified
- [x] Mobile Keyboard Polish — Focus-aware sheet padding via `useKeyboardFocus` hook
- [x] Privacy Audit — Internal notes hidden from summary lists
- [x] RLS hardening — `businesses_modify` and `services_modify` policies fixed for owner role; silent failures now surfaced in ServiceCatalogSheet
- [x] Service Catalog Add race fix — "+ Add Service" button disabled while initial `refresh()` is loading, so an early click can't be wiped out by the fetch resetting state (v0.2.8)
- [x] Service Catalog Add visibility fix — new cards now prepended to the top of the list so they're immediately visible without scrolling; prior bug was UX-only (cards rendered below the fold). Settings.jsx signature input warning also fixed (v0.2.9)
- [x] Service Catalog refresh now filters `active=true` — soft-deleted services no longer reappear in the catalog. End-to-end verification (v0.3.0): owner role can Add, Save, persist, and Delete services without errors.
- [x] Scroll Performance — CSS containment on all scroll containers; React.memo on ClientCard, TransactionRow, AgendaCard; Finance transaction pagination (50/page) (v0.3.6)
- [x] Service Catalog bug fixes (v0.3.7) — null ID on batch upsert fixed (crypto.randomUUID); DEFAULT ✎ toggle now obviously interactive with hint caption; can add multiple services without error
- [x] Book Job from client profile (v0.3.7) — skips Step 1 (client pre-selected), opens directly on Step 2; `business` prop passed to Step2What fixing white screen crash for Hourly services with null default_price

---

## Critical rules — read before every build

- **Read `DESIGN.md` before writing any component** — all tokens, typography, and component anatomy are defined there
- **Mobile-first** — design for 390px wide iPhone viewport first
- **Keyboard aware** — Use `useKeyboardFocus` hook to adjust padding when keyboard is visible in bottom sheets
- **Increment version numbers** in package.json on every meaningful release

---

## Parked / not building yet

- [ ] Self-serve client booking link (Phase 2)
- [ ] Sandra's user guide (separate doc, after app stable)

