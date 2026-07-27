#!/bin/sh
set -u

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to disposable PostgreSQL}"
: "${T07_RACE_ARTIFACT:?set T07_RACE_ARTIFACT}"

set +e
scripts/tests/run-276-atomic-single-writer.sh >"${T07_RACE_ARTIFACT}.log" 2>&1
status=$?
set -e

if [ "$status" -ne 0 ]; then
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt \
    -c "SELECT action_id,request_fingerprint,result
        FROM dispatch_assignment_requests_v2
        ORDER BY created_at DESC NULLS LAST,action_id
        LIMIT 20" >"${T07_RACE_ARTIFACT}.requests.txt" 2>&1 || true
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt \
    -c "SELECT order_id,driver_id,state,action_id
        FROM dispatch_offer_assignments
        WHERE state NOT IN ('completed','cancelled','expired')
        ORDER BY order_id,driver_id" >"${T07_RACE_ARTIFACT}.assignments.txt" 2>&1 || true
fi
exit "$status"
