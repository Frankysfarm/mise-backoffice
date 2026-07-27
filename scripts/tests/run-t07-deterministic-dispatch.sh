#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"

ESBUILD_BIN=${ESBUILD_BIN:-/Users/eule/.npm/_npx/b3ca12a867cd0704/node_modules/.bin/esbuild}
bundle=$(mktemp "${TMPDIR:-/tmp}/t07-deterministic.XXXXXX")
wiring_bundle=$(mktemp "${TMPDIR:-/tmp}/t07-frank-wiring.XXXXXX")
cleanup() {
  rm -f "$bundle" "$wiring_bundle"
}
trap cleanup EXIT INT TERM

"$ESBUILD_BIN" scripts/tests/deterministic-dispatch.test.ts \
  --bundle --platform=node --format=cjs --outfile="$bundle"
node "$bundle"
"$ESBUILD_BIN" scripts/tests/frank-deterministic-wiring.test.ts \
  --bundle --platform=node --format=cjs --outfile="$wiring_bundle"
node "$wiring_bundle"

# Re-run the canonical atomic writer's true-overlap suite. T07 is intentionally
# not a second writer; its active result can only enter this already-proven RPC.
scripts/tests/run-276-atomic-single-writer.sh

echo "T07 deterministic baseline + canonical writer races: PASS"
