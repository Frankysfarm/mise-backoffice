#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
out_a=$(mktemp "${TMPDIR:-/tmp}/t09-override-a.XXXXXX")
out_b=$(mktemp "${TMPDIR:-/tmp}/t09-override-b.XXXXXX")
trap 'rm -f "$out_a" "$out_b"' EXIT
override() {
  action_id=$1
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
    SELECT fn_ops_manual_override_v2(
      '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
      '84000000-0000-0000-0000-000000000041','dispatcher','DRIVER_ACCIDENT','driver',
      '84000000-0000-0000-0000-000000000021',0,'DRIVER_ACCIDENT',
      'Driver reported an accident and cannot continue.',
      '$action_id','84000000-0000-0000-0000-000000000091');"
}
override '84000000-0000-0000-0000-000000000071' >"$out_a" &
pid_a=$!
override '84000000-0000-0000-0000-000000000072' >"$out_b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
python3 - "$out_a" "$out_b" <<'PY'
import json
import pathlib
import sys
rows = [json.loads(pathlib.Path(path).read_text().strip()) for path in sys.argv[1:]]
assert sum(row.get("ok") is True for row in rows) == 1, rows
assert sum(row.get("reason_code") == "DRIVER_VERSION_OR_SCOPE_CONFLICT" for row in rows) == 1, rows
PY
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAtc "
DO \$\$
BEGIN
 IF (SELECT state_version FROM mise_drivers WHERE id=
   '84000000-0000-0000-0000-000000000021')<>1
 OR (SELECT count(*) FROM driver_exceptions_v2 WHERE driver_id=
   '84000000-0000-0000-0000-000000000021')<>1
 OR (SELECT count(*) FROM ops_manual_override_requests_v2 WHERE target_id=
   '84000000-0000-0000-0000-000000000021')<>1 THEN
  RAISE EXCEPTION 'T09_OVERRIDE_RACE_PROJECTION_INVALID';
 END IF;
END \$\$;"
echo "T09 manual override CAS race: PASS"
