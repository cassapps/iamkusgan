#!/usr/bin/env bash
# Safe reset script: backup local working tree and forcibly reset to remote branch
# Usage: ./scripts/reset-to-remote.sh [branch]
# Default branch: add-admin-login (project default). Change as needed.

set -euo pipefail

BRANCH=${1:-add-admin-login}
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
BACKUP_DIR="$HOME/kusgan-local-backup-$TIMESTAMP"

echo "Backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Save uncommitted changes as patch
echo "Saving uncommitted diff to $BACKUP_DIR/changes.patch"
git diff > "$BACKUP_DIR/changes.patch" || true

# Archive working tree (excluding .git)
echo "Archiving working tree to $BACKUP_DIR/worktree.tar.gz (excludes .git)"
tar -czf "$BACKUP_DIR/worktree.tar.gz" --exclude='./.git' .

# Optional: save list of untracked files
git ls-files --others --exclude-standard > "$BACKUP_DIR/untracked_files.txt" || true

# Fetch remote and reset
echo "Fetching origin and resetting to origin/$BRANCH"
git fetch origin --prune

# Ensure branch exists locally
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout "$BRANCH"
else
  echo "Local branch $BRANCH not found — creating tracking branch from origin/$BRANCH"
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

# Hard reset and clean
git reset --hard "origin/$BRANCH"
# Remove untracked files (including ignored)
git clean -fdx

echo "Reset complete. Backup is at: $BACKUP_DIR"

echo "Next steps:"
echo "  1) Install dependencies: npm ci (or npm install)"
echo "  2) Start API: cd api && npm run dev"
echo "  3) Start frontend: npm run dev"

