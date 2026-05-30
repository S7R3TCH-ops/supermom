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
- **Paste in CLI**: running inside tmux/screen — Shift+Enter won't work. Use `Ctrl+J` for newlines or backslash+Enter.

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

### Current version: 0.8.1 (May 30, 2026)

---

## WHAT WE JUST FINISHED (this session — May 30, 2026)

### Diagnosed why live site wasn't updated
- v0.7.1 through v0.8.0 were all local-only — never committed or pushed. Session ended before commit step.
- Committed and pushed everything as v0.8.0.

### Fixed Vercel build failure
- v0.8.0 push triggered a build error: Vercel Hobby plan limits to 12 serverless functions. We had 13 after adding `api/email-invoice.js` in v0.7.2.
- Fix: deleted `api/ai/thank-you-draft.js` and `src/components/sheets/ThankYouDraftSheet.jsx` — both fully orphaned after PostJobSheet dead-code removal in v0.8.0.
- **Currently at exactly 12 functions. Adding any new API route = hits the limit again.**

### Invoice PDF polish (v0.8.1)
- `@page { margin: 0 }` in print CSS → suppresses Chrome's date/time/URL header+footer from PDFs
- Print button sets `document.title` to `LastName_Invoice_XXXX` before `window.print()` → PDF saves with clean filename
- Thank-you line: "Thank you for letting Supermom save the day."

### Fixed `npm run dev` broken
- `node_modules` was wiped by a failed `npm ci` during debugging. Ran `npm install` to restore.

---

## MUST DO NEXT — in priority order

### 1. Job edit time round-trip (Joel checking manually)
Edit a future/scheduled job's time, save, confirm the displayed time didn't shift. If it did shift, the bug is in `JobDetailSheet` `saveEdit` composing the ISO string. Report back.

### 2. owedTotal for Partial clients
`selectors.js` shows full job total instead of remaining balance for Partial clients. Fix: join payments table in `clientsRepo.js`, subtract `amount_paid` in `toDisplayClient`. Code-only, no SQL migration.

### 3. Gmail App Password (blocked on domain)
When `sandra@supermom.com` is live:
- Google Account → Security → 2-Step Verification → App Passwords → Create → copy 16-char code
- Add to `.env` + Vercel dashboard:
```
GMAIL_USER=sandra@supermom.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
APP_BASE_URL=https://supermom-v2.vercel.app
```

---

## PARKED LIST (do not let these disappear)

### Immediate
- [ ] Job edit time round-trip — Joel verifying manually (if broken, fix in JobDetailSheet)
- [ ] owedTotal balance for Partial jobs — code-only fix in clientsRepo.js + toDisplayClient
- [ ] Gmail App Password → waiting on sandra@supermom.com domain going live
- [ ] 16 missing Vercel env vars — confirm nothing breaks as features are used
- [ ] Credential rotation — DB password + GitHub token were in a public commit
- ⚠ Vercel Hobby plan: exactly 12/12 serverless functions used. No room for new API routes without deleting one or upgrading.

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
