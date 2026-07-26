# T02 — Atomic-v2 single-writer runbook and isolated evidence

Status: implementation and disposable-PostgreSQL evidence only. No production
connection, migration, flag, writer gate or push was used.

## What changes

Migrations `276_atomic_single_writer_v2.sql` and
`277_atomic_v2_lifecycle_hardening.sql` evolve the existing Atomic-v1 tables in
place. They do not introduce another assignment authority.

- `atomic_v1` gate rows are backfilled to `atomic_v2` and forced disabled.
- `atomic_v2` requires a tenant row, an explicit active writer UUID, a
  monotonically increasing writer epoch and an unexpired lease.
- the old create/transition/expiry/ACK/writer-switch RPCs lose
  `service_role` execute permission;
- assignment is immediately `assigned`; no accept, decline or offer expiry is
  part of v2;
- one RPC writes trip, every stop, all order claims and deadlines, driver
  load/state/version, one assignment per order, audit, notification outbox and
  replay result;
- one partial unique index protects every legacy/canonical active assignment
  state per order;
- technical ACK records receipt only and does not increment the assignment
  version;
- single-order pickup, start-delivery, cancellation, supervised pre-pickup
  reassignment and completion use tenant/actor authority plus exact
  order/assignment/trip/driver CAS;
- assignment, cancellation and supervised pre-pickup reassignment additionally
  require the exact elected writer UUID, writer epoch and unexpired lease;
- every multi-order lifecycle mutation is explicitly
  `MULTI_ORDER_LIFECYCLE_DEFAULT_OFF`; assignment batching is retained, but an
  individual order cannot alter the shared trip until that lifecycle is
  separately specified;
- post-pickup cancellation/reassignment returns a safe unsupported result and
  never infers custody transfer;
- the TypeScript/Frank path is independently default-off through
  `T02_ATOMIC_V2_ENABLED`.

## Required dry-run and verification order

Use only a disposable or explicitly isolated database.

1. Run the existing migration-274 preflight against the Atomic-v1 schema.
   Duplicate active assignments and half-null claims are stop conditions.
2. Wrap the migration in a transaction, run metadata assertions, and roll it
   back. The test wrapper
   `scripts/tests/276_atomic_single_writer_migration_dry_run.sql` demonstrates
   this and verifies both schema and gate data reverted.
3. Apply migrations 276 then 277 in isolated staging.
4. Run `scripts/preflight/276_atomic_single_writer_v2.sql`. It is an executable
   stop-gate: tenant mismatch, half-null claim, duplicate active assignment,
   invalid capacity, enabled Atomic-v1 gate, nullable assignment tenant or
   missing hard constraints raises and exits non-zero.
5. Run the complete suite:

   ```sh
   scripts/tests/with-local-remediation-postgres.sh \
     scripts/tests/run-276-atomic-single-writer.sh
   ```

The local harness creates and destroys its own PostgreSQL data directory and
database. It does not use Supabase or any configured application database URL.

## Explicit isolated enable sequence

Enabling is not authorized by this document. For a later approved staging
canary:

1. prove there are zero `offered|accepted` Atomic-v1 rows for the tenant;
2. keep `T02_ATOMIC_V2_ENABLED` false while applying and verifying the
   migration;
3. call `fn_dispatch_set_writer_v2(tenant, 'atomic_v2', true)`;
4. have exactly one server process call
   `fn_dispatch_claim_writer_v2(tenant, writer_uuid, lease_seconds)`;
5. set the process-local kill switch only for the approved isolated canary;
6. monitor returned correlation IDs and writer epoch/lease ownership.

`fn_dispatch_set_writer_v2` refuses activation while legacy Atomic-v1 active
offers remain. A competitor cannot take a live lease. Assignment rechecks the
identity, epoch and expiry inside the transaction.

## Disable rollback

The safe rollback is a disable, not destructive schema removal:

