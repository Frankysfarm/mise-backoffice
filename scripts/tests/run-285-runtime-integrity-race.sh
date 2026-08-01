#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/285_runtime_integrity_race_setup.sql >/dev/null
out_a=$(mktemp "${TMPDIR:-/tmp}/t285-a.XXXXXX")
out_b=$(mktemp "${TMPDIR:-/tmp}/t285-b.XXXXXX")
trap 'rm -f "$out_a" "$out_b"' EXIT

insert_alarm() {
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    INSERT INTO mise_push_outbox(driver_id,type,title,body,data)
    VALUES('85000000-0000-0000-0000-000000000071','order_assigned','race','race',
      '{\"batch_id\":\"85000000-0000-0000-0000-000000000072\"}')
    RETURNING id;"
}
insert_alarm >"$out_a" & pid_a=$!
insert_alarm >"$out_b" & pid_b=$!
wait "$pid_a"
wait "$pid_b"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$ BEGIN
 IF (SELECT count(*) FROM mise_push_outbox
   WHERE dedupe_key='batch:85000000-0000-0000-0000-000000000072:initial')<>1 THEN
  RAISE EXCEPTION 'T285_CONCURRENT_PUSH_DEDUPE_FAILED'; END IF;
END \$\$;"

# Two workers race for one wake. SKIP LOCKED plus claim token must expose the
# row to exactly one worker.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
 INSERT INTO mise_push_outbox(driver_id,type,title,body,data,dedupe_key)
 VALUES('85000000-0000-0000-0000-000000000071','recovery_snapshot_required',
 'claim','claim','{}','test:claim-race');" >/dev/null
claim_wake() {
  worker=$1
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    SELECT id FROM fn_claim_wake_notifications('$worker',1);"
}
claim_wake '85000000-0000-0000-0000-000000000075' >"$out_a" & pid_a=$!
claim_wake '85000000-0000-0000-0000-000000000076' >"$out_b" & pid_b=$!
wait "$pid_a"
wait "$pid_b"
claimed_count=$(grep -hEc '^[0-9a-f-]{36}$' "$out_a" "$out_b" | awk '{s+=$1} END {print s+0}')
if [ "$claimed_count" -ne 1 ]; then
  echo "expected exactly one wake claim, got $claimed_count" >&2; exit 1
fi
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$ BEGIN
 IF (SELECT count(*) FROM mise_push_outbox WHERE dedupe_key='test:claim-race'
   AND notification_state='queued' AND claim_token IS NOT NULL)<>1 THEN
  RAISE EXCEPTION 'T285_WAKE_CLAIM_RACE_FAILED'; END IF;
END \$\$;"

# Two concurrent active-tour inserts for one driver: the unique partial index
# must permit exactly one commit and reject the other.
insert_batch() {
  suffix=$1
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    INSERT INTO mise_delivery_batches(id,driver_id,state,state_version,route_version)
    VALUES('85000000-0000-0000-0000-0000000000${suffix}',
      '85000000-0000-0000-0000-000000000071','assigned',1,1);"
}
set +e
insert_batch 73 >"$out_a" 2>&1 & pid_a=$!
insert_batch 74 >"$out_b" 2>&1 & pid_b=$!
wait "$pid_a"; rc_a=$?
wait "$pid_b"; rc_b=$?
set -e
if [ "$rc_a" -eq 0 ] && [ "$rc_b" -eq 0 ]; then
  echo "both active batch inserts unexpectedly succeeded" >&2; exit 1
fi
if [ "$rc_a" -ne 0 ] && [ "$rc_b" -ne 0 ]; then
  echo "both active batch inserts unexpectedly failed" >&2; exit 1
fi
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$ BEGIN
 IF (SELECT count(*) FROM mise_delivery_batches WHERE driver_id=
  '85000000-0000-0000-0000-000000000071' AND state IN
  ('pending_acceptance','assigned','at_pickup','in_progress'))<>1 THEN
  RAISE EXCEPTION 'T285_ACTIVE_BATCH_UNIQUENESS_FAILED'; END IF;
END \$\$;"
echo "285 push dedupe and active-batch two-session races: PASS"
