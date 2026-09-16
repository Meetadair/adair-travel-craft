#!/usr/bin/env bash
# Pushes whatever is committed, using the token in .adair-secrets.
#
# The token is passed to git through an environment variable and a throwaway
# credential helper, so it never lands in .git/config, in the shell history, or
# in any output. Nothing is echoed but the result.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .adair-secrets ] || { echo "No .adair-secrets — copy scripts/adair-secrets.example and fill it in."; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.adair-secrets; set +a
[ -n "${GITHUB_TOKEN:-}" ] || { echo "GITHUB_TOKEN is empty in .adair-secrets."; exit 1; }

ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
echo "Pushing $ahead commit(s) to origin/main…"

GIT_TERMINAL_PROMPT=0 \
git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=${GITHUB_TOKEN}"; }; f' \
    push origin main

echo "Pushed. origin/main is now $(git rev-parse --short origin/main)."