1. set `T02_ATOMIC_V2_ENABLED=false`;
2. call `fn_dispatch_set_writer_v2(tenant, 'atomic_v2', false)`;
3. verify `enabled=false`, `active_writer_id IS NULL` and
   `lease_expires_at IS NULL`;
4. preserve canonical rows for recovery/audit;
5. do not switch to a legacy writer until active canonical assignments have a
   separately approved drain/compatibility plan.

`276_atomic_single_writer_disable.sql` proves that disabling clears ownership,
rejects new assignments and does not delete existing assignment history.

## Evidence recorded 2026-07-26

Command:

```sh
scripts/tests/with-local-remediation-postgres.sh \
  scripts/tests/run-276-atomic-single-writer.sh
```

Exit code: `0`.

The suite proved:

- migration transaction dry-run and complete rollback;
- a second complete 276+277 application succeeds without duplicate objects;
- disabled Atomic-v1-to-v2 gate backfill;
- exact writer identity/epoch/lease and two-session tenant competition behind
  a fixture-only overlap barrier that releases both sessions before production
  advisory-lock acquisition;
- parsed-JSON exact cardinality for writer competition, same-action replay and
  different-fingerprint conflict, including canonical replay payload equality
  after excluding only `idempotent_replay`;
- 100 repeated true-overlap two-process assignment races with exactly one
  successful writer, one exact guarded loser and exact
  trip/deadline/stop/order/driver/assignment/request/audit/outbox projections;
- injected failure after each of the eight internal assignment write groups
  with no surviving batch, stop, claim, driver load, assignment, audit, outbox
  or replay row;
- explicit multi-order failure after the first claim rolls back the whole trip;
- multi-order pickup/cancel/reassign are rejected without changing either
  assignment, shared trip, stops or driver load;
- finite/ranged coordinates, future ordered deadlines and one-location-per-trip
  validation;
- stale order/assignment/trip/driver versions fail without mutation;
- single-order assigned→picked_up→in_progress→completed CAS projections;
- positive supervised pre-pickup reassignment with old/new trip, stop, driver,
  audit, outbox and correlation assertions;
- non-owner, stale-epoch and expired-lease reassignment attempts reject without
  mutating any projection;
- failure after every write group in pickup, start, cancel, reassign and
  completion leaves the complete prior projection unchanged;
- cancellation-vs-assignment overlaps at the RPC boundary and serializes to one
  exact valid terminal projection;
- reassignment-vs-delivery overlaps at the RPC boundary, completes the existing
  custody path and rejects handoff invention;
- technical ACK leaves assignment state/version unchanged;
- disable rollback rejects new writes and retains history.

Syntax compilation:

```sh
npm exec --offline --yes --package=esbuild -- esbuild \
  lib/delivery/atomic-offer.ts lib/frank.ts \
  --platform=node --format=esm --outdir=/tmp/t02-esbuild \
  --log-level=warning
```

Exit code: `0`.

Focused `tsc` was attempted with the repository lockfile but remains unverified:
`npm ci --ignore-scripts --no-audit --no-fund` exits `1` because the checked-in
lock resolves `@next/swc-linux-x64-gnu@16.2.10` on Darwin arm64. No lockfile was
changed.

## G2 boundary

The mandatory G2 database behaviors are green in a real disposable PostgreSQL
server using the isolated schema fixture. Remaining release limitations:

- the migration has not been run on a full Supabase staging schema;
- RLS/PostgREST integration, old clients and server API translation belong to
  T03 and are not claimed here;
- recovery and push delivery/provider behavior are outside T02; only atomic
  outbox insertion is proved;
- multi-order assignment creation is proved, but every multi-order lifecycle
  mutation remains deliberately default-off rather than claiming unapproved
  shared-trip semantics;
- post-pickup reassignment remains intentionally default-off and is proved by
  safe rejection, not a handoff flow;
- no production database, flag, writer gate, order or push was touched.
