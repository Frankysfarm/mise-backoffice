#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
payload='{}'
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO dispatch_append_proposals_v2(id,tenant_id,driver_id,batch_id,order_id,state,
 expected_driver_version,expected_batch_version,expected_route_version,expected_order_version,
 append_payload,expires_at,proposed_action_id,correlation_id) VALUES
 ('89000000-0000-0000-0000-000000000011','81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000002','proposed_append',8,6,9,4,'{}',
  clock_timestamp()+interval '2 minutes','8a000000-0000-4000-8000-000000000011','8b000000-0000-4000-8000-000000000011'),
 ('89000000-0000-0000-0000-000000000012','81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000001','proposed_append',8,6,9,4,'{}',
  clock_timestamp()-interval '1 second','8a000000-0000-4000-8000-000000000012','8b000000-0000-4000-8000-000000000012');
SQL
race_dir=$(mktemp -d)
transition() {
 proposal=$1 action=$2 key=$3
 psql "$TEST_DATABASE_URL" -At -v ON_ERROR_STOP=1 -v proposal="$proposal" -v action="$action" -v key="$key" <<'SQL'
SELECT fn_transition_append_proposal_v2(:'proposal',1,:'action',
 '83000000-0000-0000-0000-000000000001',:'key');
SQL
}
transition '89000000-0000-0000-0000-000000000011' accept '8a000000-0000-4000-8000-000000000021' >"$race_dir/aa" & a=$!
transition '89000000-0000-0000-0000-000000000011' accept '8a000000-0000-4000-8000-000000000022' >"$race_dir/ab" & b=$!
wait "$a"; wait "$b"
grep -h . "$race_dir/aa" "$race_dir/ab"
test "$(grep -h -o '"ok": true' "$race_dir/aa" "$race_dir/ab" | wc -l | tr -d ' ')" = 1
test "$(grep -h -o 'PROPOSAL_VERSION_OR_STATE_CONFLICT' "$race_dir/aa" "$race_dir/ab" | wc -l | tr -d ' ')" = 1
transition '89000000-0000-0000-0000-000000000012' accept '8a000000-0000-4000-8000-000000000023' >"$race_dir/ea" & a=$!
transition '89000000-0000-0000-0000-000000000012' expire '8a000000-0000-4000-8000-000000000024' >"$race_dir/ee" & b=$!
wait "$a"; wait "$b"
grep -h . "$race_dir/ea" "$race_dir/ee"
test "$(grep -h -o '"proposal_version": 2' "$race_dir/ea" "$race_dir/ee" | wc -l | tr -d ' ')" = 2
test "$(grep -h -o 'PROPOSAL_VERSION_OR_STATE_CONFLICT' "$race_dir/ea" "$race_dir/ee" | wc -l | tr -d ' ')" = 1
echo 'T13 accept/accept and accept/expiry races: PASS'
