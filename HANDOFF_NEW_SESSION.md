# HANDOFF DOC — New Session Start
> Read this fully before responding. Do not skip ahead. Do not assume.

---

## WHO WE ARE

- **Joel** — solo developer/consultant, building SMHQ (Supermom for Hire HQ)
- **Sandra** — end client, solo personal-life-operations business owner in Georgetown ON. iPhone user. Services: organizing, decluttering, life coaching, caregiving, errands.
- **Working style**: Direct, concise, personal, fun. No fluff. Push back when warranted. Ask clarifying questions before acting. Surface better options before doing it the asked way.
- **ADHD accommodation**: Joel gets sidetracked. Maintain a visible Parked List. Surface dropped items proactively.

---

## LAPTOP STATE

- **Fresh Windows install** — `C:\Projects\supermom\` (cloned May 31, 2026)
- Node.js LTS + Git installed via winget
- App runs at `http://localhost:5173` via `npm run dev`
- `.env` at repo root (gitignored) — contains `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. Still needs locally: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (all now set in Vercel Production).

---

## SUPERMOM PROJECT — CURRENT STATE

### Local dev
- Folder: `C:\Projects\supermom\`
- Run: `npm run dev` → `http://localhost:5173`
- Deploy: `git push origin main` → auto-deploys to Vercel. **Never run `vercel --prod` manually.**
- Supabase project ID: `lskzzsjmmtsosfneuovt`

### GitHub
| Repo | Purpose |
|---|---|
| S7R3TCH-ops/supermom | Main app |
| S7R3TCH-ops/supermom-crm | Legacy vanilla JS — NOT cloned, low priority |

### Current version: 0.12.2 (Jun 2, 2026) — LIVE on Vercel

---

## WHAT WE JUST FINISHED (Jun 2, 2026)

### Google Workspace + Gmail SMTP — DONE ✅
- Google Workspace live: `supermomforhire.com`, admin is `admin@supermomforhire.com`
- `sandra@supermomforhire.com` — alias on admin account
- `invoice@supermomforhire.com` — alias created, "Send mail as" configured + tested
- App Password generated, 2-Step Verification enabled
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` added to Vercel (Production only)
- `api/email-invoice.js` — from/replyTo hardcoded to `invoice@supermomforhire.com`
- Test passed: sent to `jlundie@gmail.com`, reply came back to admin inbox correctly labelled

### Also this commit
- Old domain cleanup: removed `joel@supermom.com` from `provision.js` + `OnboardingWalkthrough.jsx`
- `InvoiceView.jsx` — PDF print improvements (bottom padding, page-break-inside: avoid on footer, title restore timing fix)
- Package-lock synced to v0.12.2

---

## MUST DO NEXT — in order

### Step 1 — Google Calendar OAuth
- [ ] Go to `console.cloud.google.com` → enable **Calendar API**
- [ ] Create OAuth 2.0 credentials (Web Application type)
  - Authorized redirect URI: `https://supermom-s7-r3-tch.vercel.app/api/auth/google/callback`
- [ ] Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to Vercel + local `.env`
- [ ] Calendar can sync to any Google account Sandra authenticates with (does NOT have to be domain email)
- [ ] Test OAuth flow with Joel's account first
- [ ] Code is already written: `api/auth/google/login.js`, `api/auth/google/callback.js`, `api/sync/gcal.js` — zero code changes needed (probably)

### Step 2 — Google Maps / geocoding ← do this in the same Google Cloud Console trip as Step 1
- [ ] Enable **Geocoding API** + **Distance Matrix API**
- [ ] Create API key, restrict to: `supermom-s7-r3-tch.vercel.app/*` + `localhost:5173/*`
- [ ] Add `GOOGLE_MAPS_API_KEY` to Vercel + local `.env` (server-side only — **no VITE_ prefix**)
- [ ] Code already written: `api/distance.js`, `api/geocode.js`, `src/lib/maps.js` — zero code changes needed
- [ ] Billing stays under Joel's Google Cloud account (no relation to Sandra's domain)

