# T03 Completion and G3 Gate Report

## 1. Task and branch/commit

- Task: `T03_SERVER_API_AND_CLIENT_BOUNDARY`
- Branch/worktree: `codex/driver-remediation` /
  `/Users/eule/mise-driver-remediation`
- Commit: pending at report creation
- Prerequisite: T02 / G2 green at `43d5ee06`

## 2. Changed scope

- canonical v2 contract/server layer under `lib/delivery/driver-v2-*`
- authenticated versioned routes under `app/api/driver/v2/**`
- constrained v1 accept/transition/lifecycle adapters
- driver authentication error handling
- active driver client, DeliveryView, PickDialog and normal-decline context
- Atomic-v2 no-ACK auto-cancel fence
- migration `278_driver_v2_api_boundary.sql`
- isolated SQL, race and client-boundary tests
- focused P0 TypeScript gate

No production deployment, migration, feature flag, push, order or TestFlight
operation was performed.

## 3. Proven invariants

- Critical driver actions use authenticated v2 server APIs and checked RPCs.
- Every critical request carries expected states, required authority versions,
  immutable action ID/envelope and one correlation ID.
- A single global action registry provides exact replay and rejects changed or
  cross-family reuse.
- Every success and checked failure returns a canonical snapshot when
  authentication permits.
- Arrival, item resolution, pickup, departure and completion enforce locked
  stop/trip/route/order/assignment/driver CAS.
- Item outcomes are exact-set validated against canonical order items;
  fabricated, duplicate, foreign or incomplete sets cannot unlock pickup.
- Old accept translates atomically to technical ACK plus compatibility
  telemetry; normal decline returns 409 with structured exception categories.
- Browser roles cannot mutate canonical lifecycle tables or `driver_status`,
  even when dangerous table-wide grants existed before migration.
- Client retries persist and replay the exact original envelope.
- Restart, unknown Realtime versions and reconnect reload canonical state.
- Snapshot reconciliation can construct, replace or clear the active trip and
  cold driver status.
- Identified mounted direct-write/optimistic widgets are no longer active.
- Multi-order pickup is rejected before any write while its atomic semantics
  remain default-off for T04/T08.
- Missing ACK never releases an Atomic-v2 assignment; legacy auto-cancel is
  explicit opt-in and fenced.
- GPS persistence remains explicitly default-off for T06.

## 4. Commands and exit codes

- `scripts/tests/with-local-remediation-postgres.sh scripts/tests/run-278-driver-v2-boundary.sh`: `0`
- `scripts/tests/driver-v2-boundary.test.ts` bundled with cached esbuild and
  executed by Node: `0`
- P0 TypeScript gate including T03 contract/server/test:
  `tsc -p tsconfig.p0.json --noEmit --pretty false --incremental false`: `0`
- changed TS/TSX/routes esbuild checks: `0`
- `git diff --check`: `0`

## 5. New tests and results

The disposable suite covers:

- unauthorized and cross-tenant/other-driver mutations;
- stale aggregate and stop/route versions;
- duplicate exact replay, changed-fingerprint and cross-family conflicts;
- session, ACK, arrival, exact items, pickup, departure, completion and safety
  exception audit;
- realistic pre-existing broad grants followed by anon/authenticated
  INSERT/UPDATE/DELETE denial with retained reads;
- one correlation ID across request, registry, audit, compatibility event,
  result and snapshot;
- true two-session stop CAS with exactly one winner and one stale loser.

Client/source tests cover:

- restart reconstruction and stale assignment clearing;
- Realtime unknown/gap/out-of-order/reconnect reload policy;
- immutable retry envelopes;
- old-client ACK/decline behavior;
- zero mounted known direct-write/optimistic controls;
- multi-order rejection before any request.

All passed.

## 6. Remaining risks

- Full Supabase/PostgREST staging and browser/device E2E remain G9 evidence.
- Same-trip stop membership/order reconciliation currently overlays the
  canonical stop projection; full route-version replacement is a T05/T08
  follow-up.
- Multi-order pickup is intentionally default-off until T04 proves atomic
  completeness semantics.
- GPS events are shape-validated but persistence remains T06 default-off.

## 7. Gate result

`G3: GREEN`.

Both final independent reviewers returned `APPROVE` after the last
`driver_status` privilege fix and client active-path cleanup.

## 8. Production confirmation

No production system was changed.

## 9. Next graph-permitted task

`T04_PICK_PICKUP_CORRECTNESS`.
