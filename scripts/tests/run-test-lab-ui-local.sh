#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?must be provided by with-local-remediation-postgres.sh}"

app_port=3212
app_url="http://127.0.0.1:${app_port}"
next_log="${TMPDIR:-/tmp}/mise-testlab-ui-next.log"

cleanup() {
  if [ -n "${app_pid:-}" ]; then
    kill "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

# Interrupted dev servers can leave an incomplete webpack pack. It is purely
# generated state and must never influence a release-readiness result.
rm -rf .next/cache/webpack

MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL="$TEST_DATABASE_URL" \
MISE_TEST_LAB_TENANT_ID=testlab_ui_local \
MISE_TEST_LAB_RUN_ID=tl_20260804t073000z_18b18b18 \
MISE_TEST_LAB_SEED=18 \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=testlab-anon-key \
SUPABASE_SERVICE_ROLE_KEY=testlab-service-key \
./node_modules/.bin/next dev -p "$app_port" >"$next_log" 2>&1 &
app_pid=$!

attempt=0
until curl -fsS "$app_url/test-lab" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { tail -120 "$next_log"; exit 1; }
  sleep 1
done

# Compile every heavy actor route before Chromium starts. The UI suite is a
# runtime/interaction gate, not a benchmark of Next's cold development
# compiler; cold compilation inside page.goto otherwise consumes its timeout.
for warm_path in \
  /api/test-lab/scenarios \
  /test-lab/actors/dispatcher \
  /test-lab/actors/driver \
  /test-lab/actors/kitchen \
  /test-lab/actors/storefront
do
  curl -fsS "$app_url$warm_path" >/dev/null
done

MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL="$TEST_DATABASE_URL" \
MISE_TEST_LAB_TENANT_ID=testlab_ui_local \
MISE_TEST_LAB_RUN_ID=tl_20260804t073000z_18b18b18 \
MISE_TEST_LAB_SEED=18 \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
MISE_TEST_LAB_APP_URL="$app_url" \
MISE_TEST_LAB_ARTIFACT_ROOT=artifacts/driver-system-lab/browser-actors/full-local \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=testlab-anon-key \
SUPABASE_SERVICE_ROLE_KEY=testlab-service-key \
npm run test:lab:ui
