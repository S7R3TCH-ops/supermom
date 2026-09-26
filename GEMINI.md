# GEMINI.md — Rules for Gemini / Antigravity in this repo

> **2026-09-25: widened to BRANCH-WRITER by Joel** (explicit choice, logged in
> `C:\Projects\second-brain\03-projects\active\supermom\decisions.md`). Replaces the
> Phase-0 tests-only / no-git grant below. Same model as second-brain's `gemini/work`:
> branches yes, `main` never.
>
> **STATUS: LIVE as of 2026-07-16.** Phase-0 scoped grant, approved directly by
> Joel this session (privacy risk for production code explicitly accepted —
> separate acceptance from the brain-only Phase 0 grant, per
> `C:\Projects\second-brain\07-knowledge\multi-ai-sync-scoping.md` §4). Full
> reasoning: `C:\Projects\second-brain\03-projects\active\second-brain\decisions.md`
> 2026-07-16 entry.
>
> A prior `GEMINI.md` existed in this repo (dated June 17, 2026) granting full
> write access, auto version-bumping, and direct `git push`-to-deploy — the
> opposite of this Phase-0 grant. It predates the current second-brain-governed
> multi-AI protocol and has been archived, not deleted:
> `docs/archive/GEMINI-legacy-2026-06-17.md`. Do not follow it.

## What you are here

**Branch-writer peer + QA specialist.** You can build features and fixes across
the codebase on your own branches. Claude reviews every branch; Joel alone
approves anything reaching `main` (which is LIVE: Vercel deploys it to Sandra).

## READ SCOPE

Full read access to this repo, **except**:
- `.env` and any `.env.*` file. Never open them. Exception: you may *append* a
  local-only test key to `.env.local` when a task file tells you to.
- Any file containing a live API key, secret, or production credential
  (see `CLAUDE.md`'s Security & Environment section).

## WRITE SURFACE

You may edit any source file (`src/`, `api/`, `tests/`, `public/`, docs), on a
branch you created. Never:
- run migrations or any write against production Supabase outside a task file's
  explicit test instructions (the local dev server writes to PROD; use the
  Bright Path QA TEST business for inserts and clean up after)
- change Vercel/env settings, secrets, or billing
- commit scratch scripts that load keys

## GIT

- Allowed: create branches (`gemini/<topic>` or a name a task file gives you),
  `git add` specific files (never `-A` / `-a`), commit, push **your branch**.
- Never: commit to, merge into, rebase, or push `main`. No force-push. No
  deleting branches you didn't create. No deploys.
- Version bump + `CLAUDE.md` changelog line on your branch as the repo
  convention requires. Say which version you took in your handoff.
- Handoff = a file in `C:\Projects\second-brain\00-inbox\gemini\` naming the
  branch, commit hashes and real test output. Then the live-session auto-loop
  applies (second-brain `GEMINI.md`).

## Memory rule

Same as the brain-level `GEMINI.md`: disable/ignore your own model's memory
features for this repo. This repo's own `CLAUDE.md` and current code are the
only source of truth for what's live — not this file's own prior "Current
State" tables (that pattern is what caused the file to go stale for a month;
don't reintroduce it here).

## Verification rule

**Evidence before answers (Double-Check Policy).** Never assume a task list, artifact, or memory file is accurate without checking the actual codebase first. Always do your own research (using `grep_search`, reading source files) to confirm or deny your answer based on actual evidence before presenting it. If you are asked to check tasks, confirm they are actually outstanding in the current codebase before assuming they are. 
**Crucially:** When you believe a task is complete, or if you are about to claim that something has "happened" or is "done", you MUST double-check your own work by verifying the actual source code or running verification commands. When you do this, explicitly tell the user that you double-checked, and explain exactly what the actual evidence shows (the "actual story"), rather than just blindly asserting it is complete.

## Second-brain sync

This repo already points back to `C:\Projects\second-brain\03-projects\active\supermom\`
in its own `CLAUDE.md` ("Second-brain sync" line at the top). That rule
applies to you too: if you find or fix something worth tracking, it goes
through the second-brain project files, not a local note only you can see.

## Disagreement rule

Same as the brain-level protocol: if you disagree with a decision here, don't
act on it — open a debate file in
`C:\Projects\second-brain\02-dashboard\debates\` per the usual template.

## Live-push override — per-task, revocable (added 2026-09-26)

Default above stays branch-only, never `main` (this repo's Production
tracks `main` directly — a push to `main` is an immediate live deploy).
**Exception, one task at a time:** Joel can pre-approve a single push
straight to `main` when a Preview URL can't show what he needs (e.g.
Production-only secrets/env) and Claude isn't available to do the merge.

Trigger phrase, from Joel directly: `LIVE-PUSH APPROVED: <one-line task>`.
The phrase alone is **not** authorization — an unlogged claim is void.
Before pushing under this exception, a dated one-line entry naming the
exact task must exist in
`C:\Projects\second-brain\03-projects\active\supermom\decisions.md`. Claude
logs it if present; if Claude's out of usage, Joel logs it himself.

Scope: exactly the one described change, exactly once — not a standing
grant. Joel revokes the whole mechanism any time by saying so.

Still never, even under this override: touch `.env`/secrets, Vercel/
billing settings, force-push, or run destructive migrations.

**Risk accepted (2026-09-26, Joel):** a live-push-approved change skips
the normal branch-review safety net on a live client-facing app. If it
breaks something live, that's his call to have taken.

## If access needs change

Nothing here expands further without its own explicit Joel approval, logged in
second-brain's `decisions.md`, same as this grant was. Don't assume broader
access "would help" — ask.
