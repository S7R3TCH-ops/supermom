# HANDOFF DOC — New Session Start
> Read this fully before responding. Do not skip ahead. Do not assume.

---

## WHO WE ARE

- **Joel** — solo developer/consultant, building SMHQ (Supermom for Hire)
- **Sandra** — end client, solo personal-life-operations business owner in Georgetown ON. iPhone user. Services: organizing, decluttering, life coaching, caregiving, errands.
- **Working style**: Direct, concise, personal, fun. No fluff. Push back when warranted. Ask clarifying questions before acting. Surface better options before doing it the asked way.
- **ADHD accommodation**: Joel gets sidetracked. Maintain a visible Parked List. Surface dropped items proactively.

---

## LAPTOP STATE

- Profile is `C:\Users\jlund` — functional but recovered from ACL strip. Everything critical is on GitHub/Vercel.
- Node v24.14.1, npm 11, Git 2.54, GitHub CLI 2.92, VS Code — all working.
- App runs at `http://localhost:8080` via `npm run dev`.
- `.env` at repo root (gitignored) — contains `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Gmail creds not yet added.

---

## SUPERMOM PROJECT — CURRENT STATE

### Local dev
- Folder: `C:\Users\jlund\Projects\supermom\`
- Run: `npm run dev` → `http://localhost:8080`
- Deploy: `git push origin main` → auto-deploys to Vercel. **Do NOT run `vercel --prod` manually.**
- Supabase project ID: `lskzzsjmmtsosfneuovt`

### GitHub repos
| Repo | Purpose |
|---|---|
| S7R3TCH-ops/supermom-v2 | Main app (cloned locally as `supermom`) |
| S7R3TCH-ops/supermom-crm | Legacy vanilla JS — NOT cloned, low priority |
| S7R3TCH-ops/fetlife-auto-poster | Minxymomma project (cloned as `minxymomma`) |

### Current version: 0.7.5 (May 30, 2026)

---

## WHAT WE JUST FINISHED (this session — May 30, 2026)

### MD file sync
- Removed stale "⚠ Bugs found this session" block from CLAUDE.md (both were fixed in v0.7.5)
- Updated HANDOFF from v0.7.2 → v0.7.5

### CS1–CS3 verification pass — PASSED
Full Playwright-driven verification against live dev server (Sandra's viewpoint):
- **CS1**: Partial payment flow confirmed end-to-end. Partial save → orange card → reopen → balance pre-filled correctly → "Save & Log Paid" button → job drops off Needs Action. Toasts: "Payment saved — balance owing." (partial) confirmed.
- **CS2**: Card colors confirmed — unpaid=red, partial=orange with breakdown, Done This Week=green with PAID ✓ badge.
- **CS3**: Subtotals on cards confirmed — Done This Week shows pre-HST amount. Needs Action shows full collection amount.
- **Hero "collected"**: `$150 collected` line confirmed present and updating.
- **Job edit time round-trip**: NOT tested via automation (completed job edit didn't expose time input). Joel checking manually on device.

### Supabase businesses record
- Updated to `sandra@supermom.com`, `(416) 738-0309`, Georgetown ON, `777616178 RT0001`
- `sandra@supermom.com` is now Sandra's **canonical email** for everything (domain pending)

### Sandra's canonical email established
- `sandra@supermom.com` — Google Workspace on her custom domain (not yet live)
- Replaces `supermomsforhire@gmail.com` everywhere: invoices, e-Transfer ref, Google Calendar OAuth, Gmail SMTP, Google Maps
- When domain goes live: get Gmail App Password → add to .env + Vercel

---

## MUST DO NEXT — in priority order

### 1. Job edit time round-trip (Joel checking manually)
Edit a future/scheduled job's time, save, confirm the displayed time didn't shift. If it did shift, the bug is in `JobDetailSheet` `saveEdit` composing the ISO string. Report back next session.

### 2. Gmail App Password (blocked on domain)
When `sandra@supermom.com` is live:
- Google Account → Security → 2-Step Verification → App Passwords → Create → copy 16-char code
- Add to `.env` + Vercel dashboard:
```
GMAIL_USER=sandra@supermom.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] Job edit time round-trip — Joel verifying manually (if broken, fix in JobDetailSheet)
- [ ] Gmail App Password → waiting on sandra@supermom.com domain going live
- [ ] 16 missing Vercel env vars — confirm nothing breaks as features are used
- [ ] Credential rotation — DB password + GitHub token were in a public commit

### Laptop / environment
- [ ] WSL2 cleanup: `sudo umount /mnt/recovery` → `exit` → `wsl --unmount`
- [ ] GitHub repo rename: `supermom-v2` → `supermom` (cosmetic)
- [ ] Full Windows format + clean reinstall (deferred — do at natural stopping point)

### Features — Phase 2
- [ ] Custom domain → swap nodemailer for Resend when `sandra@supermom.com` is live (5-min job)
- [ ] Sandra daily job briefing email — Vercel Cron, 7am Toronto, uses Resend
- [ ] Self-serve client booking link
- [ ] Offline mode
- [ ] Client engagement tools (AI follow-up / re-booking reminders)

---

## PREFERENCES & RULES FOR THIS AI

- Don't make assumptions — ask clarifying questions
- Surface better options BEFORE doing it the asked way
- Keep a visible Parked List and surface it when topics get dropped
- Be direct, concise, personal, fun — "gettin shit dun" is the motto
- Don't end with "does that make sense?" or "anything else I can help with?"
- Never commit IS_TEST=true to GitHub
- Read DESIGN.md before ANY UI work
- Increment version in package.json on every meaningful release
- Test on Joel's Pixel 10 Pro AND Sandra's iPhone
- Sandra's canonical email is `sandra@supermom.com` — use this everywhere, not supermomsforhire@gmail.com
