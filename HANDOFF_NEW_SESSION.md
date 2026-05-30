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

- Profile: `C:\Users\jlund` — functional (recovered from ACL strip, everything critical on GitHub/Vercel)
- Node v24.14.1, npm 11, Git 2.54, GitHub CLI 2.92, VS Code — all working
- App runs at `http://localhost:8080` via `npm run dev` (or 8081 if 8080 is in use)
- `.env` at repo root (gitignored) — contains `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Gmail creds not yet added.

---

## SUPERMOM PROJECT — CURRENT STATE

### Local dev
- Folder: `C:\Users\jlund\Projects\supermom\`
- Run: `npm run dev` → `http://localhost:8080`
- Deploy: `git push origin main` → auto-deploys to Vercel. **Never run `vercel --prod` manually.**
- Supabase project ID: `lskzzsjmmtsosfneuovt`

### GitHub
| Repo | Purpose |
|---|---|
| S7R3TCH-ops/supermom-v2 | Main app (cloned locally as `supermom`) |
| S7R3TCH-ops/supermom-crm | Legacy vanilla JS — NOT cloned, low priority |

### Current version: 0.11.0 (May 30, 2026)
> v0.11.0 committed and pushed to Vercel.

---

## WHAT WE JUST FINISHED (this session — May 30, 2026)

### v0.11.0 — Worker pay tracking + admin hard-delete UI + Calendar polish + Invoice mobile

**DB migration run this session:**
- `ALTER TABLE jobs ADD COLUMN worker_paid boolean DEFAULT false;` ✅

**Three UI pieces added this session:**

1. **JobDetailSheet edit form — Worker Paid toggle** — "Worker Paid?" toggle button appears in edit mode when a team member is assigned. Green "Paid ✓" / amber "Not Yet Paid". Reads/writes `form.worker_paid`. Sits between "Pay for this job ($)" field and SeriesPicker.

2. **JobDetailSheet admin footer — Permanently Delete Job** — "Permanently Delete Job (Admin)" link below the existing soft-delete "Delete Job (Admin)" link. Tapping shows inline confirm panel (Cancel + "Delete Forever"). Calls `hardDeleteJob(job.id)`. Admin-only (`isAdmin`).

3. **ClientProfile admin danger zone — Permanently Delete Client** — Second section inside Admin Actions collapse, below Archive. Same 2-tap confirm pattern. Calls `hardDeleteClient(id)`. Navigates to `/clients` on success. Uses dark red (`#7F1D1D`) to visually distinguish from archive (`#B01550`).

**Also in v0.11.0 (shipped in previous session within same day):**
- `recordPayment` in `jobsRepo.js` accepts `workerPaid` param (9th arg) and writes `worker_paid` to DB.
- `hardDeleteJob(id)` in `jobsRepo.js` — permanent hard-delete.
- `hardDeleteClient(clientId)` in `clientsRepo.js` — cascades to all client jobs.
- `FinancialMathBreakdown.jsx` — "👷 Worker Cost" section showing worker name, pay, Paid/Not Yet Paid badge.
- `PostJobSheet.jsx` — `workerPaid` toggle in wrap-up UI.
- Calendar polish: current-time indicator, half-hour dashed lines, Day view time always shown, Week view 4-state color coding.
- Invoice mobile scale-to-fit via ResizeObserver + transform:scale().
- HST grandTotal wired through PaymentBreakdown → JobCard/UpcomingCard → Home.jsx.

---

## MUST DO NEXT — in priority order

### 1. Verify v0.11.0 end-to-end on device (clean slate)
1. Admin → Staff Management → "Team Management" + Workers/Staff tabs
2. Skill Catalog → add "Organizing", "Caregiving"
3. Add a Worker → assign skills with pay rates
4. Staff tab → add a Staff member
5. New job → assign worker → pay auto-fills from skill rate
6. Job cards on Home + Calendar → `👷 Worker:` / `⭐ Staff:` labels
7. Wrap up job → PostJobSheet shows worker name + pay + paid toggle
8. FinancialMathBreakdown → Worker Cost section at bottom
9. Edit job → Worker Paid? toggle visible and functional
10. Admin: Permanently Delete Job → 2-tap confirm works
11. ClientProfile Admin Actions → Permanently Delete Client → 2-tap confirm works

