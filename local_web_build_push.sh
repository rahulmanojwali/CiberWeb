#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/mnt/devtools/projects/Apis/CiberMandi/CiberWeb"
APP_DIR="$REPO_DIR/admin-panel"

cd "$APP_DIR"

echo ">>> Building Web Admin locally..."
npm run build

cd "$REPO_DIR"

echo ">>> Staging source + dist..."
git add .

if git diff --cached --quiet; then
  echo ">>> No changes to commit."
  exit 0
fi

COMMIT_MSG="${1:-update web admin}"

echo ">>> Committing..."
git commit -m "$COMMIT_MSG"

echo ">>> Pushing to GitHub..."
git push origin main

echo "✅ Local build + Git push complete."
