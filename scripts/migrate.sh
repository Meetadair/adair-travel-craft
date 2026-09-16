#!/usr/bin/env bash
# Applies any migration in supabase/migrations that this database has not seen.
#
# Runs over HTTPS through Supabase's management API rather than a Postgres
# connection, because the shell Claude works in can reach web hosts but not raw
# database ports. Each file is applied once and recorded, so running this twice
# is a no-op rather than an error.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .adair-secrets ] || { echo "No .adair-secrets — copy scripts/adair-secrets.example and fill it in."; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.adair-secrets; set +a
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "SUPABASE_ACCESS_TOKEN is empty in .adair-secrets."; exit 1; }

REF=$(grep -E '^SUPABASE_PROJECT_ID=' .env | cut -d= -f2 | tr -d '"'"'"' ')
[ -n "$REF" ] || { echo "SUPABASE_PROJECT_ID missing from .env."; exit 1; }

API="https://api.supabase.com/v1/projects/${REF}/database/query"

run_sql() {
  # Sends one statement and fails loudly on anything that is not a 2xx.
  local sql="$1"
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$sql")
  local out code
  out=$(curl -sS -w '\n%{http_code}' -X POST "$API" \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        --data-binary "$body")
  code=$(tail -n1 <<<"$out")
  if [ "$code" != "200" ] && [ "$code" != "201" ]; then
    echo "Supabase refused the statement (HTTP $code):" >&2
    sed '$d' <<<"$out" >&2
    return 1
  fi
  sed '$d' <<<"$out"
}

# Where we remember what has already run. Created on first use.
run_sql "create table if not exists public.applied_migrations (
           name text primary key,
           applied_at timestamptz not null default now()
         );" >/dev/null

applied=$(run_sql "select name from public.applied_migrations;")

pending=0
for file in supabase/migrations/*.sql; do
  name=$(basename "$file")
  case "$applied" in *"\"$name\""*) continue ;; esac
  echo "Applying $name…"
  run_sql "$(cat "$file")" >/dev/null
  run_sql "insert into public.applied_migrations (name) values ('$name') on conflict do nothing;" >/dev/null
  echo "  done."
  pending=$((pending + 1))
done

[ "$pending" -gt 0 ] && echo "Applied $pending migration(s)." || echo "Database is already up to date."
