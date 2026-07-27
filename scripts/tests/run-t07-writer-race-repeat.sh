#!/bin/sh
set -eu

runs=${T07_RACE_REPEAT_RUNS:-3}
artifact_dir=${T07_RACE_ARTIFACT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/t07-race-artifacts.XXXXXX")}
echo "T07 race artifacts: $artifact_dir"

iteration=1
while [ "$iteration" -le "$runs" ]; do
  artifact="$artifact_dir/run-$iteration"
  if ! T07_RACE_ARTIFACT="$artifact" \
    scripts/tests/with-local-remediation-postgres.sh \
    scripts/tests/run-t07-race-capture-inner.sh; then
    echo "T07 writer race run $iteration: FAIL (artifacts retained at $artifact.*)" >&2
    exit 1
  fi
  echo "T07 writer race run $iteration: PASS"
  iteration=$((iteration + 1))
done