### 2. owedTotal for Partial clients
Clients page shows full job total instead of remaining balance for Partial clients.
- Fix in `clientsRepo.js` + `toDisplayClient` in `selectors.js`
- Join payments table, subtract `amount_paid` per job
- No SQL migration needed — code only

### 3. Job edit time round-trip
Joel to verify manually: edit a scheduled job's time, save, confirm displayed time didn't shift. If it did, bug is in `JobDetailSheet` `saveEdit` → `composeTorontoISO`.

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] **v0.11.0 on-device verify** — see checklist above
- [ ] **owedTotal for Partial clients** — code-only fix in clientsRepo + selectors
- [ ] **Job edit time round-trip** — Joel checking on device
- [ ] **worker_pay → Finance page (Phase 2)** — stored but not deducted from profit. Deliberate v1 scope.
- [ ] **Staff app access (Phase 2)** — `person_type = 'staff'` tracked. Link to `users` + Auth when ready.
- [ ] **Gmail App Password** — blocked on `sandra@supermom.com` domain. When live: App Password → `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `.env` + Vercel. Also `APP_BASE_URL=https://supermom-v2.vercel.app`.
- [ ] **16 missing Vercel env vars** — only VITE_SUPABASE_ANON_KEY + VERCEL_OIDC_TOKEN pull locally. Others are Production-only.
- [ ] **Credential rotation** — DB password + GitHub token were in a public commit. Should be rotated.
- ⚠ **Vercel 12-function limit** — at exactly 12/12. No new API routes without deleting one or upgrading to Pro.

### Laptop / environment
- [ ] WSL2 cleanup: `sudo umount /mnt/recovery` → `exit` → `wsl --unmount`
- [ ] GitHub repo rename: `supermom-v2` → `supermom` (cosmetic)
- [ ] Full Windows format + clean reinstall (deferred)

### Features — Phase 2
- [ ] Custom domain → swap nodemailer for Resend when `sandra@supermom.com` is live (5-min job)
- [ ] Sandra daily job briefing email — Vercel Cron, 7am Toronto, Resend
- [ ] Staff Supabase Auth login + scheduling access
- [ ] Self-serve client booking link
- [ ] Offline mode
- [ ] Client engagement tools (AI follow-up / re-booking reminders)

---

## KEY ARCHITECTURE REMINDERS

### Financial math
- `flat_rate` = $/hr for Hourly jobs (not a flat fee — legacy field name, intentional)
- `total_amount` = booking-time estimate only, never updated after completion
- Always use `computeJobFinancials()` from `src/lib/financialMath.js` — never inline math
- `payments` table = source of truth for collected amounts; `job.payment_status` is a cache

### Multi-tenancy
- Every Supabase query must include `.eq('business_id', businessId)` — never skip this
- RLS is enabled but don't rely on it as the only guard — enforce in code too

### Soft deletes
- Never hard-delete jobs, clients, or workers **from normal flows** — always set `deleted_at = now()`
- Hard delete functions (`hardDeleteJob`, `hardDeleteClient`) exist for admin use only
- Archived workers still resolve on historical jobs via `includeArchived: true`

### Workers / Skills
- `useWorkers()` returns workers with a `skills: [{ skill_type_id, skill_name, pay_rate }]` array
- `assignee_type` on display jobs comes from `toDisplayJob` → `w.person_type`
- `fetchJobById` in jobsRepo does NOT use PostgREST join for worker — uses explicit separate query (avoids schema cache dependency on FK)
- **Never chain `.catch()` directly on a Supabase query builder** — use try/catch or rely on the `error` field in the response.

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
