#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/276_minimal_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/274_atomic_single_order_offer.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/278_item_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/278_driver_v2_api_boundary.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/278_driver_v2_boundary.sql
scripts/tests/run-278-driver-v2-races.sh
