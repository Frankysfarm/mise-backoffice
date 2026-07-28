#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
ESBUILD_BIN=${ESBUILD_BIN:-/Users/eule/.npm/_npx/b3ca12a867cd0704/node_modules/.bin/esbuild}
bundle=$(mktemp "${TMPDIR:-/tmp}/t08-route-append.XXXXXX")
trap 'rm -f "$bundle" "$bundle.mjs"' EXIT
"$ESBUILD_BIN" scripts/tests/t08-route-append-dispatch.test.ts \
  --bundle --platform=node --format=esm --outfile="$bundle.mjs" >/dev/null
node "$bundle.mjs"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/276_minimal_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/274_atomic_single_order_offer.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/282_routing_batching_kitchen_hold.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/282_routing_batching_kitchen_hold.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/282_routing_batching_kitchen_hold.sql
scripts/tests/run-282-route-append-race.sh
echo "T08 routing/batching/kitchen hold persistence: PASS"
