---
description: End-of-session wrap — updates CLAUDE.md, commits, pushes. Then type /clear.
---

Wrap up this session:

1. Run `git log --oneline -15` to see what landed since the last documented session
2. Read CLAUDE.md (focus on "Recent changes", "Current version", "Parked / not building yet")
3. Update CLAUDE.md:
   - Bump version in `package.json` and CLAUDE.md header if meaningful features shipped
   - Add a dated bullet under "Recent changes" summarising what changed (facts from git log, not vague descriptions)
   - Remove completed items from "Parked" / open items lists
   - Update "Next session priorities" if the focus has shifted
4. Run: `git add CLAUDE.md package.json && git diff --cached --stat`
5. If there are staged changes, commit and push: `git commit -m "docs: session wrap" && git push`
6. Output exactly: "Wrapped ✓ — type /clear to start the next session fresh."
