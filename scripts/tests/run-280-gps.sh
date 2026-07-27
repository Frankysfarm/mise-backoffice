#!/bin/sh
set -eu
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/280_gps_monotonic.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select test_gps_race('30000000-0000-4000-8000-000000000020','40000000-0000-4000-8000-000000000020','2026-07-27T07:53:00Z')" >/tmp/mise-gps-race-a.log &
race_a=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select test_gps_race('30000000-0000-4000-8000-000000000021','40000000-0000-4000-8000-000000000021','2026-07-27T07:54:00Z')" >/tmp/mise-gps-race-b.log &
race_b=$!
wait "$race_a"
wait "$race_b"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select captured_at from mise_driver_position_current where driver_id='20000000-0000-4000-8000-000000000001') <> '2026-07-27T07:54:00Z' then raise exception 'race did not preserve newest captured time'; end if; end \$\$;"
npx --no-install esbuild scripts/tests/gps-transport.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/mise-gps-transport-test.cjs
node /tmp/mise-gps-transport-test.cjs
