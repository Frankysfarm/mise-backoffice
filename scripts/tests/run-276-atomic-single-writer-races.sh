#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_race_setup.sql

cases_file=$(mktemp "${TMPDIR:-/tmp}/t02-races.XXXXXX")
out_a=$(mktemp "${TMPDIR:-/tmp}/t02-race-a.XXXXXX")
out_b=$(mktemp "${TMPDIR:-/tmp}/t02-race-b.XXXXXX")
cleanup() {
  rm -f "$cases_file" "$out_a" "$out_b"
}
trap cleanup EXIT

prepare_barrier() {
  barrier_name=$1
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    INSERT INTO t02_race_barriers(barrier_name,released)
    VALUES ('$barrier_name',false)
    ON CONFLICT(barrier_name) DO UPDATE SET released=false;" >/dev/null
}

release_barrier_when_two_arrive() {
  barrier_name=$1
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    DO \$barrier\$
    DECLARE
      v_attempt integer;
    BEGIN
      FOR v_attempt IN 1..1000 LOOP
        IF (
          SELECT count(*)
          FROM pg_locks
          WHERE locktype='advisory'
            AND mode='ShareLock'
            AND granted
            AND classid=27690::oid
            AND objid=(
              (hashtext('$barrier_name')::bigint + 4294967296)
              % 4294967296
            )::oid
            AND objsubid=2
        )=2 THEN
          UPDATE t02_race_barriers SET released=true
          WHERE barrier_name='$barrier_name';
          RETURN;
        END IF;
        PERFORM pg_sleep(0.01);
      END LOOP;
      RAISE EXCEPTION 'T02_BOTH_SESSIONS_DID_NOT_ARRIVE:%',
        '$barrier_name';
    END
    \$barrier\$;" >/dev/null
}

validate_pair() {
  python3 scripts/tests/parse-276-race-json.py "$1" "$out_a" "$out_b"
}

# Fixture-only shared session locks prove both calls entered the RPC before the
# coordinator releases them. The release transaction then ends before either
# RPC reaches its production advisory locks.
barrier_name=writer-election
prepare_barrier "$barrier_name"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
  SET t02.race_barrier='$barrier_name';
  SELECT fn_dispatch_claim_writer_v2(
    '11000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000011',120
  );" >"$out_a" &
pid_a=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
  SET t02.race_barrier='$barrier_name';
  SELECT fn_dispatch_claim_writer_v2(
    '11000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000012',120
  );" >"$out_b" &
pid_b=$!
release_barrier_when_two_arrive "$barrier_name"
wait "$pid_a"
wait "$pid_b"
validate_pair writer

psql "$TEST_DATABASE_URL" -qAtF '|' -c "
  SELECT iteration,order_id,driver_a,driver_b,action_a,action_b
  FROM t02_race_cases WHERE iteration BETWEEN 1 AND 100
  ORDER BY iteration
" >"$cases_file"

assign() {
  order_id=$1
  driver_id=$2
  action_id=$3
  title=$4
  barrier_name=$5
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    SET t02.race_barrier='$barrier_name';
    SELECT fn_dispatch_assign_orders_v2(
      '11000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000001',1,
      '$driver_id',0,'$action_id','race-test',
      jsonb_build_array(jsonb_build_object(
        'order_id','$order_id','expected_order_version',0,
        'pickup_lat',52.0,'pickup_lng',13.0,'pickup_address','pickup',
        'dropoff_lat',52.1,'dropoff_lng',13.1,'dropoff_address','dropoff',
        'pickup_deadline_at','2030-01-01T12:20:00Z',
        'delivery_deadline_at','2030-01-01T12:45:00Z'
      )),'$title','race'
    );"
}

run_assignment_pair() {
  barrier_name=$1
  order_id=$2
  driver_a=$3
  driver_b=$4
  action_a=$5
  action_b=$6
  title_a=$7
  title_b=$8
  prepare_barrier "$barrier_name"
  assign "$order_id" "$driver_a" "$action_a" "$title_a" \
    "$barrier_name" >"$out_a" &
  pid_a=$!
  assign "$order_id" "$driver_b" "$action_b" "$title_b" \
    "$barrier_name" >"$out_b" &
  pid_b=$!
  release_barrier_when_two_arrive "$barrier_name"
  wait "$pid_a"
  wait "$pid_b"
}

