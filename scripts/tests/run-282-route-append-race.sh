#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/282_route_append_race_setup.sql >/dev/null
out_a=$(mktemp "${TMPDIR:-/tmp}/t08-a.XXXXXX")
out_b=$(mktemp "${TMPDIR:-/tmp}/t08-b.XXXXXX")
trap 'rm -f "$out_a" "$out_b"' EXIT

append() {
  suffix=$1
  order=$2
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    SET t08.race_barrier='append';
    SELECT fn_append_order_to_route_v2(
      '83000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000040',1,
      '83000000-0000-0000-0000-000000000020',0,
      '83000000-0000-0000-0000-000000000030',1,'$order',0,
      '83000000-0000-0000-0000-0000000000${suffix}1',
      '83000000-0000-0000-0000-0000000000${suffix}2',
      50,6,50.02,6.02,'store','new','2099-01-01T10:10:00Z','2099-01-01T10:45:00Z',
      '[{\"id\":\"83000000-0000-0000-0000-000000000031\",\"kind\":\"pickup\"},
        {\"id\":\"83000000-0000-0000-0000-0000000000${suffix}1\",\"kind\":\"pickup\"},
        {\"id\":\"83000000-0000-0000-0000-000000000032\",\"kind\":\"dropoff\"},
        {\"id\":\"83000000-0000-0000-0000-0000000000${suffix}2\",\"kind\":\"dropoff\"}]',
      '{}','{\"reason_code\":\"RACE\"}',false,
      '83000000-0000-0000-0000-0000000000${suffix}3',
      '83000000-0000-0000-0000-0000000000${suffix}4');"
}
psql "$TEST_DATABASE_URL" -qAtc \
  "INSERT INTO t08_race_barriers VALUES('append',false);" >/dev/null
append 5 '83000000-0000-0000-0000-000000000012' >"$out_a" &
pid_a=$!
append 6 '83000000-0000-0000-0000-000000000013' >"$out_b" &
pid_b=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$
DECLARE i integer;
BEGIN
 FOR i IN 1..1000 LOOP
  IF (SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND mode='ShareLock'
    AND granted AND classid=28290::oid AND objsubid=2)=2 THEN
   UPDATE t08_race_barriers SET released=true WHERE name='append'; RETURN;
  END IF;
  PERFORM pg_sleep(.01);
 END LOOP;
 RAISE EXCEPTION 'T08_BOTH_WORKERS_DID_NOT_ARRIVE';
END \$\$;" >/dev/null
wait "$pid_a"
wait "$pid_b"
python3 - "$out_a" "$out_b" <<'PY'
import json
import pathlib
import sys

rows = [json.loads(pathlib.Path(path).read_text().strip().splitlines()[-1])
        for path in sys.argv[1:]]
winners = [row for row in rows if row.get("ok") is True]
losers = [row for row in rows if row.get("ok") is False]
if len(winners) != 1 or len(losers) != 1:
    raise SystemExit(f"expected one winner and one loser: {rows}")
if losers[0].get("reason_code") not in {
    "DRIVER_VERSION_OR_CAPACITY_CONFLICT", "BATCH_ROUTE_VERSION_CONFLICT"
}:
    raise SystemExit(f"loser was not an explicit CAS/version conflict: {losers[0]}")
PY
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$
BEGIN
 IF (SELECT count(*) FROM customer_orders WHERE id IN(
   '83000000-0000-0000-0000-000000000012','83000000-0000-0000-0000-000000000013')
   AND mise_batch_id IS NOT NULL)<>1
 OR (SELECT route_version FROM mise_delivery_batches WHERE id=
   '83000000-0000-0000-0000-000000000030')<>2
 OR (SELECT current_capacity FROM mise_drivers WHERE id=
   '83000000-0000-0000-0000-000000000020')<>2
 OR (SELECT count(*) FROM mise_push_outbox WHERE driver_id=
   '83000000-0000-0000-0000-000000000020')<>1 THEN
  RAISE EXCEPTION 'T08_RACE_PROJECTION_INVALID';
 END IF;
 IF (SELECT count(*) FROM mise_delivery_batch_stops WHERE order_id IN(
   '83000000-0000-0000-0000-000000000012','83000000-0000-0000-0000-000000000013'))<>2
 OR (SELECT count(*) FROM dispatch_offer_assignments WHERE order_id IN(
   '83000000-0000-0000-0000-000000000012','83000000-0000-0000-0000-000000000013'))<>1
 OR (SELECT count(*) FROM dispatch_offer_audit WHERE reason_code='ATOMIC_V2_ROUTE_APPEND'
   AND order_id IN('83000000-0000-0000-0000-000000000012',
   '83000000-0000-0000-0000-000000000013'))<>1
 OR (SELECT count(*) FROM dispatch_assignment_requests_v2 WHERE action='route_append'
   AND tenant_id='83000000-0000-0000-0000-000000000001')<>1
 OR (SELECT count(*) FROM dispatch_route_plans_v2 WHERE
   assignment_id='83000000-0000-0000-0000-000000000030' AND route_version=2)<>1 THEN
  RAISE EXCEPTION 'T08_RACE_ATOMIC_PROJECTIONS_INVALID';
 END IF;
 IF EXISTS(SELECT 1 FROM customer_orders o
   WHERE o.id IN('83000000-0000-0000-0000-000000000012',
                 '83000000-0000-0000-0000-000000000013')
   AND o.mise_batch_id IS NULL
   AND EXISTS(SELECT 1 FROM mise_delivery_batch_stops s WHERE s.order_id=o.id)) THEN
  RAISE EXCEPTION 'T08_RACE_LOSER_LEFT_PARTIAL_STOPS';
 END IF;
END \$\$;"
echo "T08 atomic route append true-overlap race: PASS"
