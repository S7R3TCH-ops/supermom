#!/bin/bash
# Auto-save: stages, commits, and pushes uncommitted changes at end of each Claude turn.
# Runs silently when tree is clean. .env is excluded automatically via .gitignore.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

# Exit early if nothing has changed
if git diff --quiet HEAD 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  exit 0
fi

# Stage everything (gitignore handles .env exclusion)
git add -A

# Exit if nothing staged (e.g. only gitignored files changed)
git diff --staged --quiet && exit 0

# Commit with timestamp
git commit -m "auto: session save $(date '+%Y-%m-%d %H:%M')" 2>/dev/null

# Push to remote if tracking branch exists — fail silently if not
git push 2>/dev/null || true
