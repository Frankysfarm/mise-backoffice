# Driver Remediation Program Status

Updated: 2026-07-27

| Task | State | Gate | Branch | Commit | Notes |
|---|---|---|---|---|---|
| T00 Baseline, Staging and Toolchain | COMPLETE | G0 GREEN | `codex/driver-remediation` | `f7d6b619` | Snapshots, isolated worktrees, toolchain, native validator and disposable PostgreSQL path verified. |
| T01 Canonical State Model | COMPLETE | G1 GREEN | `codex/driver-remediation` | `8acbe488` | Implementation plus independent specification and test reviews approved. |
| T02 Atomic Single Writer | COMPLETE | G2 GREEN (isolated PostgreSQL) | `codex/driver-remediation` | `43d5ee06` | Two review cycles; DB and adversarial race reviewers approved final hardened implementation. |
| T03 Server API and Client Boundary | COMPLETE | G3 GREEN (isolated PostgreSQL + source/client contracts) | `codex/driver-remediation` | `60932fc9` | API/security and client-boundary reviewers approved after three hardening cycles. |
| T04 Pick/Pickup Correctness | COMPLETE | G4 GREEN | `codex/driver-remediation` | `60621b64` | Atomic whole-batch pickup, cancellation-after-snapshot handling, disabled legacy bypasses and two-device race verified. |
| T05 Recovery/Push/Offline | COMPLETE | G4 GREEN | `codex/driver-remediation` | `a1408ce2` | Ownership-preserving recovery, wake-only push, snapshot-first ACK, strict offline replay and defensive database privileges verified. |
| T06 GPS Transport/Native | IN PROGRESS | G5 pending | main + native isolated branches | — | Exclusive GPS/native scope assigned to `t06_gps_native`. |
| T07–T10 | NOT STARTED | G6–G9 not evaluated | — | — | Governed by `EXECUTION_GRAPH.md`. |

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

## G1 decision

GREEN after two review rounds. The first independent review rejected the draft
for GPS, resume, reassignment, version-authority, override, mapping and test
gaps. Those findings were corrected. Final independent specification and test
reviews both returned `APPROVE`; the lead reran all three contract suites and
the focused P0 TypeScript gate successfully.

## G2 decision

GREEN in the required isolated PostgreSQL environment after two rejection and
hardening cycles. Final evidence includes 100 true-overlap two-session races,
exact winner/loser and idempotent replay comparison, 48 failure-injection
boundaries, lifecycle CAS, writer lease/epoch authority, full rollback
projections, migration double-apply, executable preflight stop-gate and
disable/rollback. Independent DB and adversarial race reviewers both returned
`APPROVE`. Full Supabase staging/RLS/PostgREST remains a later G3/G9 proof and
is not inferred from G2.

## G3 decision

GREEN for the isolated server-authoritative boundary. The final PostgreSQL
suite proves authenticated lifecycle RPCs, global idempotency, RLS/direct-write
denial, canonical item resolution, technical ACK, exception audit and a true
two-session stop-CAS race. The client boundary restores/reconciles canonical
snapshots, reloads on unknown Realtime versions and reconnect, persists exact
retry envelopes, rejects ordinary decline and no longer mounts the identified
direct-write/optimistic lifecycle widgets. Independent API/security and client
reviewers both returned `APPROVE`.

## G4 decision

GREEN after repeated adversarial review and correction cycles. T04 proves
whole-batch pickup with exact active order/item manifests, immutable kitchen
resolution provenance, no ordinary driver-side missing-item decision,
transactional cancellation-after-snapshot handling, failure rollback and a
real two-device race. Legacy single-order pickup/depart routes and RPCs cannot
write.

T05 preserves active assignment ownership during stale GPS and recovery,
uses one CAS escalation path, separates provider acceptance from technical app
ACK, treats push as wake-only, restores the canonical snapshot after push,
restart, replay and conflicts, and restricts offline replay to validated,
fingerprinted v2 actions. The isolated PostgreSQL suite proves migration
double-apply, hostile pre-grant revocation, RLS/service-role boundaries,
episode deduplication and restart safety. No production action occurred.
