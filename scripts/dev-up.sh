#!/usr/bin/env bash
# Make sure a dev server is running on 8080, and leave it running.
#
# Playwright's webServer starts its own server when none is up and kills it
# when the run ends — which repeatedly took down the server somebody was using
# in a browser. With this run first, Playwright always finds an existing server
# and reuses it instead, so an e2e run never costs anyone their localhost.
set -u
PORT="${PORT:-8080}"

if curl -fsS -o /dev/null --max-time 3 "http://localhost:${PORT}/" 2>/dev/null; then
  echo "dev server already up on ${PORT}"
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
