# Complete System Continuation Baseline

Recorded: 2026-07-28 (Europe/Berlin)

This document records the unchanged starting state for the complete Driver and
Lieferzentrale continuation requested by
`/Users/eule/Downloads/MISE_DRIVER_GESAMTSYSTEM_HIGH_CODEX_PROMPT.txt`.
No production system was inspected or changed while creating this baseline.

## Main repository

- Path: `/Users/eule/mise-driver-remediation`
- Branch: `codex/driver-remediation`
- HEAD: `c2eb5b1ffe362e71c00f868ae239e1dd69f227a8`
- Merge/rebase state: none detected
- Upstream: no upstream shown by `git status --short --branch`

Initial status:

```text
## codex/driver-remediation
 M scripts/migrations/282_routing_batching_kitchen_hold.sql
 M scripts/tests/run-282-routing-batching-kitchen-hold.sh
?? scripts/tests/282_route_append_race_setup.sql
?? scripts/tests/run-282-route-append-race.sh
```

These four T08 files predate this continuation baseline and must be preserved.
They are an unfinished true-overlap route-append race candidate. They were not
claimed as passing at baseline time.

Main repository worktrees:

```text
/Users/eule/mise-backoffice-work     f14afea5 [codex/p0-single-writer-atomic-offer]
/Users/eule/mise-driver-remediation  c2eb5b1f [codex/driver-remediation]
/Users/eule/mise-pick-gate-fix       f14afea5 [codex/multiorder-pick-gate]
```

## Native repositories

Original/native product worktree:

- Path: `/Users/eule/mise-driver-app`
- Branch: `main`
- HEAD: `afc25f88deac18658316f9db531e878f14c73442`
- Upstream: `origin/main`
- Merge/rebase state: none detected

Initial dirty state:

```text
## main...origin/main
 A eas.json
?? .claude/
?? CLAUDE.md
?? PROJECT_STATE.md
?? app.json
?? design/
?? docs/01-OPERATING-MODEL.md
?? docs/02-TARGET-ARCHITECTURE.md
?? docs/03-STATE-MACHINES.md
?? docs/04-DISPATCH-ENGINE-SPEC.md
?? docs/05-TRACKING-AND-ALERTING.md
?? docs/06-TEST-STRATEGY.md
?? docs/07-OBSERVABILITY-SLOS.md
?? docs/08-SECURITY-PRIVACY.md
?? docs/09-ROLLOUT-PLAN.md
?? docs/10-DEFINITION-OF-DONE.md
?? docs/11-AGENT-MATRIX.md
?? docs/12-DELIVERY-APP-REMEDIATION-TREE.md
?? docs/CURRENT-SYSTEM-INVENTORY.md
?? docs/CURRENT-SYSTEM-INVENTORY.template.md
?? docs/task-packets/
?? evals/
?? scripts/
?? templates/
```

These files are pre-existing user/source material and are not to be
overwritten.

Isolated native candidate:

- Path: `/Users/eule/mise-driver-native-t00`
- Branch: `codex/t00-native-verify`
- HEAD: `4d048c24d9a6765ddece03c9fcbfaae728a61573`
- Status: clean
- Candidate commit: `4d048c2 T06 add native GPS lifecycle source candidate`

Native worktrees:

```text
/Users/eule/mise-driver-app                                      afc25f8 [main]
/Users/eule/mise-driver-app-push                                 c1f1fae [codex/apns-offer-contract]
/Users/eule/mise-driver-app/.claude/worktrees/wf_406fc929-620-3  e5b042a [worktree-wf_406fc929-620-3]
/Users/eule/mise-driver-native-t00                               4d048c2 [codex/t00-native-verify]
```

## File ownership at baseline

- T08 exclusively owns `lib/frank.ts` for routing/batching/hold integration
  and new T08 modules/migration/tests.
- T01–T07 canonical lifecycle, assignment, recovery, client and GPS scopes are
  marked protected/released in `status/FILE_OWNERSHIP.md`.
- Program status documents are owned by the lead continuation.
- Any reopened T06/T09 scope must be recorded before modifying protected files.

## Local toolchain and isolated test paths

- Node: `v20.20.2`
- npm: `10.8.2`
- PostgreSQL client: `16.13`
- Disposable local PostgreSQL runner:
  `scripts/tests/with-local-remediation-postgres.sh`
- Java executable exists but no Java runtime is installed.
- Full Xcode is unavailable; only Command Line Tools are selected.
- CocoaPods is present but cannot establish an iOS build without full Xcode.
- Main worktree has no local `node_modules`; the previously documented
  dependency tree exists in `/Users/eule/mise-backoffice-work/node_modules`
  and may only be linked temporarily for local verification.

No relevant GPS, Supabase, database, APNs, EAS, Expo, Google routing or driver
environment variable names were present in the current shell environment.
No secret values or repository `.env` files were read.

## Baseline gate claims to reverify

- G0–G4 and G6 are recorded GREEN in the pre-existing program status.
- G5 is recorded RED with a source candidate.
- G7 is pending and has unfinished dirty race-test work.
- G8 is RED with an additive source candidate.
- G9 is not evaluated.

These labels are historical claims only until the continuation regression
commands have been rerun. Hardware, signing, simulator, external staging and
production facts are not inferred from source.

## Production safety confirmation

Baseline creation performed no production database access, production
migration, deployment, real order, real push, feature activation, TestFlight
action, App Store action, live rollout or secret change.

