#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set by with-local-remediation-postgres.sh}"

run_id="tl_20260803t173000z_a1b2c3d4"
tenant_id="testlab_http_db"
postgrest_port="54329"
postgrest_upstream_port="54330"
app_port="3210"
container="mise-testlab-postgrest-${run_id}"
jwt_secret="mise-test-lab-only-secret-at-least-thirty-two-characters"
service_key=$(node tests/driver-system-lab/support/local-jwt.mjs "$jwt_secret" service_role)
database_port=$(node -e 'process.stdout.write(new URL(process.argv[1]).port)' "$TEST_DATABASE_URL")

cleanup() {
  if [ -n "${app_pid:-}" ]; then kill "$app_pid" >/dev/null 2>&1 || true; fi
  if [ -n "${proxy_pid:-}" ]; then kill "$proxy_pid" >/dev/null 2>&1 || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/289_storefront_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/289_atomic_storefront_order.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/http_db_storefront_postgrest.sql

docker run --rm -d --name "$container" \
  --add-host host.docker.internal:host-gateway \
  -p "127.0.0.1:${postgrest_upstream_port}:3000" \
  -e "PGRST_DB_URI=postgresql://authenticator:testlab-postgrest@host.docker.internal:${database_port}/mise_remediation" \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e "PGRST_JWT_SECRET=${jwt_secret}" \
  public.ecr.aws/supabase/postgrest:v14.8 >/dev/null

node tests/driver-system-lab/support/postgrest-prefix-proxy.mjs "$postgrest_port" "$postgrest_upstream_port" &
proxy_pid=$!

attempt=0
until curl -fsS "http://127.0.0.1:${postgrest_port}/rest/v1/" >/dev/null; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 30 ] || { docker logs "$container"; exit 1; }
  sleep 1
done

MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL="$TEST_DATABASE_URL" \
MISE_TEST_LAB_TENANT_ID="$tenant_id" \
MISE_TEST_LAB_RUN_ID="$run_id" \
MISE_TEST_LAB_SEED=289 \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${postgrest_port}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$service_key" \
SUPABASE_SERVICE_ROLE_KEY="$service_key" \
./node_modules/.bin/next dev -p "$app_port" >"${TMPDIR:-/tmp}/mise-testlab-next-${run_id}.log" 2>&1 &
app_pid=$!

attempt=0
until curl -fsS "http://127.0.0.1:${app_port}/api/health" >/dev/null 2>&1 || curl -fsS "http://127.0.0.1:${app_port}/" >/dev/null 2>&1; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 60 ] || { cat "${TMPDIR:-/tmp}/mise-testlab-next-${run_id}.log"; exit 1; }
  sleep 1
done

MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL="$TEST_DATABASE_URL" \
MISE_TEST_LAB_TENANT_ID="$tenant_id" \
MISE_TEST_LAB_RUN_ID="$run_id" \
MISE_TEST_LAB_SEED=289 \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
MISE_TEST_LAB_APP_URL="http://127.0.0.1:${app_port}" \
node --import tsx --test tests/driver-system-lab/lifecycle/http-db-storefront.test.ts
