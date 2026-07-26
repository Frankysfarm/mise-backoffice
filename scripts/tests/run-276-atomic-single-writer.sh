#!/bin/sh
set -eu

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/fixtures/276_minimal_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/274_atomic_single_order_offer.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_pre_migration_seed.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_migration_dry_run.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
# Migration idempotency proof: applying the complete T02 pair twice is safe.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_contract.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/preflight/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_behavior.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_faults.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/277_atomic_v2_lifecycle_faults.sql
scripts/tests/run-276-atomic-single-writer-races.sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/tests/276_atomic_single_writer_disable.sql

echo "T02 Atomic-v2 contract/behavior/fault/backfill/disable tests: PASS"
