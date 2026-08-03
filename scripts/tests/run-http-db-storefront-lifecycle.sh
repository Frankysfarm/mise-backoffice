#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set by with-local-remediation-postgres.sh}"

run_id="tl_20260803t173000z_a1b2c3d4"
tenant_id="testlab_http_db"
postgrest_port="54329"
postgrest_upstream_port="54330"
gotrue_upstream_port="54331"
app_port="3210"
container="mise-testlab-postgrest-${run_id}"
auth_container="mise-testlab-gotrue-${run_id}"
jwt_secret="mise-test-lab-only-secret-at-least-thirty-two-characters"
service_key=$(node tests/driver-system-lab/support/local-jwt.mjs "$jwt_secret" service_role)
anon_key=$(node tests/driver-system-lab/support/local-jwt.mjs "$jwt_secret" anon)
authenticated_key=$(node tests/driver-system-lab/support/local-jwt.mjs "$jwt_secret" authenticated)
database_port=$(node -e 'process.stdout.write(new URL(process.argv[1]).port)' "$TEST_DATABASE_URL")

cleanup() {
  cleanup_status=$?
  if [ "$cleanup_status" -ne 0 ]; then
    docker logs "$auth_container" 2>&1 || true
  fi
  if [ -n "${app_pid:-}" ]; then kill "$app_pid" >/dev/null 2>&1 || true; fi
  if [ -n "${proxy_pid:-}" ]; then kill "$proxy_pid" >/dev/null 2>&1 || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker rm -f "$auth_container" >/dev/null 2>&1 || true
  return "$cleanup_status"
}
trap cleanup EXIT INT TERM

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/289_storefront_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/289_atomic_storefront_order.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/http_db_storefront_postgrest.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/290_atomic_kitchen_item_transition.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/274_atomic_single_order_offer.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/278_driver_v2_api_boundary.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/279_pick_pickup_correctness.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/http_db_dispatch_seed.sql
# GoTrue owns and migrates this schema in the disposable laboratory database.
# Supabase production projects already provide it; the local bare PostgreSQL
# lifecycle must create the empty namespace before GoTrue can bootstrap.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres NOLOGIN; END IF; END \$\$"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'testlab-auth'; END IF; END \$\$"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin'
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'ALTER ROLE supabase_auth_admin IN DATABASE mise_remediation SET search_path = auth'

docker run --rm -d --name "$container" \
  --add-host host.docker.internal:host-gateway \
  -p "127.0.0.1:${postgrest_upstream_port}:3000" \
  -e "PGRST_DB_URI=postgresql://authenticator:testlab-postgrest@host.docker.internal:${database_port}/mise_remediation" \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e "PGRST_JWT_SECRET=${jwt_secret}" \
  public.ecr.aws/supabase/postgrest:v14.8 >/dev/null

docker run -d --name "$auth_container" \
  --add-host host.docker.internal:host-gateway \
  -p "127.0.0.1:${gotrue_upstream_port}:9999" \
  -e GOTRUE_API_HOST=0.0.0.0 \
  -e GOTRUE_API_PORT=9999 \
  -e GOTRUE_DB_DRIVER=postgres \
  -e DB_NAMESPACE=auth \
  -e "GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:testlab-auth@host.docker.internal:${database_port}/mise_remediation?sslmode=disable" \
  -e "GOTRUE_SITE_URL=http://127.0.0.1:${app_port}" \
  -e "API_EXTERNAL_URL=http://127.0.0.1:${postgrest_port}/auth/v1" \
  -e "GOTRUE_JWT_SECRET=${jwt_secret}" \
  -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  public.ecr.aws/supabase/gotrue:v2.188.1 >/dev/null

node tests/driver-system-lab/support/postgrest-prefix-proxy.mjs "$postgrest_port" "$postgrest_upstream_port" "$gotrue_upstream_port" &
proxy_pid=$!

attempt=0
until curl -fsS "http://127.0.0.1:${postgrest_port}/rest/v1/" >/dev/null; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 30 ] || { docker logs "$container"; exit 1; }
  sleep 1
done
attempt=0
until curl -fsS "http://127.0.0.1:${postgrest_port}/auth/v1/health" >/dev/null; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 60 ] || { docker logs "$auth_container"; exit 1; }
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
MISE_TEST_LAB_POSTGREST_URL="http://127.0.0.1:${postgrest_port}" \
MISE_TEST_LAB_LOCAL_SERVICE_KEY="$service_key" \
MISE_TEST_LAB_LOCAL_ANON_KEY="$anon_key" \
MISE_TEST_LAB_LOCAL_AUTHENTICATED_KEY="$authenticated_key" \
MISE_TEST_LAB_POSTGREST_CONTAINER="$container" \
MISE_TEST_LAB_NEXT_PID="$app_pid" \
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${postgrest_port}" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$service_key" \
SUPABASE_SERVICE_ROLE_KEY="$service_key" \
node --import tsx --test tests/driver-system-lab/lifecycle/http-db-storefront.test.ts
