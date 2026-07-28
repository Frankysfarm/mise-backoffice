#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$repo"

run_db_suite() {
  name=$1
  runner=$2
  echo "T10 suite start: $name"
  scripts/tests/with-local-remediation-postgres.sh "$runner"
  echo "T10 suite pass: $name"
}

run_db_suite atomic-writer scripts/tests/run-276-atomic-single-writer.sh
run_db_suite driver-api scripts/tests/run-278-driver-v2-boundary.sh
run_db_suite pick-pickup scripts/tests/run-279-pick-pickup-correctness.sh
run_db_suite recovery-push-offline scripts/tests/run-281-recovery-push-offline.sh
run_db_suite gps scripts/tests/run-280-gps.sh
run_db_suite deterministic-dispatch scripts/tests/run-t07-deterministic-dispatch.sh
run_db_suite routing-hold scripts/tests/run-282-routing-batching-kitchen-hold.sh
run_db_suite operations-security scripts/tests/run-283-operations-security-observability.sh

echo "T10 isolated local release-readiness suites: PASS"
