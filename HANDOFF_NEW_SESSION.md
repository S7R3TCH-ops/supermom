# HANDOFF DOC — New Session Start
> Read this fully before responding. Do not skip ahead. Do not assume.

---

## MULTI-AI ALIGNMENT (July 14, 2026)

- **The Verdict**: Joel has decided on the multi-AI role model.
- **Claude**: Chief of Staff / Architect. You hold design authority and Git push credentials.
- **Gemini**: High-Volume Specialist (Execution/QA). Scoped Phase-0 access to this repo (read-only except `tests/` write) is **proposed, not yet granted** — Joel confirmed 2026-07-14 he has not turned it on. It needs an explicit privacy re-acceptance first (this repo is production code serving a real user, unlike the low-sensitivity brain folder). Until then, Gemini has no access to `C:\Projects\supermom` at all. Full detail: `07-knowledge/multi-ai-sync-scoping.md` §4 in second-brain.
- **Handoff Protocol**: When you have high-volume execution or QA tasks, define them in a `tasks.md` file and tag them `[owner: gemini]`. Joel will wake me up to execute them.
- **Hallucination Check**: Although you are Architect, I am mandated to review your plans and open a debate file if I spot a hallucination or logic error.

---

## WHO WE ARE

- **Joel** — solo developer/consultant, building SMHQ (Supermom for Hire HQ)
- **Sandra** — end client, solo personal-life-operations business owner in Georgetown ON. iPhone user. Services: organizing, decluttering, life coaching, caregiving, errands.
- **Working style**: Direct, concise, personal, fun. No fluff. Push back when warranted. Ask clarifying questions before acting. Surface better options before doing it the asked way.
- **ADHD accommodation**: Joel gets sidetracked. Maintain a visible Parked List. Surface dropped items proactively.
- **Instructions style**: Always give step-by-step instructions for any multi-step task — one action per step, never collapse or summarize steps.

---

## LAPTOP STATE

- **Fresh Windows install** — `C:\Projects\supermom\` (cloned May 31, 2026)
- Node.js LTS + Git installed via winget
- App runs at `http://localhost:5173` via `npm run dev` (port may vary — 8080 observed)
- API routes do NOT work with `npm run dev` — use the live Vercel URL for testing anything in `api/`
- `.env` at repo root (gitignored) — all keys set: Supabase, Gmail, Google OAuth, Maps. Still missing: `ANTHROPIC_API_KEY`

---

## SUPERMOM PROJECT — CURRENT STATE

### Local dev
- Folder: `C:\Projects\supermom\`
- Run: `npm run dev` → `http://localhost:5173` (frontend only)
- Deploy: `git push origin main` → auto-deploys to Vercel. **Never run `vercel --prod` manually.**
- Supabase project ID: `lskzzsjmmtsosfneuovt`

### GitHub
| Repo | Purpose |
|---|---|
| S7R3TCH-ops/supermom | Main app |
| S7R3TCH-ops/supermom-crm | Legacy vanilla JS — NOT cloned, low priority |

### Current version: 0.12.3 (Jun 2, 2026) — LIVE on Vercel

---

## WHAT WE JUST FINISHED (Jun 2, 2026)

### Google integrations — DONE ✅

