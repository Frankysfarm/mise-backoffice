#!/bin/sh
set -eu
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/280_gps_monotonic.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select test_gps_race('30000000-0000-4000-8000-000000000020','40000000-0000-4000-8000-000000000020',(select base+interval '3 minutes' from t06_gps_test_clock))" >/tmp/mise-gps-race-a.log &
race_a=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select test_gps_race('30000000-0000-4000-8000-000000000021','40000000-0000-4000-8000-000000000021',(select base+interval '4 minutes' from t06_gps_test_clock))" >/tmp/mise-gps-race-b.log &
race_b=$!
wait "$race_a"
wait "$race_b"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select captured_at from mise_driver_position_current where driver_id='20000000-0000-4000-8000-000000000001') <> (select base+interval '4 minutes' from t06_gps_test_clock) then raise exception 'race did not preserve newest captured time'; end if; end \$\$;"
ESBUILD_BIN=${ESBUILD_BIN:-/Users/eule/.npm/_npx/b3ca12a867cd0704/node_modules/.bin/esbuild}
"$ESBUILD_BIN" scripts/tests/gps-transport.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/mise-gps-transport-test.cjs
node /tmp/mise-gps-transport-test.cjs
