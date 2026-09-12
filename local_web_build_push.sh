#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/mnt/devtools/projects/Apis/CiberMandi/CiberWeb"
APP_DIR="$REPO_DIR/admin-panel"

echo ">>> CiberMandi Web local build + push"
echo ">>> Repo: $REPO_DIR"
echo ">>> App:  $APP_DIR"

cd "$APP_DIR"

echo ">>> Building Web Admin locally..."
npm run build

echo ">>> Verifying production build..."
if [ ! -f "dist/index.html" ]; then
  echo "❌ ERROR: dist/index.html was not created."
  exit 1
fi

if [ ! -d "dist/assets" ]; then
  echo "❌ ERROR: dist/assets was not created."
  exit 1
fi

cd "$REPO_DIR"

echo ">>> Staging all source changes/deletions..."
git add -A

echo ">>> Force-staging complete compiled dist (including new Vite hashed assets)..."
git add -f admin-panel/dist

echo ">>> Staged changes:"
git status --short

if git diff --cached --quiet; then
  echo ">>> No changes to commit."
  exit 0
fi

COMMIT_MSG="${1:-update web admin}"

echo ">>> Committing..."
git commit -m "$COMMIT_MSG"

echo ">>> Pushing to GitHub main..."
git push origin main

echo "✅ Local build + Git push complete."
echo ">>> Next on server: ./server_web_deploy.sh"
