# Reproducible Commands

All commands run from `/Users/eule/mise-driver-remediation` unless stated
otherwise.

| Purpose | Command | Expected safety boundary | Exit |
|---|---|---|---|
| Dirty-state check | `git status --short --branch` | local Git only | `0` |
| Patch hygiene | `git diff --check` | local Git only | `0` |
| Focused non-interactive lint | `CI=1 NEXT_TELEMETRY_DISABLED=1 npm run lint -- --file next.config.js` | local source only | `0` |
| Full non-interactive lint | `CI=1 NEXT_TELEMETRY_DISABLED=1 npm run lint -- --quiet` | local source only | `1` — pre-existing JSX escaping and Hooks violations; no prompt |
| Focused typecheck | `./node_modules/.bin/tsc -p tsconfig.p0.json --noEmit --pretty false --incremental false` | local source only | `0` |
| Atomic lifecycle contract test | cached local `esbuild` of `scripts/tests/atomic-lifecycle-contract.test.ts`, then `node` bundle | local source and `/tmp` | `0` |
| Atomic offer client-state test | cached local `esbuild` of `scripts/tests/atomic-offer-client-state.test.ts`, then `node` bundle | local source and `/tmp` | `0` |
| Intelligent dispatch unit test | cached local `esbuild` of `scripts/tests/intelligent-dispatch.test.ts`, then `node` bundle | local source and `/tmp` | `0` |
| Long-distance batching unit test | cached local `esbuild` of `scripts/tests/long-distance-batching.test.ts`, then `node` bundle | local source and `/tmp` | `0` |
| Local PostgreSQL smoke test | `scripts/tests/with-local-remediation-postgres.sh sh -c 'psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select current_database(), current_setting(...)”'` | disposable loopback PostgreSQL only | `0` — `mise_remediation`, PostgreSQL 16.13 |
| Native fast verification | `./scripts/verify-fast.sh` in `/Users/eule/mise-driver-native-t00` | isolated native worktree, no network | `0` |
| npm lock consistency dry run | `npm install --package-lock-only --ignore-scripts --offline --dry-run` | no writes intended | `1` — direct Linux-only SWC dependency is incompatible with Darwin |
| npm lock consistency forced diagnostic | same command with `--force`, followed by lockfile diff | local only | `0`; both lockfiles unchanged |
| Next build diagnostic | `CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` | local build only; no deployment | manually stopped after 60s: 14 `next/font/google` DNS failures/retries; invalid Turbopack warning resolved |

The isolated worktree temporarily referenced the already installed dependency
tree in `/Users/eule/mise-backoffice-work/node_modules` for local commands.
That symlink and all `.next`/`*.tsbuildinfo` outputs were removed before commit.
