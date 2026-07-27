#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/fixtures/281_recovery_schema.sql \
  -f scripts/migrations/281_recovery_push_offline.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "GRANT ALL ON driver_notification_ack_requests,dispatch_recovery_escalations,batch_recovery_escalations,mise_push_outbox TO anon,authenticated"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/281_recovery_push_offline.sql \
  -f scripts/tests/281_recovery_push_offline.sql
