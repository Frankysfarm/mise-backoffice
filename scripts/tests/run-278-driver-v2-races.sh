#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?}"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/t03-race.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/278_driver_v2_race_seed.sql >/dev/null
call() {
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
    select fn_driver_arrive_v2(
      '31000000-0000-0000-0000-000000000001',
      '46000000-0000-0000-0000-000000000001',0,0,0,0,
      '43000000-0000-0000-0000-000000000001','$1','$2');"
}
call '47000000-0000-4000-8000-000000000001' '48000000-0000-4000-8000-000000000001' >"$tmp_dir/a" &
p1=$!
call '47000000-0000-4000-8000-000000000002' '48000000-0000-4000-8000-000000000002' >"$tmp_dir/b" &
p2=$!
wait "$p1"; wait "$p2"
ok_count=$(grep -h -E -o '"ok"[[:space:]]*:[[:space:]]*true' "$tmp_dir/a" "$tmp_dir/b" | wc -l | tr -d ' ')
conflict_count=$(grep -h -E -o 'EXPECTED_STATE_CONFLICT|EXPECTED_VERSION_CONFLICT' "$tmp_dir/a" "$tmp_dir/b" | wc -l | tr -d ' ')
if [ "$ok_count" != 1 ] || [ "$conflict_count" != 1 ]; then
  sed -n '1,5p' "$tmp_dir/a" >&2
  sed -n '1,5p' "$tmp_dir/b" >&2
  echo "race counts ok=$ok_count conflict=$conflict_count" >&2
  exit 1
fi
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
 DO \$\$ BEGIN
  IF (SELECT count(*) FROM dispatch_offer_audit WHERE order_id='45000000-0000-0000-0000-000000000001'
      AND event_type='stop.arrived')<>1
   OR (SELECT count(*) FROM driver_action_requests_v2 WHERE target_id='46000000-0000-0000-0000-000000000001')<>1
   OR NOT EXISTS(SELECT 1 FROM mise_delivery_batch_stops WHERE id='46000000-0000-0000-0000-000000000001'
      AND state='arrived' AND stop_version=1)
  THEN RAISE EXCEPTION 'race left partial/duplicate projection'; END IF;
 END \$\$;" >/dev/null
echo "T03 two-session stop CAS race: PASS"
