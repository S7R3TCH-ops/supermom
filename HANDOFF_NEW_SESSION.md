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
- `.env` at repo root (gitignored) — contains `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. Gmail/Google creds not yet added (waiting on Sandra's domain).

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

### Current version: 0.12.1 (May 31, 2026)
> v0.12.0 is live on Vercel. v0.12.1 is committed + pushed, pending merge to main.

---

## WHAT WE JUST FINISHED (May 31, 2026)

### v0.12.1 — Infrastructure + data layer refactor (AI Studio review)

Three changes from an external AI code review — all committed to branch `claude/ai-studio-review-analysis-2yDhP`:

1. **AI serverless consolidation** — `api/ai/enrich-client.js`, `estimate-duration.js`, `prep-note.js`, `test-persona.js` merged into single `api/ai/[action].js` dynamic route. Vercel function count: 12 → 9. All mock fallbacks + frontend fetch paths unchanged.

2. **`fetchJobById` PostgREST join** — Removed the separate sequential worker lookup. Now uses `workers(name, person_type)` inline join in the main select. Schema cache refreshed via `NOTIFY pgrst, 'reload schema'` in Supabase SQL Editor.

3. **Financial write-back on completion** — `recordPayment` now writes finalized `subtotal`, `hst_amount`, `total_amount` to the jobs row on completion. These DB columns existed but were never populated post-completion. SQL aggregates against `total_amount` now give accurate figures.

### Also this session
- Fresh Windows dev environment set up (`C:\Projects\supermom`)
- Joel's local Claude Code is running from the project folder

---

## MUST DO NEXT — in priority order

### 1. Merge v0.12.1 branch to main + deploy
Branch: `claude/ai-studio-review-analysis-2yDhP` → merge to `main` → Vercel auto-deploys.

### 2. Vercel env vars (Google/Gmail)
Already in Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`.
Still missing:
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (Calendar OAuth)
- `VITE_GOOGLE_MAPS_API_KEY` (maps/geocode)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` (waiting on `sandra@supermom.com` domain)
- `ANTHROPIC_API_KEY` (in Vercel, also add to local `.env` for AI features)

### 3. Supabase public schema grants — deadline Oct 30, 2026
Run in SQL Editor before then:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
```

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] **Merge v0.12.1 → main + deploy** — branch ready, needs PR or direct merge
- [ ] **ANTHROPIC_API_KEY** — add to Vercel + local `.env` (AI features fall back to mock without it)
- [ ] **Gmail App Password** — blocked on `sandra@supermom.com` domain going live
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked. Link to `users` + Auth when ready.
- [ ] **Supabase schema grants** — before Oct 30, 2026 (see above)

### Features — Phase 2
- [ ] **Custom domain → swap email provider** — when Sandra's domain is live, swap `nodemailer` for `resend`. 5-min job.
- [ ] **Sandra daily job briefing email** — Vercel Cron, 7am Toronto, Resend
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
- Email: `sandra@supermom.com` (domain pending — use everywhere, not the old Gmail)
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
