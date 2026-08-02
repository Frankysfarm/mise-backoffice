#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/289_storefront_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/289_atomic_storefront_order.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/289_atomic_storefront_order.sql
sh scripts/tests/run-289-atomic-storefront-order-race.sh