while IFS='|' read -r iteration order_id driver_a driver_b action_a action_b; do
  run_assignment_pair "assignment-$iteration" "$order_id" \
    "$driver_a" "$driver_b" "$action_a" "$action_b" \
    "race-$iteration-a" "race-$iteration-b"
  validate_pair assignment
done <"$cases_file"

# Same action and same fingerprint: one write plus byte-for-byte canonical
# replay after excluding only the explicit replay marker.
same=$(psql "$TEST_DATABASE_URL" -qAtF '|' -c "
  SELECT order_id,driver_a,action_a FROM t02_race_cases WHERE iteration=101
")
IFS='|' read -r same_order same_driver same_action <<EOF
$same
EOF
run_assignment_pair same-key "$same_order" "$same_driver" "$same_driver" \
  "$same_action" "$same_action" same-key same-key
validate_pair same-key

# Same action but a different fingerprint: exactly one success and one exact
# idempotency-key conflict.
conflict=$(psql "$TEST_DATABASE_URL" -qAtF '|' -c "
  SELECT order_id,driver_a,driver_b,action_a
  FROM t02_race_cases WHERE iteration=102
")
IFS='|' read -r conflict_order conflict_a conflict_b conflict_action <<EOF
$conflict
EOF
run_assignment_pair fingerprint "$conflict_order" "$conflict_a" "$conflict_b" \
  "$conflict_action" "$conflict_action" fingerprint-a fingerprint-b
validate_pair fingerprint

# Cancellation and assignment both enter their RPC before either reaches the
# tenant serialization lock.
cancel_case=$(psql "$TEST_DATABASE_URL" -qAtF '|' -c "
  SELECT order_id,driver_a,action_a,action_b
  FROM t02_race_cases WHERE iteration=103
")
IFS='|' read -r cancel_order cancel_driver assign_action cancel_action <<EOF
$cancel_case
EOF
barrier_name=cancel-assignment
prepare_barrier "$barrier_name"
assign "$cancel_order" "$cancel_driver" "$assign_action" cancel-race \
  "$barrier_name" >"$out_a" &
pid_a=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
  SET t02.race_barrier='$barrier_name';
  SELECT fn_dispatch_cancel_order_v2(
    '11000000-0000-0000-0000-000000000001',
    '$cancel_order',1,1,1,1,
    '15000000-0000-0000-0000-000000000001',1,
    '$cancel_action','CUSTOMER_CANCELLED'
  );" >"$out_b" &
pid_b=$!
release_barrier_when_two_arrive "$barrier_name"
wait "$pid_a"
wait "$pid_b"
validate_pair cancel-assign

# Completion and post-pickup reassignment also rendezvous inside the RPCs.
# Custody may only finish; it may never be inferred as transferred.
delivery_case=$(psql "$TEST_DATABASE_URL" -qAtF '|' -c "
  SELECT order_id,driver_b,action_b
  FROM t02_race_cases WHERE iteration=104
")
IFS='|' read -r delivery_order replacement_driver delivery_action <<EOF
$delivery_case
EOF
barrier_name=delivery-reassignment
prepare_barrier "$barrier_name"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
  SET t02.race_barrier='$barrier_name';
  SELECT fn_dispatch_complete_delivery_v2(
    '11000000-0000-0000-0000-000000000001',
    '$delivery_order',3,3,3,3,
    (SELECT driver_a FROM t02_race_cases WHERE iteration=104),
    '$delivery_action'
  );" >"$out_a" &
pid_a=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
  SET t02.race_barrier='$barrier_name';
  SELECT fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',
    '$delivery_order',3,3,3,3,'$replacement_driver',0,
    '15000000-0000-0000-0000-000000000001',1,
    '16000000-0000-0000-0000-000000000104',gen_random_uuid(),
    'SAFETY_EXCEPTION','post-pickup race'
  );" >"$out_b" &
pid_b=$!
release_barrier_when_two_arrive "$barrier_name"
wait "$pid_a"
wait "$pid_b"
validate_pair delivery-reassign

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_race_assert.sql

echo "T02 Atomic-v2 100x true-overlap and lifecycle races: PASS"