**Gmail SMTP**
- Google Workspace live: `supermomforhire.com`, admin is `admin@supermomforhire.com`
- `invoice@supermomforhire.com` alias created, "Send mail as" configured + tested
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` in Vercel + local `.env`
- `api/email-invoice.js` sends from `invoice@supermomforhire.com`

**Google Calendar OAuth**
- OAuth consent screen configured (External, Testing mode)
- `jlundie@gmail.com` added as test user
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in Vercel + local `.env`
- Fixed two bugs: `business_id` not passed to login URL; `provider` → `service_name` in Settings query
- Fixed redirect URI bug: was using `VERCEL_URL` (deployment-specific), now uses `APP_BASE_URL` (canonical)
- **Tested and working** — Settings page shows CONNECTED

**Google Maps**
- Geocoding API + Distance Matrix API enabled in Cloud Console
- Maps API key restricted to those two APIs
- `GOOGLE_MAPS_API_KEY` in Vercel + local `.env`
- Code already exists: `api/distance.js`, `api/geocode.js`, `src/lib/maps.js` — not yet tested

### Also this session
- Old domain cleanup: removed `joel@supermom.com` from `provision.js` + `OnboardingWalkthrough.jsx`
- `InvoiceView.jsx` PDF print fixes (padding, page-break-inside, title restore timing)

---

## MUST DO NEXT — in order

### 1. Bug fixes
- Joel has a list — ask him at session start

### 2. Daily job briefing email
- Switch from nodemailer to **Resend** (free tier, 3k emails/month)
- Set up **Vercel Cron** job (daily 7am America/Toronto)
- Sends to `sandra@supermomforhire.com`: today's + tomorrow's jobs, times, clients, outstanding payments
- Test to `jlundie@gmail.com` first

### 3. Calendar sync — wire up to job create/update/delete
- `api/sync/gcal.js` exists and is solid — just needs to be called when jobs change
- Call on: job created, job updated (date/time/service), job completed, job deleted (soft)
- Consider: should sync be automatic or manual button per job?

### 4. Maps / geocoding — test it
- APIs enabled, key set — just needs a test run to confirm `api/geocode.js` + `api/distance.js` work

### 5. ANTHROPIC_API_KEY
- Add to Vercel + local `.env` when ready
- AI features fall back to mock without it — not urgent

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] **ANTHROPIC_API_KEY** — add to Vercel + local `.env`
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked. Link to `users` + Auth when ready.
- [ ] **Supabase schema grants — deadline Oct 30, 2026** — Run in SQL Editor:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ```

### Features — Phase 2
- [ ] **Custom domain → swap email provider** — swap `nodemailer` for `resend` when stable. 5-min job.
- [ ] **Staff Supabase Auth login + scheduling access**
- [ ] **Self-serve client booking link**
- [ ] **Offline mode** — app crashes if Supabase unreachable on first load
- [ ] **Client engagement tools** (AI follow-up / re-booking reminders)

---

## KEY ARCHITECTURE REMINDERS

### Financial math
- `flat_rate` = $/hr for Hourly jobs (not a flat fee — legacy field name, intentional)
- `total_amount` is written with the **finalized actual total** when a job completes. For Scheduled jobs it holds the booking estimate. Always use `computeJobFinancials()` — never read `total_amount` raw.
- `subtotal` (DB) = base labor only. `hst_amount` = finalized HST. Both written on completion.
- `payments` table = source of truth for amounts collected; `job.payment_status` is a cache
- Always use `computeJobFinancials()` from `src/lib/financialMath.js` — never inline math

### API layer
- Vercel Hobby plan: **9 of 12** functions used. 3 slots available.
- AI routes all go through `api/ai/[action].js` — do NOT add new files in `api/ai/`
- Helpers go in `api/_lib/` — files without `_` prefix in `api/` count as functions

### Multi-tenancy
- Every Supabase query must include `.eq('business_id', businessId)` — never skip this
- RLS is enabled but enforce in code too

### Soft deletes
- Never hard-delete jobs, clients, or workers — always set `deleted_at = now()`
- `hardDeleteJob` / `hardDeleteClient` exist for admin use only

### Workers / Skills
- `useWorkers()` returns workers with `skills: [{ skill_type_id, skill_name, pay_rate }]`
- `fetchJobById` uses PostgREST inline join for worker: `workers(name, person_type)`

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
- **Always give step-by-step instructions** for any multi-step task — one action per step, never collapse
- Surface better options BEFORE doing it the asked way
- Keep a visible Parked List and surface it when topics get dropped
- Be direct, concise, personal, fun — "gettin shit dun" is the motto
- Don't end with "does that make sense?" or "anything else I can help with?"
- Never commit `IS_TEST=true` to GitHub
- **Read `DESIGN.md` before ANY UI work** — design tokens, typography, component anatomy all defined there
- Increment version in `package.json` on every meaningful release
- Test on Joel's Pixel 10 Pro (Android) AND Sandra's iPhone
