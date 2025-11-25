#!/usr/bin/env bash

set -e

# Default commit message if none provided
MSG=${1:-"Auto commit on $(date '+%Y-%m-%d %H:%M:%S')"}

echo "📦 Checking for changes..."

if git diff --quiet && git diff --cached --quiet; then
    echo "✔ No changes to commit."
    exit 0
fi

echo "➕ Staging all changes..."
git add .

echo "📝 Committing with message: $MSG"
git commit -m "$MSG"

echo "⬆️  Pushing to origin/main..."
git push origin main

echo "✅ Push complete."
