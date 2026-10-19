#!/usr/bin/env bash
# Put main on staging, so the change can be tried there before production.
#
#   ./deploy-staging.sh
#
# staging is not a branch anybody commits to: it is reset to main and
# force-pushed, every time. The host deploys staging on its own when the branch
# moves. When staging has been tried and is healthy, ./release.sh promote moves
# the same commit to production.
set -e

CURRENT=$(git rev-parse --abbrev-ref HEAD)

echo "→ Current branch: $CURRENT"

if [ "$CURRENT" != "main" ]; then
  echo "✗ Must be on main before deploying to staging. Switch to main first."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✗ You have uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "→ Switching to staging..."
git checkout staging

echo "→ Resetting staging to main..."
git reset --hard main

echo "→ Force-pushing staging to origin..."
git push origin staging --force

echo "→ Switching back to main..."
git checkout main

echo "✓ Done. Staging is now synced with main and pushed; the host deploys it."
