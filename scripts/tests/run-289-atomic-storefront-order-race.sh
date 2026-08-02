#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
race_dir=$(mktemp -d)
trap 'rm -rf "$race_dir"' EXIT INT TERM
invoke() {
  psql "$TEST_DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT fn_storefront_create_order_v1(
 '93000000-0000-4000-8000-000000000010',repeat('e',64),
 '91000000-0000-4000-8000-000000000001',
 '[{"id":"92000000-0000-4000-8000-000000000001","qty":1}]',
 'Race Kunde','synthetic:race','Laborstraße 10','lieferung','bar');
SQL
}
invoke >"$race_dir/a" & a=$!
invoke >"$race_dir/b" & b=$!
wait "$a"; wait "$b"
test "$(grep -h -o '"idempotent_replay": false' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')" = 1
test "$(grep -h -o '"idempotent_replay": true' "$race_dir/a" "$race_dir/b" | wc -l | tr -d ' ')" = 1
first_id=$(grep -h -o '"id": "[^"]*"' "$race_dir/a" | head -1)
second_id=$(grep -h -o '"id": "[^"]*"' "$race_dir/b" | head -1)
test "$first_id" = "$second_id"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM customer_orders)<>2 THEN RAISE EXCEPTION 'race duplicated order'; END IF;
 IF (SELECT count(*) FROM storefront_order_requests_v1)<>2 THEN RAISE EXCEPTION 'race duplicated request'; END IF;
END $$;
SQL
echo 'T14 atomic storefront two-session idempotency race: PASS'

# The function must hold a share lock on the active location until the order commits.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE FUNCTION slow_storefront_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.5); RETURN new; END $$;
CREATE TRIGGER slow_storefront_insert BEFORE INSERT ON customer_orders FOR EACH ROW EXECUTE FUNCTION slow_storefront_insert();
SQL
psql "$TEST_DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL' >"$race_dir/create-location-lock" & create_pid=$!
SELECT fn_storefront_create_order_v1(
 '93000000-0000-4000-8000-000000000020',repeat('f',64),
 '91000000-0000-4000-8000-000000000001',
 '[{"id":"92000000-0000-4000-8000-000000000001","qty":1}]',
 'Lock Kunde','synthetic:lock','Laborstraße 20','lieferung','bar');
SQL
sleep 0.3
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE locations SET aktiv=false WHERE id='91000000-0000-4000-8000-000000000001'" >"$race_dir/deactivate" & deactivate_pid=$!
sleep 0.3
if ! kill -0 "$deactivate_pid" 2>/dev/null; then
  echo 'location deactivation was not blocked by order transaction' >&2
  exit 1
fi
wait "$create_pid"
wait "$deactivate_pid"
grep -q '"ok": true' "$race_dir/create-location-lock"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP TRIGGER slow_storefront_insert ON customer_orders;
DROP FUNCTION slow_storefront_insert();
DO $$ BEGIN
 IF (SELECT aktiv FROM locations WHERE id='91000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'location was not deactivated'; END IF;
 IF (SELECT count(*) FROM customer_orders)<>3 THEN RAISE EXCEPTION 'location race order count mismatch'; END IF;
END $$;
SQL
echo 'T14 active-location lock versus deactivation race: PASS'
