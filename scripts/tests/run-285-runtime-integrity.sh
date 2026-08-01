#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/285_schema_preflight.sql \
  -f scripts/migrations/285_driver_runtime_integrity.sql \
  -f scripts/tests/285_runtime_integrity_behavior.sql
