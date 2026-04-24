# Gemini CLI · Project Instructions

> These instructions are foundational mandates for Gemini CLI. They are read at the start of every session and take precedence over default behaviors.

---

## Session Lifecycle Mandates

### 1. Auto-Documentation
At the end of every productive session, or upon major milestone completion, Gemini MUST:
- **Update `handoff.md`**: Add a new entry detailing changes, technical decisions, and status.
- **Sign Updates**: Every documentation change (in `handoff.md`, `CLAUDE.md`, or `DESIGN.md`) must be clearly marked with `(Updated by Gemini CLI)`.
- **Claude Sync**: Ensure `CLAUDE.md` is updated if the tech stack, build commands, or project URLs change.

### 2. Version Management
- **Increment Versions**: Automatically increment the patch version in `package.json` (e.g., 0.0.1 -> 0.0.2) after a successful production deployment.
- **Confirmation**: Gemini will state: "I am incrementing the version to [X] as per GEMINI.md" before doing so.

### 3. Deployment Awareness
- **Primary Hosting**: Vercel ([supermom-v2.vercel.app](https://supermom-v2.vercel.app)).
- **Auto-deploy**: Vercel is connected to GitHub (`S7R3TCH-ops/supermom-v2`). Every `git push origin main` deploys to production automatically. Do NOT run `vercel --prod` manually.
- **To deploy**: commit your changes and `git push origin main`.

---

## Technical Context
- **Timezone**: `America/Toronto` (Always).
- **Target Viewport**: 390px (iPhone) / `100svh`.
- **App status**: **Live on Supabase** — all 5 pages (Home, Calendar, Clients, Client Profile, Finance) read real data. Login is active. Mock data is gone.
- **Supabase project**: `lskzzsjmmtsosfneuovt`
- **Schema source of truth**: `supabase_schema.sql` at repo root.

---

## Current State (as of April 24, 2026)

| Feature | Status |
|---|---|
| Login / Forgot password | ✅ Live |
| Home — today's schedule + revenue | ✅ Live |
| Calendar — Day/Week/Agenda | ✅ Live |
| Clients list + profile | ✅ Live |
| Finance — mark-paid | ✅ Live |
| New Job sheet | ✅ Live |
| Drive time / mileage | ❌ Hardcoded "—" — needs Google Maps |
| payments table audit row | ❌ mark-paid doesn't insert into `payments` yet |
| Google Calendar sync | ❌ Not started |
| Geofence / auto-timer | ❌ Not started |

## Next priorities
1. `payments` audit row on mark-paid (`src/pages/Finance.jsx`)
2. Google Maps integration (drive time + mileage)
3. Code-split the bundle (520 kB — lazy-load Supabase client)
