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
| Hosting | Vercel |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context or Zustand (decide before first data fetch) |

---

## Repo structure (target)

```
supermom-app/
├── CLAUDE.md
├── DESIGN.md
├── public/
│   ├── supermom_logo_wide.png     ← wide horizontal logo for banner
│   └── supermom_go.png            ← flying hero logo for GO button
├── src/
│   ├── components/
│   │   ├── ui/                    ← design system primitives
│   │   ├── layout/                ← LogoBanner, BottomNav, FAB
│   │   └── screens/               ← Home, Calendar, Clients, Finance
│   ├── hooks/
│   │   ├── useGeofence.js         ← auto-timer logic
│   │   └── useMileage.js          ← auto mileage tracking
│   ├── lib/
│   │   ├── supabase.js            ← supabase client
│   │   └── gcal.js                ← google calendar helpers
│   ├── pages/
│   └── App.jsx
```

---

## Supabase Schema

> Derived from Sandra's real business operations — not from legacy architecture.

### `clients`
```sql
id              uuid primary key
name            text not null
phone           text                    -- stored as 10-digit, displayed formatted
email           text
address         text
notes           text                    -- general notes
ai_context      jsonb                   -- { prefs, access, comms, personal_notes }
recurrence      text                    -- 'weekly' | 'biweekly' | 'monthly' | null
is_vip          boolean default false
is_active       boolean default true
created_at      timestamptz
```

### `jobs`
```sql
id              uuid primary key
client_id       uuid references clients(id)
service_type    text                    -- 'deep_clean' | 'regular' | 'move_out' | 'organizing' | 'custom'
scheduled_at    timestamptz
duration_est    integer                 -- minutes, AI-estimated from history
duration_actual integer                 -- minutes, recorded from geofence timer
rate            numeric(10,2)           -- snapshot at time of booking
total           numeric(10,2)
status          text                    -- 'scheduled' | 'active' | 'completed' | 'cancelled'
payment_status  text                    -- 'unpaid' | 'partial' | 'paid'
payment_method  text                    -- 'cash' | 'etransfer'
notes           text
voice_note_url  text
photos          text[]                  -- array of storage URLs
gcal_event_id   text                    -- google calendar event id for sync
mileage_km      numeric(6,2)
recurrence_rule text                    -- 'weekly' | 'biweekly' | 'monthly' | null
recurrence_parent_id uuid               -- null if root, points to parent if recurring copy
is_deleted      boolean default false   -- soft delete only
created_at      timestamptz
```

### `payments`
```sql
id              uuid primary key
job_id          uuid references jobs(id)
client_id       uuid references clients(id)
amount          numeric(10,2)
method          text                    -- 'cash' | 'etransfer'
paid_at         timestamptz
notes           text
created_at      timestamptz
```

### `expenses`
```sql
id              uuid primary key
description     text
amount          numeric(10,2)
category        text                    -- 'gas' | 'supplies' | 'other'
receipt_url     text
expense_date    date
created_at      timestamptz
```

### `config`
```sql
id              uuid primary key
key             text unique
value           jsonb
-- Stores: service rates, hourly rate, HST toggle, working hours, etc.
```

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
