#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM driver_batch_pickups_v2 WHERE action_id='4a000000-0000-4000-8000-000000000004';
DELETE FROM driver_action_requests_v2 WHERE action_id='4a000000-0000-4000-8000-000000000004';
UPDATE customer_orders SET status='assigned',dispatch_version=1 WHERE id='46000000-0000-0000-0000-000000000004';
UPDATE dispatch_offer_assignments SET state='assigned',assignment_version=1 WHERE order_id='46000000-0000-0000-0000-000000000004';
UPDATE mise_delivery_batch_stops SET state='arrived',stop_version=1,completed_at=NULL WHERE id='47000000-0000-0000-0000-000000000004';
UPDATE mise_delivery_batches SET state='at_pickup',state_version=2,picked_up_at=NULL WHERE id='45000000-0000-0000-0000-000000000002';
UPDATE mise_drivers SET state='at_pickup',state_version=2 WHERE id='43000000-0000-0000-0000-000000000002';
SQL
race_dir=$(mktemp -d)
run_device() {
  action_id=$1
  psql "$TEST_DATABASE_URL" -At -v ON_ERROR_STOP=1 -v action_id="$action_id" <<'SQL'
SELECT fn_driver_pickup_batch_v2(
 '41000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000002',2,3,2,
 '43000000-0000-0000-0000-000000000002',:'action_id',
 jsonb_build_array(jsonb_build_object(
  'order_id','46000000-0000-0000-0000-000000000004','order_version',1,
  'assignment_id',(SELECT id FROM dispatch_offer_assignments WHERE order_id='46000000-0000-0000-0000-000000000004'),
  'assignment_version',1,'stop_id','47000000-0000-0000-0000-000000000004',
  'stop_version',1,'items','[]'::jsonb)),
 gen_random_uuid());
SQL
}
run_device '4a000000-0000-4000-8000-000000000011' >"$race_dir/a" &
pid_a=$!
run_device '4a000000-0000-4000-8000-000000000012' >"$race_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
ok_count=$(grep -h -o '"ok": true' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')
conflict_count=$(grep -h -o 'EXPECTED_VERSION_CONFLICT' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')
test "$ok_count" = 1
test "$conflict_count" = 1
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF (SELECT count(*) FROM driver_batch_pickups_v2 WHERE batch_id='45000000-0000-0000-0000-000000000002')<>1
   OR (SELECT state FROM mise_delivery_batches WHERE id='45000000-0000-0000-0000-000000000002')<>'in_progress'
 THEN RAISE EXCEPTION 'two-device race did not produce exactly one atomic winner'; END IF;
END $$;
SQL
echo 'T04 two-device PostgreSQL race: PASS'
