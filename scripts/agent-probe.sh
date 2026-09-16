#!/usr/bin/env bash
# Puts words in a traveller's mouth and prints what Adair says back.
#
# Not a unit test — the model is not deterministic and pinning its wording would
# be pinning the wrong thing. This is for reading: five conversations that have
# gone wrong before, run against the live prompt, with canned tool results so
# the answers depend on the prompt rather than on what Paris is doing today.
#
# Run it after any change to src/lib/agent/system-prompt.ts, and read the
# replies. What to look for: does it offer something real once the trip is
# settled, does it admit what it cannot book, does it ask one question rather
# than two, does it lead with a place someone wrote up, and does every distance
# in the reply come from a tool.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
rm -rf .agent-probe-build
node node_modules/typescript/bin/tsc src/lib/agent/system-prompt.ts \
  --outDir .agent-probe-build --module esnext --target es2022 --moduleResolution bundler >/dev/null
mv .agent-probe-build/system-prompt.js .agent-probe-build/system-prompt.mjs
node scripts/agent-probe.mjs
rm -rf .agent-probe-build
