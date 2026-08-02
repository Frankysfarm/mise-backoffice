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