### Step 3 — Daily job briefing email
- [ ] Switch from nodemailer to **Resend** (free tier, 3k emails/month)
- [ ] Set up **Vercel Cron** job (daily 7am America/Toronto)
- [ ] Sends to `sandra@supermomforhire.com`: today's + tomorrow's jobs, times, clients, outstanding payments
- [ ] Test to `jlundie@gmail.com` first

### Step 4 — ANTHROPIC_API_KEY
- [ ] Add to Vercel (Production) + local `.env`
- [ ] AI features fall back to mock responses without it

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] **ANTHROPIC_API_KEY** — see Step 4 above
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked. Link to `users` + Auth when ready.
- [ ] **Supabase schema grants — deadline Oct 30, 2026** — Run in SQL Editor:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ```

### Features — Phase 2
- [ ] **Custom domain → swap email provider** — when Sandra's domain is confirmed stable, swap `nodemailer` for `resend`. 5-min job.
- [ ] **Staff Supabase Auth login + scheduling access**
- [ ] **Self-serve client booking link**
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load
- [ ] **Client engagement tools** (AI follow-up / re-booking reminders)

---

## KEY ARCHITECTURE REMINDERS

### Financial math
- `flat_rate` = $/hr for Hourly jobs (not a flat fee — legacy field name, intentional)
- `total_amount` is written with the **finalized actual total** when a job completes. For Scheduled jobs it still holds the booking estimate. Always use `computeJobFinancials()` for UI math — never read `total_amount` raw in components.
- `subtotal` (DB) = base labor only. `hst_amount` = finalized HST. Both written on completion.
- `payments` table = source of truth for amounts collected; `job.payment_status` is a cache
- Always use `computeJobFinancials()` from `src/lib/financialMath.js` — never inline math

### API layer
- Vercel Hobby plan: **9 of 12** functions used. 3 slots available.
- AI routes all go through `api/ai/[action].js` — do NOT add new files in `api/ai/`
- No `api/` files that start without `_` count as functions — helpers go in `api/_lib/`

### Multi-tenancy
- Every Supabase query must include `.eq('business_id', businessId)` — never skip this
- RLS is enabled but enforce in code too — don't rely on RLS as the only guard

### Soft deletes
- Never hard-delete jobs, clients, or workers from normal flows — always set `deleted_at = now()`
- `hardDeleteJob` / `hardDeleteClient` exist for admin use only

### Workers / Skills
- `useWorkers()` returns workers with a `skills: [{ skill_type_id, skill_name, pay_rate }]` array
- `assignee_type` on display jobs comes from `toDisplayJob` → `w.person_type`
- `fetchJobById` uses PostgREST join for worker: `workers(name, person_type)` inline in select (no separate query)

### Timezone
- Everything is `America/Toronto` — never system timezone. Use helpers in `src/lib/dateUtils.js`

### Sandra's canonical contact details
- Email: `sandra@supermomforhire.com` (Google Workspace — live)
- Invoice email: `invoice@supermomforhire.com` (alias — live and tested)
- Phone: `(416) 738-0309`
- HST #: `777616178 RT0001`

---

## PREFERENCES & RULES FOR THIS AI

- Don't make assumptions — ask clarifying questions
- Surface better options BEFORE doing it the asked way
- Keep a visible Parked List and surface it when topics get dropped
- Be direct, concise, personal, fun — "gettin shit dun" is the motto
- Don't end with "does that make sense?" or "anything else I can help with?"
- Never commit `IS_TEST=true` to GitHub
- **Read `DESIGN.md` before ANY UI work** — design tokens, typography, component anatomy all defined there
- Increment version in `package.json` on every meaningful release
- Test on Joel's Pixel 10 Pro (Android) AND Sandra's iPhone
