#!/usr/bin/env bash
# Switch Adair between Duffel's test and live keys.
#
#   ./scripts/duffel-mode.sh          # says which mode is on
#   ./scripts/duffel-mode.sh test     # point DUFFEL_API_KEY at the test key
#   ./scripts/duffel-mode.sh live     # point it back at the live key
#
# Both keys stay in .env as DUFFEL_TEST_API_KEY and DUFFEL_LIVE_API_KEY; this
# only changes which one DUFFEL_API_KEY copies. No key is ever printed.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env"

read_key() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs || true; }
mode_of() { case "$1" in duffel_test*) echo test ;; duffel_live*) echo live ;; "") echo none ;; *) echo unknown ;; esac; }

CURRENT="$(read_key DUFFEL_API_KEY)"

if [ $# -eq 0 ]; then
  echo "Duffel mode: $(mode_of "$CURRENT")"
  [ -n "$(read_key DUFFEL_TEST_API_KEY)" ] && echo "test key: set" || echo "test key: MISSING — paste it into .env as DUFFEL_TEST_API_KEY="
  [ -n "$(read_key DUFFEL_LIVE_API_KEY)" ] && echo "live key: set" || echo "live key: missing"
  exit 0
fi

case "$1" in
  test) WANT="$(read_key DUFFEL_TEST_API_KEY)"; NAME="DUFFEL_TEST_API_KEY" ;;
  live) WANT="$(read_key DUFFEL_LIVE_API_KEY)"; NAME="DUFFEL_LIVE_API_KEY" ;;
  *) echo "usage: $0 [test|live]" >&2; exit 2 ;;
esac

if [ -z "$WANT" ]; then
  echo "$NAME is empty in .env — paste the key there first, then run this again." >&2
  exit 1
fi

python3 - "$WANT" <<'PY'
import pathlib, re, sys
want = sys.argv[1]
p = pathlib.Path(".env"); s = p.read_text()
s = re.sub(r"^DUFFEL_API_KEY=.*$", "DUFFEL_API_KEY=" + want, s, count=1, flags=re.M)
p.write_text(s)
PY

echo "Duffel mode is now: $(mode_of "$WANT")"
echo "Restart the dev server so it picks the key up:  ./scripts/dev-up.sh"
