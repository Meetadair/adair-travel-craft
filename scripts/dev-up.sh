#!/usr/bin/env bash
# Make sure a dev server is running on 8080, and leave it running.
#
# Playwright's webServer starts its own server when none is up and kills it
# when the run ends — which repeatedly took down the server somebody was using
# in a browser. With this run first, Playwright always finds an existing server
# and reuses it instead, so an e2e run never costs anyone their localhost.
#
#   ./scripts/dev-up.sh            # start one if none is running
#   ./scripts/dev-up.sh --restart  # stop the running one first
#
# The restart flag exists because the server reads .env once, at startup. After
# a key or a database changes, "already up" is the wrong answer: the process
# still holds the old values and nothing on screen says so.
set -u
PORT="${PORT:-8080}"
RESTART=0
[ "${1:-}" = "--restart" ] || [ "${1:-}" = "-r" ] && RESTART=1

if [ "$RESTART" = "1" ]; then
  pids=$(lsof -ti :"${PORT}" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "stopping the server on ${PORT}…"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    for _ in $(seq 1 10); do
      sleep 1
      lsof -ti :"${PORT}" >/dev/null 2>&1 || break
    done
    # shellcheck disable=SC2046
    kill -9 $(lsof -ti :"${PORT}" 2>/dev/null) 2>/dev/null || true
  fi
elif curl -fsS -o /dev/null --max-time 3 "http://localhost:${PORT}/" 2>/dev/null; then
  echo "dev server already up on ${PORT} (use --restart to pick up a changed .env)"
  exit 0
fi

echo "starting dev server on ${PORT}…"
nohup npm run dev > "$PWD/dev.log" 2>&1 < /dev/null &
disown || true

for _ in $(seq 1 40); do
  sleep 2
  if curl -fsS -o /dev/null --max-time 3 "http://localhost:${PORT}/" 2>/dev/null; then
    echo "dev server up on ${PORT}"
    exit 0
  fi
done

echo "dev server did not come up within 80s — see dev.log w katalogu projektu" >&2
exit 1
