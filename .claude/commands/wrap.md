---
description: End-of-session wrap — updates CLAUDE.md, commits, pushes. Then type /clear.
---

Wrap up this session:

1. Run `git log --oneline -15` to see what landed since the last documented session
2. Read CLAUDE.md (focus on "Recent changes", "Current version", "Parked / not building yet")
2.5. Repo hygiene pass:
   - `git branch -vv` and `git fetch --all --prune` — for any local/remote branch fully merged into main (`git log main..<branch> --oneline` returns nothing), delete it: `git branch -d <branch>` locally, `git push origin --delete <branch>` remotely. Branches with unmerged commits: leave alone, just note them in the wrap-up output for Joel to look at.
   - `git worktree list` — if `git worktree prune -v` reports a stale entry it can't remove (permission denied), note it in the wrap-up output rather than force-deleting; Joel can close whatever's holding the lock.
   - `git status --short` — if any tracked file looks like per-session/per-machine noise (CLI cache stamps, local-only settings that keep re-diffing every session), flag it rather than silently untracking it.
3. Update CLAUDE.md:
   - Bump version in `package.json` and CLAUDE.md header if meaningful features shipped
   - Add a dated bullet under "Recent changes" summarising what changed (facts from git log, not vague descriptions)
   - Remove completed items from "Parked" / open items lists
   - Update "Next session priorities" if the focus has shifted
4. Run: `git add CLAUDE.md package.json && git diff --cached --stat`
5. If there are staged changes, commit and push: `git commit -m "docs: session wrap" && git push`
6. Run: `New-Item 'C:\Users\Joel\.claude\sm-wrap-done.flag' -ItemType File -Force | Out-Null`
7. Output exactly: "Wrapped ✓"
