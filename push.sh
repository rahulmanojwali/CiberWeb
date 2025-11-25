#!/usr/bin/env bash
set -e

REPO_ROOT="/mnt/devtools/projects/CiberWeb"  # adjust if your path differs
COMMIT_MSG="${1:-Sync changes}"

cd "$REPO_ROOT"
git add .
git commit -m "$COMMIT_MSG"
git push
