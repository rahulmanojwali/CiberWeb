#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/CiberWeb"
APP_DIR="$REPO_DIR/admin-panel"
DIST_DIR="$APP_DIR/dist"

echo ">>> Web deploy started at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cd "$REPO_DIR"

echo ">>> Checking for local server changes..."
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ ERROR: Local changes detected on server."
  echo "Do not edit files directly on the server."
  exit 1
fi

echo ">>> Pulling latest source + compiled dist..."
git pull --ff-only

echo ">>> Verifying compiled build..."
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "❌ ERROR: dist/index.html is missing."
  echo "Build locally and push dist before deploying."
  exit 1
fi

if [ ! -d "$DIST_DIR/assets" ]; then
  echo "❌ ERROR: dist/assets is missing."
  exit 1
fi

echo "✅ Web deploy complete."
echo ">>> No npm install or server-side build was run."
