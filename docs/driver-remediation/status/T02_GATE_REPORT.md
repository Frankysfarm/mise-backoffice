# T02 Completion and G2 Gate Report

## 1. Task and branch/commit

- Task: `T02_ATOMIC_SINGLE_WRITER`
- Branch/worktree: `codex/driver-remediation` /
  `/Users/eule/mise-driver-remediation`
- Commit: pending at report creation
- Prerequisite: T01 / G1 green at `8acbe488`

## 2. Changed files

- `lib/delivery/atomic-offer.ts`
- `lib/frank.ts` (minimal default-off writer-gate integration only)
- `scripts/migrations/276_atomic_single_writer_v2.sql`
- `scripts/migrations/277_atomic_v2_lifecycle_hardening.sql`
- `scripts/preflight/276_atomic_single_writer_v2.sql`
- `scripts/tests/276_*`, `scripts/tests/277_*`
- `scripts/tests/fixtures/276_minimal_schema.sql`
- `scripts/tests/parse-276-race-json.py`
- `scripts/tests/run-276-atomic-single-writer*.sh`
- `docs/runbooks/T02-ATOMIC-V2-SINGLE-WRITER.md`
- program status/ownership/gate documentation

No API/UI/GPS/recovery/dispatch-scoring behavior was changed. Atomic-v2 remains
default-off via `T02_ATOMIC_V2_ENABLED`.

## 3. Proven invariants

- One enabled tenant writer has an explicit writer ID, epoch and unexpired
  lease; assignment, cancellation and reassignment validate the same authority.
- One active assignment per order is database-enforced.
- Assignment atomically commits requests/replay result, trip, exact stops,
  order claims, driver load/version, assignments, audit, outbox and deadlines.
- Same action/fingerprint replays the original canonical result; a different
  fingerprint conflicts.
- Server lifecycle RPCs provide CAS pickup, start-delivery, cancel,
  pre-pickup-reassign and complete boundaries.
- ACK records receipt without incrementing assignment lifecycle version.
- Multi-order lifecycle mutation is hard default-off where safe partial-trip
  semantics are not yet implemented; rejection leaves state unchanged.
- Post-pickup reassignment is rejected; custody is never guessed.
- Route inputs require finite/range-valid coordinates, ordered future deadlines
  and one location.
- Migrations 276 and 277 apply twice safely in the disposable schema.
- Executable preflight raises on tenant, claim-pair, capacity, duplicate-active
  and required-constraint violations.
- Atomic-v1 mutation grants are revoked; this evolves the existing foundation
  instead of adding another writable authority.

## 4. Commands and exit codes

- `scripts/tests/with-local-remediation-postgres.sh scripts/tests/run-276-atomic-single-writer.sh`: `0`
- final P0 TypeScript check through the existing local dependency tree: `0`
- esbuild syntax/bundle for `atomic-offer.ts` and `frank.ts` with server-only
  externals: `0`
- `git diff --check`: `0`

The lead reran the full disposable PostgreSQL suite after the final function
signature hardening.

## 5. New tests and results

The suite proves:

- 100 true-overlap two-session assignment races;
- overlapping tenant writer election;
- exact success/guarded-loser cardinality;
- same-key canonical replay equality;
- different-fingerprint conflict;
- 48 write-group failpoints across assignment, pickup, start, cancel,
  reassignment and completion, each rollback-clean;
- stale order/driver/assignment CAS;
- cancel-vs-assignment and reassign-vs-delivery races;
- positive supervised pre-pickup reassignment;
- multi-order rollback/default-off no-mutation;
- complete batch/order/driver/assignment/stop/deadline/request/audit/outbox
  projections and losing-writer orphan absence;
- backfill, double-apply, preflight and disable/rollback.

Result: PASS.

## 6. Remaining risks

- The proof uses real PostgreSQL 16 with a schema-compatible minimal fixture,
  not a full Supabase staging stack.
- RLS/PostgREST/authenticated API behavior and old-client behavior belong to
  T03/G3.
- Multi-order lifecycle changes remain default-off until T04/T08 define and
  test safe partial-trip operations.
- Post-pickup custody transfer remains intentionally unsupported.
- No tenant gate or feature flag has been activated anywhere.

## 7. Gate result

`G2: GREEN` for isolated database correctness.

The initial two independent reviews returned `CHANGES_REQUIRED`. After
hardening, both final reviews returned `APPROVE`, and the lead independently
reran the complete suite.

## 8. Production confirmation

No production system, migration, feature flag, push, order or deployment was
changed.

## 9. Next graph-permitted task

`T03_SERVER_API_AND_CLIENT_BOUNDARY`.
