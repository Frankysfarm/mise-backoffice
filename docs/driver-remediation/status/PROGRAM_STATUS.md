# Driver Remediation Program Status

Updated: 2026-07-26

| Task | State | Gate | Branch | Commit | Notes |
|---|---|---|---|---|---|
| T00 Baseline, Staging and Toolchain | COMPLETE | G0 GREEN | `codex/driver-remediation` | pending task commit | Snapshots, isolated worktrees, toolchain, native validator and disposable PostgreSQL path verified. |
| T01 Canonical State Model | READY | G1 not evaluated | `codex/driver-remediation` | — | Permitted by green G0; must receive exclusive canonical-contract ownership before edits. |
| T02 Atomic Single Writer | NOT STARTED | G2 not evaluated | — | — | Blocked by T01. |
| T03 Server API and Client Boundary | NOT STARTED | G3 not evaluated | — | — | Blocked by T02. |
| T04–T10 | NOT STARTED | G4–G9 not evaluated | — | — | Governed by `EXECUTION_GRAPH.md`. |

## Production safety

No production deployment, production database connection, production
migration, feature-flag activation, real order, real push, or TestFlight action
is authorized or has been performed by this program.

## Current critical-file ownership

See `FILE_OWNERSHIP.md`. Until G0 completes, no business-logic critical file is
assigned for modification.

## G0 decision

GREEN. Every pre-existing change is reproducibly snapshotted; both repositories
have isolated worktrees; npm selection and lock ambiguity are documented; lint
is non-interactive; focused lint, typecheck and tests pass; a disposable
PostgreSQL 16 path passes; no production action occurred.

Known baseline debt does not invalidate G0 but remains explicit:

- full lint is red on pre-existing product files;
- a full Next build cannot complete in the restricted environment because
  `next/font/google` retries blocked DNS requests;
- the current manifest contains a direct Linux-only SWC package that makes an
  unforced Darwin npm lock dry-run fail;
- PyYAML is absent from the native scaffold, so its fast validator reports a
  YAML-depth warning.
