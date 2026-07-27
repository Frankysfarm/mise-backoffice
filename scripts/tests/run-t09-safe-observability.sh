#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
esbuild_bin="${ESBUILD_BIN:-$HOME/.npm/_npx/b3ca12a867cd0704/node_modules/.bin/esbuild}"
output_file="${TMPDIR:-/tmp}/mise-t09-ops-observability-test.cjs"

if [[ ! -x "$esbuild_bin" ]]; then
  echo "T09_BLOCKED_ESBUILD_NOT_AVAILABLE: set ESBUILD_BIN to a local esbuild binary" >&2
  exit 2
fi

"$esbuild_bin" "$repo_root/scripts/tests/ops-observability.test.ts" \
  --bundle --platform=node --format=cjs --outfile="$output_file"
node "$output_file"
