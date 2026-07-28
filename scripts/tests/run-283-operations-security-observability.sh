#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/fixtures/276_minimal_schema.sql >/dev/null
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/fixtures/283_minimal_extensions.sql >/dev/null
for migration in \
  274_atomic_single_order_offer.sql \
  276_atomic_single_writer_v2.sql \
  277_atomic_v2_lifecycle_hardening.sql \
  278_driver_v2_api_boundary.sql \
  282_routing_batching_kitchen_hold.sql \
  283_operations_security_observability.sql
do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "scripts/migrations/$migration" >/dev/null
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/283_operations_security_observability.sql >/dev/null
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/283_operations_security_observability.sql >/dev/null
scripts/tests/run-283-override-race.sh
ESBUILD_BIN=${ESBUILD_BIN:-/Users/eule/.npm/_npx/b3ca12a867cd0704/node_modules/.bin/esbuild}
bundle=$(mktemp "${TMPDIR:-/tmp}/t09-ops.XXXXXX")
trap 'rm -f "$bundle" "$bundle.mjs"' EXIT
"$ESBUILD_BIN" scripts/tests/ops-observability.test.ts \
  --bundle --platform=node --format=esm --outfile="$bundle.mjs" >/dev/null
node "$bundle.mjs"
echo "T09 operations/security/observability: PASS"
