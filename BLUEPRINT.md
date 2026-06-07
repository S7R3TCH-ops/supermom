# Supermom for Hire · Greenfield Blueprint

> **Purpose**: This document is the complete specification for rebuilding Supermom for Hire from scratch, written after shipping v0.12.x in production. It captures everything we know: what worked, what didn't, and how we'd do it better with today's tooling (June 2026).
>
> A new expert developer should be able to read this document and build the full product without asking a single clarifying question.

---

## Table of Contents

1. [What We're Building](#1-what-were-building)
2. [What We Learned Building v1](#2-what-we-learned-building-v1)
3. [Greenfield Tech Stack](#3-greenfield-tech-stack)
4. [Project Architecture](#4-project-architecture)
5. [Database Schema](#5-database-schema)
6. [Feature Specifications](#6-feature-specifications)
7. [AI Integration](#7-ai-integration)
8. [API Architecture](#8-api-architecture)
9. [Design System](#9-design-system)
10. [Key Business Rules](#10-key-business-rules)
11. [Development Workflow](#11-development-workflow)
12. [Phase 2 Roadmap](#12-phase-2-roadmap)

---

## 1. What We're Building

### Product Overview

**Supermom for Hire** is a mobile-first CRM and operations web app for solo personal-life-operations business owners. Think of it as a personal mission control — a tool that makes a one-person business feel like it has a team of ten behind it.

The first user is **Sandra**, a Georgetown, ON based solo operator offering:
- Home organizing & decluttering
- Caregiving & senior assistance
- Life coaching
- Errands & personal assistant work

Sandra books all jobs herself after client calls or texts. There is no self-serve client portal (Phase 2). Payment is cash or e-Transfer only. No Stripe.

### Platform Hierarchy

This is a **managed service product** — Sandra is the first user, but the architecture must support multiple solo operators from day one.

| Role | Description |
|---|---|
| **Super Admin** (`admin`) | Joel. Not linked to any business. Can switch "Viewpoints" to see any business's data. Manages provisioning. |
| **Business Owner** (`owner`) | Sandra, and future operators. Scoped entirely to their own `business_id`. |
| **Worker** (Phase 2) | Staff linked to a business. No Supabase Auth account yet — tracked in DB only. |

### The App in One Sentence Per Screen

| Screen | What it does |
|---|---|
| **Home** | "What's happening right now?" — Next Up job with drive time, today's schedule, owing balances |
| **Clients** | CRM — searchable client list, profiles with job history |
| **Calendar** | Week + Agenda view of all jobs. Tap to book or view. |
| **Finance** | Revenue, payments, HST summary, expenses |
| **Settings** | Business profile, Google Calendar OAuth, appearance, notifications |
| **Admin** | Super Admin only — switch Viewpoint, provision businesses |
| **Invoice** (`/i/:id`) | Public-facing invoice — no auth required |

---

## 2. What We Learned Building v1

These are hard-won lessons from shipping v0.12.x. The greenfield build should fix all of these.

### ❌ Things to Never Do Again

**1. No TypeScript**
The single biggest pain point. Field name bugs (e.g., `flat_rate` silently storing an hourly rate because nobody caught it at the call site), component props with wrong shapes, and data transformation functions with unclear return types were all only caught at runtime — usually in production. TypeScript would have caught every one of them.

**2. Raw Supabase client calls scattered across 8+ repo files**
`clientsRepo.js`, `jobsRepo.js`, `workersRepo.js`, `invoicesRepo.js`, `expensesRepo.js`... each one a different style, no shared error handling, no type safety. We ended up with duplicate multi-tenancy guard logic copy-pasted everywhere. The rebuild needs a proper typed data access layer.

**3. React Context for all server state**
`useData.js` + a custom pub/sub event system (`notifyDataChanged`) was our "state management." It worked but was brittle — we had to debounce the event dispatcher, we had cache invalidation bugs on rapid mutations, and stale closure issues. TanStack Query solves all of this for free.

**4. Nodemailer**
Great for prototyping, painful in production. No email analytics, delivery confirmations, or template versioning. SMTP credentials are fragile (App Passwords get revoked). Resend + React Email is the right call.

**5. Vite SPA for everything**
The invoice page (`/i/:id`) needs to be publicly accessible and shareable — perfect SSR candidate. Drive time calculations, briefing emails, calendar sync — all would benefit from edge functions that aren't cold-starting on a Hobby plan. A unified Next.js app would have handled all of this better from day one.

**6. Semantic field name confusion in the DB**
- `flat_rate` stores the **hourly dollar rate** for hourly jobs (not a flat fee). This caused constant confusion.
- `total_amount` has different meanings at different job lifecycle stages (estimate → finalized).
- `additional_cost` (scalar) AND `additional_costs_json` (array) exist as a backward-compat hack.

A greenfield schema should have clean, unambiguous column names.

**7. No migration tooling**
Schema changes were applied manually in the Supabase SQL editor and then copy-pasted into `supabase_schema.sql`. We had drift multiple times. Drizzle's migration system solves this.

**8. Vercel Hobby plan cron limitations**
Cron fires are best-effort (up to 60min late). The cron schedule drifted because rapid redeploys re-register the cron and reset the clock. Consider Vercel Pro or Trigger.dev for reliable scheduling.

**9. No error tracking**
Errors in production were invisible unless Sandra texted about them. Sentry from day one.

**10. Multi-session git discipline was manual**
Three development surfaces (Claude Code CLI, Claude.ai online, local VSCode) pushed to the same branch without coordination. Solved by process, but a proper CI check on the main branch would have caught force-push issues.

### ✅ Things That Worked Great (Keep These)

- **Supabase** — Auth, Postgres, RLS, Storage, Realtime are all excellent. Keep it.
- **Vercel** — Deployment DX is unmatched. Keep it (upgrade to Pro).
- **Tailwind CSS** — Perfect for rapid mobile-first development. Keep it (upgrade to v4).
- **Bottom sheet pattern** — Users love it. Keep the sheet-based navigation model.
- **Google Calendar sync** — GCal OAuth + `api/sync/gcal.js` works well once the auth redirect URL was correct. Keep the pattern.
- **Drive time + Leave By** — The Distance Matrix API + GPS combo is genuinely valuable to Sandra. Keep and enhance.
- **Daily briefing email** — High-value, low-complexity. The Vercel Cron + nodemailer pattern works; just replace nodemailer with Resend.
- **Multi-tenancy via `business_id` RLS** — The Supabase RLS approach with `is_admin()` + `my_business_id()` security-definer functions is solid. Keep the pattern.
- **`toDisplayJob()` / `selectors.js`** — Centralizing data transformation in a selector layer was the right call. Keep and type it properly.
- **Privacy mode** — Sandra loves this. Keep it.

---

## 3. Greenfield Tech Stack

### Core Choices

| Layer | v1 (Current) | v2 (Greenfield) | Why Changed |
|---|---|---|---|
| **Framework** | React + Vite SPA | **Next.js 15 (App Router)** | SSR for invoices, colocated API routes, edge functions, better DX |
| **Language** | JavaScript | **TypeScript (strict)** | Catch field-name bugs, prop mismatches, and DB shape errors at compile time |
| **Styling** | Tailwind v3 + CSS vars | **Tailwind v4** | Vite-native, zero config file, CSS-first, smaller output |
| **Components** | Hand-rolled | **shadcn/ui + Radix UI** | Accessible primitives, copy-owned, no vendor lock-in |
| **Server state** | React Context + pub/sub | **TanStack Query v5** | Proper caching, invalidation, optimistic updates, devtools |
| **UI state** | React Context | **Zustand** | Lightweight, no boilerplate, great for modals/sheets/theme |
| **Forms** | Uncontrolled inputs | **React Hook Form + Zod** | Performance, validation, shared server/client schemas |
| **DB queries** | Raw Supabase client | **Drizzle ORM + Supabase** | Type-safe queries, proper migrations, schema-as-code |
| **Auth** | Supabase Auth | **Supabase Auth** | Still the best fit — keep it |
| **Email** | Nodemailer/Gmail SMTP | **Resend + React Email** | Deliverability, analytics, component templates, no App Passwords |
| **AI** | Direct Anthropic SDK | **Vercel AI SDK + Claude** | Streaming, tool use, `useChat`/`useCompletion`, Next.js native |
| **Linting** | ESLint + Prettier | **Biome** | Single tool, 10x faster, TypeScript-aware out of the box |
| **Package manager** | npm | **pnpm** | Faster installs, disk efficient, deterministic |
| **Testing** | Playwright only | **Vitest + Playwright** | Unit tests for financial math + E2E for flows |
| **Error tracking** | None | **Sentry** | Production errors are not invisible |
| **Analytics** | None | **Vercel Analytics** | Free, privacy-preserving, zero config |

### Full Dependency List

```jsonc
// package.json (abbreviated)
{
  "dependencies": {
    // Framework
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x",

    // Auth + DB
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",          // Next.js server-side Supabase client
    "drizzle-orm": "^0.x",
    "postgres": "^3.x",               // Drizzle's postgres driver

    // State
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",

    // Forms + Validation
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "@hookform/resolvers": "^3.x",

    // UI Components
    "class-variance-authority": "^0.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "lucide-react": "latest",          // Icons
    // shadcn/ui components are copy-owned — no package

    // Animations
    "framer-motion": "^11.x",

    // Email
    "resend": "^3.x",
    "@react-email/components": "latest",
    "@react-email/render": "latest",

    // AI
    "ai": "^4.x",                     // Vercel AI SDK
    "@anthropic-ai/sdk": "^0.x",

    // Google APIs
    "googleapis": "^140.x",

    // Utilities
    "date-fns": "^3.x",               // Replace any manual date math
    "date-fns-tz": "^3.x",            // America/Toronto timezone handling
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "@types/react": "^19.x",
    "drizzle-kit": "^0.x",            // Migration CLI
    "@biomejs/biome": "latest",
    "vitest": "^1.x",
    "@testing-library/react": "^16.x",
    "@playwright/test": "^1.x",
    "@sentry/nextjs": "^8.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x",
  }
}
```

### Environment Variables

```bash
# .env.local (NEVER commit this file)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lskzzsjmmtsosfneuovt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...         # Safe to expose to client
SUPABASE_SERVICE_ROLE_KEY=...             # Server-only. NEVER expose to client.

# AI
ANTHROPIC_API_KEY=...

# Email (Resend)
RESEND_API_KEY=...
EMAIL_FROM=noreply@supermomforhire.com

# Google APIs
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_MAPS_API_KEY=...                   # Server-side only — don't NEXT_PUBLIC_ this

# App
NEXT_PUBLIC_APP_URL=https://app.supermomforhire.com
CRON_SECRET=...                           # Shared with Vercel Cron headers

# Sentry
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
```

---

## 4. Project Architecture

### Folder Structure

```
supermom/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group — no app shell
│   │   ├── login/page.tsx
│   │   └── onboarding/page.tsx
│   │
│   ├── (app)/                    # Authenticated group — has app shell (LogoBar + BottomNav)
│   │   ├── layout.tsx            # App shell + QueryProvider + auth guard
│   │   ├── page.tsx              # Home screen
│   │   ├── clients/
│   │   │   ├── page.tsx          # Client list
│   │   │   └── [id]/page.tsx     # Client profile
│   │   ├── calendar/page.tsx
│   │   ├── finance/page.tsx
│   │   ├── settings/page.tsx
│   │   └── admin/page.tsx        # Super Admin only — guarded by role check
│   │
│   ├── (public)/                 # No auth, no app shell
│   │   └── i/[id]/page.tsx       # Public invoice — SSR for social previews
│   │
│   └── api/                      # Route Handlers (replaces /api/*.js)
│       ├── auth/google/
│       │   ├── route.ts           # Initiates OAuth
│       │   └── callback/route.ts  # Handles callback + token storage
│       ├── sync/gcal/route.ts     # Sync a job to Google Calendar
│       ├── briefing/daily/route.ts # Cron + manual trigger
│       ├── distance/route.ts      # Distance Matrix proxy
│       ├── geocode/route.ts       # Geocoding proxy
│       ├── ai/
│       │   ├── chat/route.ts      # Claude streaming chat
│       │   ├── voice/route.ts     # Whisper transcription → intent
│       │   └── intent/route.ts    # Parse natural language → job fields
│       └── email/invoice/route.ts # Send invoice via Resend
│
├── components/
│   ├── layout/
│   │   ├── LogoBar.tsx
│   │   ├── BottomNav.tsx
│   │   ├── ViewpointBanner.tsx
│   │   └── AppShell.tsx
│   ├── sheets/                   # Bottom sheet components
│   │   ├── SheetBase.tsx         # Generic dismissible sheet
│   │   ├── NewJobSheet.tsx
│   │   ├── JobDetailSheet.tsx
│   │   ├── NewClientSheet.tsx
│   │   ├── EditClientSheet.tsx
│   │   ├── PostJobSheet.tsx      # Job completion + payment recording
│   │   ├── ServiceCatalogSheet.tsx
│   │   ├── WorkerCatalogSheet.tsx
│   │   └── NewExpenseSheet.tsx
│   ├── cards/
│   │   ├── NextUpCard.tsx
│   │   ├── UpcomingCard.tsx
│   │   ├── OwingSection.tsx
│   │   └── JobCard.tsx
│   ├── ui/                       # shadcn/ui + custom primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── sheet.tsx             # shadcn Sheet primitive
│   │   ├── dialog.tsx
│   │   ├── PrivacyToggle.tsx
│   │   ├── FAB.tsx
│   │   └── typography/
│   │       ├── Title.tsx
│   │       ├── Subheading.tsx
│   │       ├── Caption.tsx
│   │       └── SectionLabel.tsx
│   └── ai/
│       ├── ChatInterface.tsx
│       └── VoiceButton.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client (singleton)
│   │   ├── server.ts             # Server client (cookies)
│   │   └── middleware.ts         # Session refresh middleware
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (single source of truth)
│   │   ├── index.ts              # Drizzle DB instance
│   │   └── migrations/           # Generated migration files
│   ├── repos/                    # Data access layer — all DB operations live here
│   │   ├── jobs.ts
│   │   ├── clients.ts
│   │   ├── workers.ts
│   │   ├── services.ts
│   │   ├── payments.ts
│   │   ├── invoices.ts
│   │   └── expenses.ts
│   ├── selectors/
│   │   └── jobs.ts               # toDisplayJob(), computeJobFinancials(), etc.
│   ├── maps/
│   │   └── distance.ts           # Distance Matrix helpers
│   ├── gcal/
│   │   └── sync.ts               # Google Calendar sync helpers
│   ├── email/
│   │   ├── templates/            # React Email templates
│   │   │   ├── InvoiceEmail.tsx
│   │   │   └── BriefingEmail.tsx
│   │   └── send.ts               # Resend wrapper
│   └── utils/
│       ├── format.ts             # formatCurrency, formatDate, formatDuration
│       ├── toronto-time.ts       # All timezone helpers — always America/Toronto
│       └── financial.ts          # computeJobFinancials(), computeHST()
│
├── hooks/
│   ├── useKeyboardFocus.ts
│   ├── useSwipeToDismiss.ts
│   ├── useFocusTrap.ts
│   ├── usePrivacyMode.ts
│   └── useCurrentBusiness.ts
│
├── store/
│   ├── ui.ts                     # Zustand: which sheet is open, theme, privacy mode
│   └── viewpoint.ts              # Zustand: super admin viewpoint switching
│
├── types/
│   ├── db.ts                     # Types inferred from Drizzle schema (auto-generated)
│   ├── display.ts                # Display-layer types (toDisplayJob output, etc.)
│   └── api.ts                    # Request/response types for API routes
│
├── emails/                       # React Email preview server
│   ├── invoice.tsx
│   └── briefing.tsx
│
├── scripts/
│   ├── reset-platform.ts
│   ├── provision-business.ts
│   └── inspect.ts
│
├── public/
│   ├── branding/
│   │   ├── logo-banner.png
│   │   ├── logo-final.png
│   │   ├── supermom_icon.png
│   │   └── supermom_icon_transparent.png
│   ├── manifest.json             # PWA manifest — build from day 1
│   └── sw.js                     # Service worker — build from day 1
│
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts            # Minimal in v4 — mostly CSS variables
├── biome.json
├── vitest.config.ts
├── sentry.client.config.ts
├── sentry.server.config.ts
├── middleware.ts                 # Next.js middleware — session refresh
├── CLAUDE.md                     # Living project state (keep this pattern)
└── DESIGN.md                     # Design system (keep this pattern)
```

### Data Flow Pattern

```
User Action (tap, form submit)
  ↓
React Hook Form (validation via Zod)
  ↓
TanStack Query mutation (optimistic update → server)
  ↓
Next.js API Route Handler  (or direct Drizzle call in Server Action)
  ↓
Drizzle ORM → Supabase Postgres (RLS enforced)
  ↓
TanStack Query cache invalidated → UI updates
  ↓
Side effects: GCal sync, Sentry breadcrumb, etc.
```

### Authentication Flow (Supabase + Next.js)

Use `@supabase/ssr` for server-side session management. The `middleware.ts` refreshes the session on every request so tokens never expire silently.

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Refresh session, redirect to /login if unauthenticated (except public routes)
  // Public routes: /login, /onboarding, /i/*
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 5. Database Schema

### Design Principles (Greenfield)

1. **Every query must scope to `business_id`** — enforced by RLS, but also by convention in all repo functions.
2. **Soft deletes only** — `deleted_at TIMESTAMPTZ` on clients, jobs, workers, services. Never hard-delete.
3. **TypeScript types auto-generated from Drizzle schema** — no hand-written type files for DB rows.
4. **Unambiguous column names** — no more `flat_rate` meaning hourly rate.
5. **JSONB columns have typed Zod schemas** — `ai_context`, `ai_profile`, `additional_costs` are validated, not arbitrary blobs.

### Drizzle Schema (TypeScript)

```ts
// lib/db/schema.ts
import { pgTable, uuid, text, boolean, integer, numeric, 
         timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'owner', 'worker'])
export const pricingTypeEnum = pgEnum('pricing_type', ['Hourly', 'Flat'])
export const jobStatusEnum = pgEnum('job_status', [
  'Scheduled', 'InProgress', 'Completed', 'Cancelled'
])
export const paymentStatusEnum = pgEnum('payment_status', [
  'Unpaid', 'PartiallyPaid', 'Paid'
])
export const paymentMethodEnum = pgEnum('payment_method', ['Cash', 'eTransfer'])
export const personTypeEnum = pgEnum('person_type', ['worker', 'staff'])

// ─── Businesses ───────────────────────────────────────────

export const businesses = pgTable('businesses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  ownerEmail:  text('owner_email').notNull().unique(),
  phone:       text('phone'),
  city:        text('city'),
  postalCode:  text('postal_code'),
  hstEnabled:  boolean('hst_enabled').default(false),
  hstNumber:   text('hst_number'),
  hstRate:     numeric('hst_rate', { precision: 5, scale: 4 }).default('0.13'),
  // AI persona and preferences — validated by AiProfileSchema (Zod)
  aiProfile:   jsonb('ai_profile').$type<AiProfile>(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Users ────────────────────────────────────────────────

export const users = pgTable('users', {
  id:          uuid('id').primaryKey(), // = auth.users.id
  businessId:  uuid('business_id').references(() => businesses.id),
  role:        userRoleEnum('role').notNull().default('owner'),
  firstName:   text('first_name'),
  lastName:    text('last_name'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Clients ──────────────────────────────────────────────

export const clients = pgTable('clients', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id),
  firstName:   text('first_name').notNull(),
  lastName:    text('last_name').notNull(),
  phone:       text('phone'),
  email:       text('email'),
  address:     text('address'),
  city:        text('city'),
  notes:       text('notes'),
  tags:        text('tags').array().default([]),
  // AI context — validated by ClientAiContextSchema (Zod)
  aiContext:   jsonb('ai_context').$type<ClientAiContext>(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
})

// ─── Services ─────────────────────────────────────────────

export const services = pgTable('services', {
  id:              uuid('id').primaryKey().defaultRandom(),
  businessId:      uuid('business_id').notNull().references(() => businesses.id),
  name:            text('name').notNull(),
  pricingType:     pricingTypeEnum('pricing_type').notNull().default('Hourly'),
  defaultPrice:    numeric('default_price', { precision: 10, scale: 2 }),
  defaultDuration: integer('default_duration'), // minutes
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
})

// ─── Workers ──────────────────────────────────────────────

export const workers = pgTable('workers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id),
  name:        text('name').notNull(),
  phone:       text('phone'),
  email:       text('email'),
  personType:  personTypeEnum('person_type').default('worker'),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
})

export const skillTypes = pgTable('skill_types', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id),
  name:        text('name').notNull(),
})

export const workerSkills = pgTable('worker_skills', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workerId:    uuid('worker_id').notNull().references(() => workers.id),
  skillTypeId: uuid('skill_type_id').notNull().references(() => skillTypes.id),
  payRate:     numeric('pay_rate', { precision: 10, scale: 2 }),
})

// ─── Jobs ─────────────────────────────────────────────────

// KEY NAMING FIX vs v1:
//   v1: flat_rate (confusingly stored hourly rate)  → v2: hourly_rate
//   v1: total_amount (overloaded meaning)            → v2: estimated_total + finalized_total
//   v1: additional_cost (scalar) + additional_costs_json (array) → v2: extra_costs_json only

export const jobs = pgTable('jobs', {
  id:                uuid('id').primaryKey().defaultRandom(),
  businessId:        uuid('business_id').notNull().references(() => businesses.id),
  clientId:          uuid('client_id').notNull().references(() => clients.id),
  serviceId:         uuid('service_id').references(() => services.id),
  workerId:          uuid('worker_id').references(() => workers.id),

  // Scheduling
  scheduledDate:     text('scheduled_date').notNull(), // YYYY-MM-DD (Toronto local)
  scheduledTime:     text('scheduled_time'),            // HH:MM (Toronto local)
  estimatedDuration: integer('estimated_duration'),     // minutes — ALWAYS store as minutes

  // Actual outcome (set when job completes)
  actualDuration:    integer('actual_duration'),        // minutes

  // Pricing
  pricingType:       pricingTypeEnum('pricing_type').default('Hourly'),
  // For Hourly jobs: hourly_rate = dollars/hr
  // For Flat jobs:   hourly_rate = null, flat_rate = dollar amount
  hourlyRate:        numeric('hourly_rate', { precision: 10, scale: 2 }),
  flatRate:          numeric('flat_rate', { precision: 10, scale: 2 }),

  // Additional costs — array of { amount: number, description: string }
  extraCostsJson:    jsonb('extra_costs_json').$type<ExtraCost[]>().default([]),

  // Financial summary (written on completion by recordPayment)
  subtotal:          numeric('subtotal', { precision: 10, scale: 2 }),
  hstAmount:         numeric('hst_amount', { precision: 10, scale: 2 }),
  finalTotal:        numeric('final_total', { precision: 10, scale: 2 }),

  // Worker pay
  workerPay:         numeric('worker_pay', { precision: 10, scale: 2 }),
  workerPaid:        boolean('worker_paid').default(false),

  // Status
  status:            jobStatusEnum('status').default('Scheduled'),
  paymentStatus:     paymentStatusEnum('payment_status').default('Unpaid'),

  // Notes
  notes:             text('notes'),

  // Google Calendar
  gcalEventId:       text('gcal_event_id'),
  gcalSyncedAt:      timestamp('gcal_synced_at', { withTimezone: true }),

  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
  deletedAt:         timestamp('deleted_at', { withTimezone: true }),
})

// ─── Payments ─────────────────────────────────────────────

export const payments = pgTable('payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  businessId:    uuid('business_id').notNull().references(() => businesses.id),
  jobId:         uuid('job_id').notNull().references(() => jobs.id),
  amount:        numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method:        paymentMethodEnum('method').notNull(),
  receivedAt:    timestamp('received_at', { withTimezone: true }).defaultNow(),
  notes:         text('notes'),
})

// ─── Expenses ─────────────────────────────────────────────

export const expenses = pgTable('expenses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull().references(() => businesses.id),
  description: text('description').notNull(),
  amount:      numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category:    text('category'),
  date:        text('date').notNull(), // YYYY-MM-DD
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Integrations ─────────────────────────────────────────

export const integrations = pgTable('integrations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  businessId:   uuid('business_id').notNull().references(() => businesses.id),
  provider:     text('provider').notNull(), // 'google_calendar'
  accessToken:  text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiry:  timestamp('token_expiry', { withTimezone: true }),
  calendarId:   text('calendar_id'),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ─── JSONB Types (Zod schemas) ────────────────────────────

// These are the Zod shapes that validate the jsonb columns above.
// Put these in lib/db/schemas.ts

import { z } from 'zod'

export const ExtraCostSchema = z.object({
  amount:      z.number().min(0),
  description: z.string().min(1),
})
export type ExtraCost = z.infer<typeof ExtraCostSchema>

export const AiProfileSchema = z.object({
  emailFrequency:  z.enum(['daily', 'weekly']).default('daily'),
  timezone:        z.string().default('America/Toronto'),
  onboardingDone:  z.boolean().default(false),
  preferredName:   z.string().optional(),
})
export type AiProfile = z.infer<typeof AiProfileSchema>

export const ClientAiContextSchema = z.object({
  driveToMinutes:  z.number().optional(),  // last known drive time from home
  lastServiceDate: z.string().optional(),  // YYYY-MM-DD
  notes:           z.string().optional(),  // AI-generated prep note
  tags:            z.array(z.string()).optional(),
})
export type ClientAiContext = z.infer<typeof ClientAiContextSchema>
```

### RLS Policies

Apply these in the Supabase SQL Editor after running Drizzle migrations.

```sql
-- Security-definer helpers (run once)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION my_business_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT business_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Pattern: scope all reads/writes to own business_id, admin sees all
-- (apply to each table — example for jobs)
CREATE POLICY jobs_select ON jobs FOR SELECT
  USING (is_admin() OR business_id = my_business_id());

CREATE POLICY jobs_insert ON jobs FOR INSERT
  WITH CHECK (is_admin() OR business_id = my_business_id());

CREATE POLICY jobs_update ON jobs FOR UPDATE
  USING (is_admin() OR business_id = my_business_id());
```

---

## 6. Feature Specifications

### 6.1 Home Screen

The most important screen. Sandra opens this app dozens of times a day.

**Hero: Next Up Card**
- Shows the next upcoming job (scheduled today or next if today is empty)
- Dark hero section with: client name, service, start time, estimated duration
- If available: drive time from current GPS location, leave-by time with urgency state
- Urgency tiers:
  - **Normal**: "Leave by 2:30 PM · 18 mins away"
  - **Imminent** (1–5 min late): `goUrgentPulse` rose animation, "Move it!"
  - **Late** (6–15 min): "They're watching the clock"
  - **Very Late** (16+ min): "Just call ahead"
- **SUPERMOM GO button**: custom icon, `supermomLaunch` animation, opens Google Maps with traffic-avoiding route, fresh GPS coords as origin
- Job notes shown inline under service name
- GCal sync indicator

**Coming Up Today**
- All remaining jobs for today, each with leave-by annotation if GPS available
- Tap opens `JobDetailSheet`

**Owing Section** (collapsed by default)
- Between Next Up and Coming Up
- Grouped by client, cumulative balance
- Intensity tiers by staleness (>48h completed jobs = dark red, fresh = app rose)
- Privacy mode hides amounts

**Command Brief (AI)**
- Short AI-generated daily briefing below the hero
- Drive-time-aware passive-aggressive messages when Sandra is past her leave window
- No colored dot — let the Next Up card's urgency state carry the signal

**Bottom FAB**
- `+` button → opens `NewJobSheet`

**Data needs (TanStack Query keys)**
```ts
// All jobs for today + next N days
useQuery({ queryKey: ['jobs', businessId, 'upcoming'] })
// Payments for outstanding jobs (stable key — doesn't change on clock tick)
useQuery({ queryKey: ['payments', businessId, jobIds.join(',')] })
```

---

### 6.2 New Job Sheet (Booking Flow)

Multi-step bottom sheet. 3 steps.

**Step 1: Client + Service**
- Client picker with search (fuzzy match on name)
- Service picker (from catalog)
- Quick "Add Client" inline if not found

**Step 2: Date, Time, Duration**
- Date picker (mobile-native where possible, fallback to custom)
- Time picker (scroll wheel, 15-min increments)
- Duration (hours input, numeric — select-all on focus, round to 2dp)
- Worker assignment (optional)

**Step 3: Pricing + Review**
- Auto-populated from service catalog defaults (pricing type, rate)
- For Hourly: shows hourly rate field + duration preview → estimated total
- For Flat: shows flat rate field
- Extra costs: add rows (amount + description)
- Real drive time from home shown here (Distance Matrix API on load)
- HST toggle (per job, defaults to business setting)
- "Book It" button → saves job → triggers GCal sync → navigates to Home

**Form validation (Zod)**
```ts
export const NewJobSchema = z.object({
  clientId:          z.string().uuid(),
  serviceId:         z.string().uuid().optional(),
  scheduledDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime:     z.string().optional(),
  estimatedDuration: z.number().int().positive(), // minutes
  pricingType:       z.enum(['Hourly', 'Flat']),
  hourlyRate:        z.number().min(0).optional(),
  flatRate:          z.number().min(0).optional(),
  extraCosts:        z.array(ExtraCostSchema).optional(),
  workerId:          z.string().uuid().optional(),
  notes:             z.string().optional(),
})
```

---

### 6.3 Job Detail Sheet

Opened by tapping any job card. Two modes: **View** and **Edit**.

**View mode**
- Dark hero: client name, service, date + time range
- All job fields displayed
- Payment breakdown (what's been collected vs. what's owed)
- GCal sync status
- Action buttons:
  - **START** (Scheduled → InProgress, records start time)
  - **COMPLETE** → opens PostJobSheet
  - **CANCEL** (soft delete, sets status = Cancelled)

**Edit mode** (tap Edit in view mode)
- All booking fields become editable
- Extra costs UI: add/remove rows inline
- Save → re-syncs to GCal

---

### 6.4 Post-Job Sheet (Job Completion + Payment)

Opened after tapping COMPLETE on a job.

Steps:
1. **Actual duration** — pre-filled with estimated, editable
2. **Financial review** — computed from actual duration + rate + extra costs + HST → shows final total
3. **Record payment** — method (Cash/eTransfer), amount, partial payment option
4. **Save** — writes finalized financials (`subtotal`, `hst_amount`, `final_total`) + payment row + updates `payment_status` + triggers GCal sync

**Financial computation — ALWAYS use this function:**
```ts
// lib/utils/financial.ts

export interface JobFinancials {
  laborSubtotal:  number // hours × rate (or flat rate)
  extraCostsSum:  number // sum of all extra cost rows
  subtotal:       number // labor + extras (no HST)
  hstAmount:      number // subtotal × hst_rate if hst enabled
  totalDue:       number // subtotal + hst
  collected:      number // sum of payments table rows for this job
  balance:        number // totalDue - collected (can be negative for overpayment)
}

export function computeJobFinancials(job: Job, payments: Payment[], hstRate: number): JobFinancials {
  // ...
}
```

---

### 6.5 Client List + Profile

**Client List (`/clients`)**
- Search bar (live fuzzy search on name/phone/email)
- Sorted by most recent job date
- Tap → Client Profile
- FAB → New Client Sheet

**Client Profile (`/clients/[id]`)**
- Dark hero: client name, address, phone, email, tags
- Outstanding balance badge (summed from all unpaid jobs)
- Job history list (all non-cancelled jobs, most recent first)
- Quick actions: Call, Text, Email
- Edit button → Edit Client Sheet
- Archive (soft delete via Admin danger zone)

**AI Context card**
- Shows AI-generated prep note for next visit
- Drive time from home (from `aiContext.driveToMinutes` or live fetch)
- Last service date

---

### 6.6 Calendar

**Views**
- **Week view** — 7-day strip with job dots per day
  - Tap a day → switches to Agenda for that day
  - Job rows: first name (10px) + service word on second line
  - Cancelled jobs greyed out
- **Agenda view** — day-by-day list
  - Time range prominent (11.5px bold)
  - Client name + service name
  - Address on separate line
  - No GCal badge (noise), no Unpaid badge on future jobs (noise)
- **TODAY** button always visible → snaps to today

**No Day view** — redundant with Home screen.

**No GO button** — GO button lives on Home only.

---

### 6.7 Finance

**Revenue summary cards**
- This month: collected revenue (subtotals, no HST)
- This month: HST collected
- This month: worker costs
- Net this month

**Unpaid jobs list**
- Grouped by client
- Tap → Job Detail Sheet

**Expenses list**
- Add expense (New Expense Sheet)
- Category filter

**Privacy mode** — hides all amounts behind `••••`

---

### 6.8 Invoice

**Invoice generation**
- Created on-demand for any completed job: `generateInvoiceForJob(jobId)`
- Stored in `invoices` table (if you want history) or generated on-the-fly from job data
- Public URL: `/i/:id` — no auth required, SSR rendered for social preview

**Invoice page layout**
- Supermom logo (`logo-final.png` — 492KB high-res — NOT the banner logo)
- Sandra's business details + HST number
- Client billing info
- Line items: service, extra costs, HST
- Total due
- Payment instructions: e-Transfer to `sandra@supermomforhire.com`
- Print/PDF button → `window.print()`

**Email delivery (Resend)**
- `POST /api/email/invoice` with `{ jobId, recipientEmail }`
- Renders `InvoiceEmail.tsx` React Email template
- Sends from `invoices@supermomforhire.com`

---

### 6.9 Settings

| Setting | Description |
|---|---|
| Business profile | Name, phone, city, postal code |
| HST | Toggle on/off, HST number, rate (default 13%) |
| Google Calendar | Connect / disconnect / reconnect OAuth |
| Email preferences | Daily vs Weekly briefing |
| Appearance | Dark / light mode toggle |
| Notifications | (Phase 2) Push notification preferences |
| Privacy | Toggle privacy mode (persisted to localStorage) |

---

### 6.10 Admin Screen (Super Admin Only)

- Viewpoint switcher — "Viewing: Sandra's business" dropdown
- Business list — provision new business button
- Danger zone: archive a client + all their jobs

---

### 6.11 Onboarding Wizard

5-step flow for new business owners. Shown once (`aiProfile.onboardingDone = false`).

1. **Welcome** — shows provisioned name + email confirmation
2. **Business Info** — first/last name, business name, phone, city, postal, HST (all required, inline validation)
3. **Quick Tips** — calendar, client, booking overview
4. **Email Preference** — Daily vs Weekly briefing picker
5. **You're Ready** — dark mode, privacy mode, GCal callouts → navigates to `/settings` on completion

---

## 7. AI Integration

AI is not a feature — it's infrastructure. Wire it in from day one.

### 7.1 Stack: Vercel AI SDK + Claude

```ts
// app/api/ai/chat/route.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { messages, businessId } = await req.json()

  // Load business context for the system prompt
  const business = await getBusinessContext(businessId)

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystemPrompt(business),
    messages,
    tools: {
      // Tool definitions (see 7.3)
      searchClients: { ... },
      createJob: { ... },
      getUpcomingJobs: { ... },
    },
    maxSteps: 5,
  })

  return result.toDataStreamResponse()
}
```

```tsx
// components/ai/ChatInterface.tsx
import { useChat } from 'ai/react'

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/ai/chat',
    body: { businessId },
  })
  // Render chat UI
}
```

### 7.2 System Prompt

```ts
function buildSystemPrompt(business: Business): string {
  return `
You are Sandra's personal AI assistant for her business "${business.name}".
You help her manage clients, schedule jobs, track payments, and run her operations.

Current date/time (Toronto): ${torontoNow()}
Business owner: ${business.firstName} ${business.lastName}
HST enabled: ${business.hstEnabled} (rate: ${business.hstRate})

Your personality: Warm, efficient, and encouraging. Sandra is a solo operator —
treat her like a capable professional who needs smart assistance, not hand-holding.

When booking jobs, always confirm the pricing before saving.
When amounts are mentioned, always include HST implications.
Never access or mention another business's data.
  `.trim()
}
```

### 7.3 AI Tools (Claude Tool Use)

```ts
const tools = {
  searchClients: {
    description: 'Search for clients by name, phone, or email',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => searchClients(businessId, query),
  },

  getUpcomingJobs: {
    description: 'Get upcoming jobs for the next N days',
    parameters: z.object({ days: z.number().int().min(1).max(30).default(7) }),
    execute: async ({ days }) => getUpcomingJobs(businessId, days),
  },

  createJob: {
    description: 'Create a new job booking',
    parameters: NewJobSchema,
    execute: async (jobData) => createJob(businessId, jobData),
  },

  getClientBalance: {
    description: 'Get outstanding balance for a client',
    parameters: z.object({ clientId: z.string().uuid() }),
    execute: async ({ clientId }) => getClientBalance(businessId, clientId),
  },

  getFinancialSummary: {
    description: 'Get revenue and payment summary for a time period',
    parameters: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    execute: async ({ startDate, endDate }) => getFinancialSummary(businessId, startDate, endDate),
  },
}
```

### 7.4 Voice Scheduling

```
User taps mic → MediaRecorder captures audio blob
  ↓
POST /api/ai/voice with audio blob
  → Transcribe via Whisper (OpenAI) or Claude's audio input
  ↓
POST /api/ai/intent with transcript
  → Claude extracts: clientName, date, time, service, duration, notes
  → Returns structured { jobFields, confidence, clarifications[] }
  ↓
Pre-fills NewJobSheet with extracted fields
  → User confirms and taps Book
```

```ts
// app/api/ai/intent/route.ts
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { transcript } = await req.json()

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: z.object({
      clientName:        z.string().optional(),
      date:              z.string().optional(), // YYYY-MM-DD
      time:              z.string().optional(), // HH:MM
      service:           z.string().optional(),
      estimatedDuration: z.number().optional(), // minutes
      notes:             z.string().optional(),
      clarifications:    z.array(z.string()), // questions to ask user
    }),
    prompt: `Extract job booking details from this voice transcript. 
             Date context: today is ${torontoNow()}.
             Transcript: "${transcript}"`,
  })

  return Response.json(object)
}
```

### 7.5 Daily Briefing Email (AI-Enhanced)

```ts
// In BriefingEmail.tsx, call Claude to generate the opening paragraph:
const { text: openingParagraph } = await generateText({
  model: anthropic('claude-haiku-4-5-20251001'), // Fast + cheap for email
  prompt: buildBriefingPrompt(jobs, payments, business),
})
```

The briefing includes:
- AI-generated opening paragraph (warm, personal, drive-time-aware)
- Dad joke from `icanhazdadjoke.com`
- Today's jobs: client name + time range
- Outstanding balances: client name + amount + date
- All links → `app.supermomforhire.com`

Cron: `0 11 * * *` (7am EDT) — Vercel Pro for reliable timing.

---

## 8. API Architecture

All routes live in `app/api/`. Use Route Handlers (not Pages API routes).

### Route Inventory

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/google` | GET | Session | Initiate Google OAuth |
| `/api/auth/google/callback` | GET | — | Handle callback, store tokens |
| `/api/sync/gcal` | POST | Cron/Internal | Sync job to/from Google Calendar |
| `/api/briefing/daily` | GET | Cron secret | Send daily briefing emails |
| `/api/distance` | POST | Session | Distance Matrix proxy |
| `/api/geocode` | GET | Session | Geocoding proxy |
| `/api/email/invoice` | POST | Session | Send invoice via Resend |
| `/api/ai/chat` | POST | Session | Streaming AI chat |
| `/api/ai/voice` | POST | Session | Transcribe audio |
| `/api/ai/intent` | POST | Session | Parse intent from transcript |

### Auth Pattern for API Routes

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: ... } }
  )
}

// In any API route:
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  // ...
}
```

### Cron Authentication

Vercel sends a `Authorization: Bearer <CRON_SECRET>` header on cron invocations.

```ts
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow manual trigger with ?secret= query param for testing
    const { searchParams } = new URL(req.url)
    if (searchParams.get('secret') !== process.env.CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
  }
  // ...
}
```

### Vercel Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/briefing/daily",
      "schedule": "0 11 * * *"
    }
  ]
}
```

**⚠️ Cron discipline:** Deploy from a clean committed tree. Every production deploy re-registers the cron. Do NOT rapid-redeploy — it resets the next-run clock. Verify via Vercel Dashboard → Settings → Crons after any deploy.

---

## 9. Design System

> The full visual specification lives in `DESIGN.md`. This section summarizes the key rules that every developer must internalize before touching any UI code.

### The Brand in One Sentence

**Zen but powerful. Superhuman-adjacent.** A glowing dark interface that feels like mission control for a solo superhero — with a bright pink heart.

### Color Tokens

```css
:root {
  /* Brand */
  --pink:          #FF70A6;  /* primary CTAs, active nav */
  --pink-light:    #FF94BC;  /* gradient start */
  --pink-mid:      #B01550;  /* hover, destructive */
  --pink-pale:     #FFF9F5;  /* app background */
  --pink-tint:     #FFF0F7;  /* selected state */
  --pink-border:   #FFD6E8;  /* ALL card + input borders */
  --pink-label:    #FF78B0;  /* labels on dark */
  --deep-rose:     #B5004E;  /* Next Up spotlight */

  /* Dark sections */
  --plum-dark:     #1C1C1E;
  --plum-mid:      #2C2C2E;

  /* Text */
  --ink:           #1C1C1E;
  --ink-mid:       #4A4A4A;
  --ink-muted:     #8A8A8E;

  /* Status */
  --green:         #16A34A;
  --amber:         #F59E0B;

  /* Gradients — use ONLY these three */
  --grad-pink:     linear-gradient(110deg, #FF70A6 0%, #E91E6A 45%, #B01550 100%);
  --grad-hero:     linear-gradient(145deg, #1C1C1E 0%, #2C2C2E 100%);
  --grad-action:   linear-gradient(135deg, #FF94BC, #FF70A6);
}
```

### Typography

- **Fraunces** (serif) — names, amounts, hero text, any money value
- **Inter** — all UI text, labels, buttons

All dollar amounts: `font-variant-numeric: tabular-nums`

### Layout Rules

- Mobile-first, designed for 390px iPhone viewport
- Screen horizontal padding: `14px`
- Minimum tap target: `44×44px`
- Bottom sheets: `border-radius: 24px 24px 0 0` at top
- ALL card borders: `1.5px solid #FFD6E8` (use `--border-card` variable)
- Dark hero sections: ALWAYS have `border-bottom: 3px solid #E91E6A` (`--border-hero`)
- FAB position: `bottom: 56px; right: 14px`

### Component Patterns

**Bottom Sheet** — The primary navigation metaphor. Use for: New Job, Job Detail, New Client, Edit Client, Post Job, Service Catalog, Worker Catalog. Every sheet has:
- `GrabBar` at top (visual affordance)
- Dismissible via swipe-down (`useSwipeToDismiss`)
- Keyboard-aware (`useKeyboardFocus`) — adjusts padding when software keyboard opens
- `useFocusTrap` for accessibility

**FAB (Floating Action Button)** — Primary action on list screens. Always bottom-right, `--shadow-fab` shadow, `--grad-pink` background.

**Dark Hero Section** — Client profiles, finance screen, job review. Always: `--grad-hero` background + `--border-hero` bottom border + radial glow `::before` pseudo-element.

### Input Behavior (Critical UX Rule)

Every `<input type="number">` or `<input type="text">` used for amounts/durations MUST have:
```tsx
onFocus={(e) => e.target.select()}
```

This lets Sandra tap a pre-filled field and immediately type the new value without clearing it first.

---

## 10. Key Business Rules

These are invariants. Never violate them.

### Timezone

```ts
// ALWAYS America/Toronto. Never system timezone. Never UTC directly to UI.
import { toZonedTime, format } from 'date-fns-tz'

const TORONTO_TZ = 'America/Toronto'

export function torontoNow(): Date {
  return toZonedTime(new Date(), TORONTO_TZ)
}

export function formatTorontoDate(date: Date): string {
  return format(toZonedTime(date, TORONTO_TZ), 'yyyy-MM-dd', { timeZone: TORONTO_TZ })
}
```

### Financial Math

```ts
// ALWAYS use these functions. NEVER raw-read total_amount from the DB.

export function computeLaborSubtotal(job: Job): number {
  if (job.pricingType === 'Flat') {
    return Number(job.flatRate ?? 0)
  }
  const hours = (job.actualDuration ?? job.estimatedDuration ?? 0) / 60
  return hours * Number(job.hourlyRate ?? 0)
}

export function computeExtraCostsSum(job: Job): number {
  return (job.extraCostsJson ?? []).reduce((sum, c) => sum + c.amount, 0)
}

export function computeSubtotal(job: Job): number {
  return computeLaborSubtotal(job) + computeExtraCostsSum(job)
}

export function computeHST(subtotal: number, hstRate: number): number {
  return Math.round(subtotal * hstRate * 100) / 100
}

export function computeJobFinancials(
  job: Job,
  payments: Payment[],
  hstRate: number
): JobFinancials {
  const subtotal   = computeSubtotal(job)
  const hstAmount  = computeHST(subtotal, hstRate)
  const totalDue   = subtotal + hstAmount
  const collected  = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  return {
    laborSubtotal: computeLaborSubtotal(job),
    extraCostsSum: computeExtraCostsSum(job),
    subtotal,
    hstAmount,
    totalDue,
    collected,
    balance: totalDue - collected,
  }
}
```

**Revenue display vs. collection math:**
- **Card/revenue display** (what Sandra earns): use `subtotal` (no HST)
- **Collection math** (what client owes): use `totalDue` (with HST)

### Multi-Tenancy

```ts
// Every repo function signature looks like this:
async function getJobs(businessId: string, filters?: JobFilters): Promise<Job[]>

// RLS enforces this at the DB layer too. Belt AND suspenders.
// Never write a repo function that doesn't accept businessId.
```

### Payment Recording

```ts
// Never trust caller-supplied paymentStatus.
// Always re-derive from DB payments sum after recording.
async function recordPayment(jobId: string, payment: NewPayment): Promise<void> {
  await db.insert(payments).values({ ...payment, jobId })

  // Re-derive status from all payments for this job
  const allPayments = await db.select().from(payments).where(eq(payments.jobId, jobId))
  const collected   = allPayments.reduce((s, p) => s + Number(p.amount), 0)
  const job         = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  const financials  = computeJobFinancials(job[0], allPayments, hstRate)

  const newStatus = collected <= 0          ? 'Unpaid'
                  : collected < financials.totalDue ? 'PartiallyPaid'
                  : 'Paid'

  await db.update(jobs)
    .set({ paymentStatus: newStatus, subtotal: ..., hstAmount: ..., finalTotal: ... })
    .where(eq(jobs.id, jobId))
}
```

### Sandra's Business Reference

| Field | Value |
|---|---|
| Email | `sandra@supermomforhire.com` |
| Phone | `(416) 738-0309` |
| Location | Georgetown, ON (home-based, no street address on invoices) |
| HST # | `777616178 RT0001` |
| App URL | `https://app.supermomforhire.com` |
| GCal account | `sandra@supermomforhire.com` |

Invoice `FROM` field + e-Transfer target: `sandra@supermomforhire.com`

Logo for invoices: `logo-final.png` (492KB, high-res). Logo for app bar: `logo-banner.png` (41KB). **Never mix these.**

---

## 11. Development Workflow

### Initial Setup

```bash
# Prerequisites: Node 20+, pnpm

git clone <repo>
cd supermom
pnpm install
cp .env.example .env.local  # fill in all values

# Generate DB types from Drizzle schema
pnpm drizzle-kit generate

# Apply migrations to Supabase
pnpm drizzle-kit migrate

# Start dev server
pnpm dev
```

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server with turbopack |
| `pnpm build` | Production build |
| `pnpm check` | Biome lint + format check |
| `pnpm check --write` | Biome auto-fix |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations to Supabase |
| `pnpm db:studio` | Open Drizzle Studio (visual DB browser) |
| `pnpm email:preview` | React Email dev server (`localhost:3001`) |
| `pnpm scripts/reset-platform` | Wipe all client data, keep Super Admin |
| `pnpm scripts/provision-business` | Create a new business + owner account |

### Test Strategy

**Unit tests (Vitest)** — Financial math is mission-critical. Test it all.
```ts
// lib/utils/financial.test.ts
describe('computeJobFinancials', () => {
  it('calculates hourly job correctly', () => { ... })
  it('calculates flat job correctly', () => { ... })
  it('includes extra costs in subtotal', () => { ... })
  it('applies HST correctly', () => { ... })
  it('derives payment status correctly', () => { ... })
})
```

**E2E tests (Playwright)** — Cover the core user flow:
1. Login
2. Book a job
3. View job on Home screen
4. Complete job + record payment
5. Verify invoice generates correctly

### Git Discipline (Multi-Surface Development)

This project is developed across multiple surfaces (Claude AI sessions, local VS Code, etc.). To avoid push conflicts:

1. **Always pull before starting any session.** `git pull --rebase`
2. **Always push before ending any session.** `git push`
3. **Main branch is the single truth.** Never force-push without coordinating.
4. **CLAUDE.md is the project state.** Update it every session with what changed.

### Deployment

```bash
# Deploy to Vercel (from clean committed working tree ONLY)
vercel --prod

# After deploying, verify cron schedule:
# Vercel Dashboard → Project → Settings → Crons
# Should show: /api/briefing/daily at 0 11 * * *
```

**Vercel environment:** Pro plan recommended for:
- Reliable cron timing (not best-effort)
- More serverless function invocations
- Better cold-start performance

**Function count watchlist:** Monitor total serverless function count after adding any new API route. Consolidate if approaching plan limits.

---

## 12. Phase 2 Roadmap

These are confirmed desirable features, in rough priority order.

### P1: PWA (Prerequisite for Push Notifications)

```json
// public/manifest.json
{
  "name": "Supermom for Hire",
  "short_name": "Supermom",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF9F5",
  "theme_color": "#FF70A6",
  "icons": [
    { "src": "/branding/supermom_icon.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/branding/supermom_icon.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Service worker: cache app shell for offline. Show friendly "no connection" state when Supabase is unreachable (currently crashes on first load).

### P2: Push Notifications

"Leave in 15 mins for Karen" fired at Sandra's leave-time.

- Use Web Push API
- Store `push_subscriptions` table (endpoint, keys, businessId)
- Server-side push trigger from a scheduled job (Trigger.dev or Vercel Cron)
- Notification payload: client name, service, leave-by time, deep link to job

### P3: AI Chat Interface

- Full chat UI in the app (`/ai` route or floating modal)
- `useChat` from Vercel AI SDK
- Tools: search clients, get upcoming jobs, create job, check balances
- Persistent conversation history per business (optional — could be session-only)

### P4: Voice Scheduling

- Tap mic icon in FAB or chat
- `MediaRecorder` → WAV/M4A blob
- Whisper transcription → Claude intent extraction → pre-fills New Job Sheet
- Fallback: if confidence is low, Claude asks clarifying questions before pre-filling

### P5: Staff App Access

Workers (currently `person_type = 'worker'` in DB) get their own app login:
- Link `workers.id` → `users` table entry
- Create Supabase Auth account for worker
- Worker role sees only: their assigned jobs, basic client info (name + address), check-in/check-out
- Business owner sees worker's time logs
- Figure out label for "worker" / "staff" distinction (TBD with Joel)

### P6: Self-Serve Client Booking

- Public booking link for clients
- Clients see Sandra's available slots
- Book a job → Sandra gets notification to confirm
- No payment collection at booking (cash/eTransfer on day of)
- cal.com or custom implementation

### P7: Resend Migration

Swap `nodemailer` for `resend`. ~5-minute job:
- `npm install resend @react-email/components`
- Replace `nodemailer.createTransport(...)` with `new Resend(process.env.RESEND_API_KEY)`
- `from` becomes `invoices@supermomforhire.com` (verified on Resend)
- Templates become React Email components (type-safe, version-controlled, previewable)

---

## Appendix: Supabase Project Reference

| Field | Value |
|---|---|
| Project ID | `lskzzsjmmtsosfneuovt` |
| Region | `ca-central-1` |
| Storage bucket | `job-assets` (private) |
| Auth providers | Email/password |

> **Migrations are NOT auto-applied.** After running `drizzle-kit migrate`, paste the generated SQL into the Supabase SQL Editor for the production project.

---

*Last updated: June 5, 2026 · v1 greenfield spec*
