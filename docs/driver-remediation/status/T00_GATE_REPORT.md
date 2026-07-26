# T00 Completion and G0 Gate Report

## 1. Task and branch/commit

- Task: `T00_BASELINE_STAGING_TOOLCHAIN`
- Main branch/worktree: `codex/driver-remediation` /
  `/Users/eule/mise-driver-remediation`
- Main task commit: pending at report creation
- Preserved pre-T00 input commit: `dc7385ed`
- Native branch/worktree: `codex/t00-native-verify` /
  `/Users/eule/mise-driver-native-t00`
- Native task commit: `0ec66deec2392719c920cdcb2c8fbfe0f61c8a5e`

## 2. Changed files

Main repository:

- `AGENTS.md`
- `.eslintrc.json`
- `package.json`
- `next.config.js`
- `scripts/tests/with-local-remediation-postgres.sh`
- `docs/driver-remediation/**`

Native repository:

- `scripts/validate-agent-system.py`
- `00-START-HERE.md`
- `MASTER-PROMPT-FABLE-5.md`
- `docs/task-packets/T00-VERIFICATION-SCAFFOLD.md`

No T00 change touches `lib/frank.ts`, dispatch policy, lifecycle APIs, or driver
UI. Their pre-existing diffs exist only in the separately identified
preservation commit.

## 3. Proven invariants

- The original dirty worktrees remain intact.
- Staged, unstaged, untracked and generated baseline state is inventoried.
- Remediation work occurs on isolated branches/worktrees.
- Generated artifacts are excluded from task commits.
- npm is the documented command path; neither lockfile was deleted.
- Lint invocation is non-interactive.
- The invalid Next 14 `turbopack` key is gone.
- Local database tests can only receive a newly created loopback PostgreSQL URL.
- Native scaffold validation does not traverse dependencies, generated output,
  or nested worktrees.
- No production endpoint, database, push, order, deployment, migration, feature
  flag, or TestFlight release was touched.

## 4. Commands and exit codes

See `COMMANDS.md`. Required green evidence:

- focused lint: `0`
- focused TypeScript: `0`
- four focused lifecycle/dispatch tests: `0`
- disposable PostgreSQL smoke test: `0`
- native `verify-fast.sh`: `0`
- `git diff --check`: `0`

Diagnostic red evidence is retained rather than hidden:

- full lint: `1` on pre-existing product violations;
- unforced Darwin npm lock dry-run: `1` on Linux-only SWC dependency;
- full build: stopped after repeated blocked Google Fonts DNS fetches.

## 5. New tests/tooling

- Added the disposable `with-local-remediation-postgres.sh` harness.
- Added native validator regression coverage manually during T00:
  invalid dependency/build/worktree fixtures were ignored, while an invalid
  source-owned `evals/*.json` fixture failed as expected.
- No business-logic test was rewritten merely to obtain green output.

## 6. Remaining risks

- Full-repository lint debt is not yet repaired.
- The build depends on network-hosted Google Fonts at compilation time.
- Package metadata contains a platform-specific direct SWC dependency.
- Native YAML files receive only shallow validation without PyYAML.
- A disposable engine is available, but complete schema replay is a later gate
  and must not be inferred from the smoke test.

## 7. Gate result

`G0: GREEN`.

G0 asks for reproducible baseline isolation, package-manager decision,
non-interactive lint, focused typecheck/tests, an isolated database path, and
production safety. Each condition is proven. G0 does not require the
pre-existing whole-product lint/build debt to be repaired inside T00.

## 8. Production confirmation

No production system was changed.

## 9. Next graph-permitted task

`T01_CANONICAL_STATE_MODEL`.
