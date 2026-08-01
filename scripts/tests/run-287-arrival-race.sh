#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE mise_delivery_batch_stops SET state='pending',stop_version=0,arrived_at=NULL
 WHERE id='77000000-0000-0000-0000-000000000005';
DELETE FROM driver_action_requests_v2 WHERE action_id IN
 ('7a000000-0000-4000-8000-000000000021','7a000000-0000-4000-8000-000000000022');
SQL
race_dir=$(mktemp -d)
arrive() {
  action=$1
  psql "$TEST_DATABASE_URL" -At -v ON_ERROR_STOP=1 -v action="$action" <<'SQL'
SELECT fn_driver_arrive_v2('71000000-0000-0000-0000-000000000001',
 '77000000-0000-0000-0000-000000000005',0,4,5,3,
 '73000000-0000-0000-0000-000000000002',:'action',gen_random_uuid());
SQL
}
arrive '7a000000-0000-4000-8000-000000000021' >"$race_dir/a" & a=$!
arrive '7a000000-0000-4000-8000-000000000022' >"$race_dir/b" & b=$!
wait "$a"; wait "$b"
ok=$(grep -h -o '"ok": true' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')
conflict=$(grep -h -o 'EXPECTED_VERSION_CONFLICT\|STOP_NOT_NEXT_IN_ROUTE' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')
test "$ok" = 1
test "$conflict" = 1
echo 'T12 two-session arrival race: PASS'
