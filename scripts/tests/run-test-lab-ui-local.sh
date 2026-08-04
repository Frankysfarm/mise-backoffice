#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?must be provided by with-local-remediation-postgres.sh}"

app_port=3212
app_url="http://127.0.0.1:${app_port}"
run_id=tl_20260804t073000z_18b18b18
dist_dir=".next-testlab-ui-$$"
lock_dir=.next-testlab-ui.lock
lock_owned=false
tsconfig_file=".tsconfig-testlab-ui-$$.json"

cleanup() {
  if [ -n "${app_pid:-}" ]; then
    kill "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "${next_log:-}" ]; then rm -f -- "$next_log"; fi
  if [ -n "${identity_file:-}" ]; then rm -f -- "$identity_file"; fi
  rm -f -- "$tsconfig_file"
  case "$dist_dir" in
    .next-testlab-ui-[0-9]*) rm -rf -- "$dist_dir" ;;
    *) echo "refusing unexpected test-lab dist cleanup: $dist_dir" >&2 ;;
  esac
  if [ "$lock_owned" = true ]; then rmdir "$lock_dir" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "another test-lab UI run owns $lock_dir; refusing concurrent execution" >&2
  exit 1
fi
lock_owned=true
next_log=$(mktemp "${TMPDIR:-/tmp}/mise-testlab-ui-next.XXXXXX")
identity_file=$(mktemp "${TMPDIR:-/tmp}/mise-testlab-ui-identity.XXXXXX")
node -e 'const fs=require("fs"); const dist=process.argv[1]; const target=process.argv[2]; fs.writeFileSync(target, JSON.stringify({extends:"./tsconfig.json",include:["next-env.d.ts","**/*.ts","**/*.tsx","components/design/**/*.js","components/design/**/*.jsx",`${dist}/types/**/*.ts`]},null,2)+"\n")' "$dist_dir" "$tsconfig_file"

if lsof -nP -iTCP:"$app_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "test-lab UI port $app_port is already owned; refusing stale-server reuse" >&2
  exit 1
fi

MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL="$TEST_DATABASE_URL" \
MISE_TEST_LAB_TENANT_ID=testlab_ui_local \
MISE_TEST_LAB_RUN_ID="$run_id" \
MISE_TEST_LAB_SEED=18 \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=testlab-anon-key \
SUPABASE_SERVICE_ROLE_KEY=testlab-service-key \
MISE_NEXT_DIST_DIR="$dist_dir" \
MISE_NEXT_TSCONFIG="$tsconfig_file" \
./node_modules/.bin/next dev -p "$app_port" >"$next_log" 2>&1 &
app_pid=$!

attempt=0
until curl -fsS "$app_url/test-lab" >/dev/null 2>&1; do
  kill -0 "$app_pid" 2>/dev/null || { tail -120 "$next_log"; exit 1; }
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { tail -120 "$next_log"; exit 1; }
  sleep 1
done

curl -fsS "$app_url/api/test-lab/scenarios" -o "$identity_file"
node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(body.runId!==process.argv[2]) process.exit(1)' "$identity_file" "$run_id" || {
  echo "spawned test-lab server identity mismatch" >&2
  exit 1
}

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
MISE_TEST_LAB_RUN_ID="$run_id" \
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
