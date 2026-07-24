#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to an isolated PostgreSQL database}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/274_atomic_single_order_offer_concurrency_setup.sql

same_a=$(mktemp /tmp/atomic-offer-same-a.XXXXXX)
same_b=$(mktemp /tmp/atomic-offer-same-b.XXXXXX)
diff_a=$(mktemp /tmp/atomic-offer-diff-a.XXXXXX)
diff_b=$(mktemp /tmp/atomic-offer-diff-b.XXXXXX)
switch_out=$(mktemp /tmp/atomic-offer-switch.XXXXXX)
trigger_out=$(mktemp /tmp/atomic-offer-trigger.XXXXXX)
cleanup() {
  rm -f "$same_a" "$same_b" "$diff_a" "$diff_b" "$switch_out" "$trigger_out"
}
trap cleanup EXIT

offer_sql() {
  order_id=$1
  driver_id=$2
  decision_id=$3
  key_id=$4
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
    SELECT fn_dispatch_create_offer_v1(
      '11000000-0000-0000-0000-000000000001',
      '$order_id', '$driver_id', 0, '$decision_id', '$key_id',
      'concurrency-test-v1', 20,
      52.0, 13.0, 'pickup', 52.01, 13.01, 'dropoff',
      'offer', 'body'
    );"
}

offer_sql \
  30000000-0000-0000-0000-000000000001 \
  20000000-0000-0000-0000-000000000001 \
  40000000-0000-0000-0000-000000000001 \
  50000000-0000-0000-0000-000000000001 >"$same_a" &
pid_a=$!
offer_sql \
  30000000-0000-0000-0000-000000000001 \
  20000000-0000-0000-0000-000000000001 \
  40000000-0000-0000-0000-000000000001 \
  50000000-0000-0000-0000-000000000001 >"$same_b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

if ! grep -Eq '"idempotent_replay"[[:space:]]*:[[:space:]]*true' "$same_a" "$same_b"; then
  echo "same-key race did not produce an idempotent replay" >&2
  exit 1
fi

offer_sql \
  30000000-0000-0000-0000-000000000002 \
  20000000-0000-0000-0000-000000000002 \
  40000000-0000-0000-0000-000000000002 \
  50000000-0000-0000-0000-000000000002 >"$diff_a" &
pid_a=$!
offer_sql \
  30000000-0000-0000-0000-000000000002 \
  20000000-0000-0000-0000-000000000003 \
  40000000-0000-0000-0000-000000000003 \
  50000000-0000-0000-0000-000000000003 >"$diff_b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

if ! grep -Eq 'ORDER_VERSION_CONFLICT|ORDER_ALREADY_ASSIGNED' "$diff_a" "$diff_b"; then
  echo "different-key race did not produce a guarded loser" >&2
  exit 1
fi

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/274_atomic_single_order_offer_concurrency_assert.sql

# Deterministic switch-vs-trigger boundary:
# the switch owns the tenant lock while uncommitted; the ready-trigger must wait,
# then re-read atomic_v1 and suppress both legacy DB dispatchers.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
  BEGIN;
  SELECT fn_dispatch_set_writer_v1(
    '11000000-0000-0000-0000-000000000002', 'atomic_v1', true
  );
  SELECT pg_sleep(1);
  COMMIT;" >"$switch_out" &
switch_pid=$!
sleep 0.2
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
  UPDATE customer_orders
  SET status = 'fertig'
  WHERE id = '30000000-0000-0000-0000-000000000003';" >"$trigger_out" &
trigger_pid=$!
wait "$switch_pid"
wait "$trigger_pid"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/274_dispatch_writer_boundary_assert.sql
