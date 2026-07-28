#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/fixtures/276_minimal_schema.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/274_atomic_single_order_offer.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/276_atomic_single_writer_v2.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/277_atomic_v2_lifecycle_hardening.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/282_routing_batching_kitchen_hold.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/282_routing_batching_kitchen_hold.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tests/282_routing_batching_kitchen_hold.sql
echo "T08 routing/batching/kitchen hold persistence: PASS"
