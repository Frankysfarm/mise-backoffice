# T08 Final Report — Routing, Batching and Kitchen Hold

Date: 2026-07-28
Branch: `codex/driver-remediation`

## Outcome

T08 is locally complete. The production path remains default-off per tenant.
When enabled in shadow mode it loads and evaluates the same route snapshot but
cannot call the append RPC. Active mode is restricted to the elected
Atomic-v2 writer and commits route, order, driver capacity, assignment, audit
and push-outbox projections only through `fn_append_order_to_route_v2`.

## Architecture delivered

- Frank loads tenant membership, operational driver state, canonical current
  GPS, capacity, active batch, open stops, order deadlines and all expected
  versions.
- Candidate routes use provider road legs where available. Missing or partial
  responses use the conservative marked Haversine fallback.
- `evaluateBestInsertion` protects pickup-before-drop-off, new and existing
  customer deadlines, capacity, detour limits and the default multi-store ban.
- Candidate selection is deterministic. Rejected relevant candidates and all
  score/route components are written to the separate decision audit.
- Active append uses one RPC. CAS conflicts cause at most one complete
  snapshot reload/re-evaluation; no unbounded retry or legacy partial write is
  reachable.
- Kitchen holds persist input version, stable release time, deadline, reason
  and calculation inputs. The controlled internal scheduler invokes a
  `FOR UPDATE SKIP LOCKED` watchdog. Release, audit and outbox commit together;
  retries/restarts are idempotent and cancelled orders are never released.

## Verification

The full runner was executed twice consecutively against two fresh disposable
PostgreSQL 16 instances:

```sh
scripts/tests/with-local-remediation-postgres.sh \
  scripts/tests/run-282-routing-batching-kitchen-hold.sh
```

Both runs exited `0` and included:

- route feasibility, deadline, capacity, multi-store, fallback, cache,
  hysteresis and hold calculation tests;
- automated shadow before/after business-snapshot equality;
- deterministic replay (100 identical evaluations);
- migration double-apply and SQL behavior/failure assertions;
- hold retry, release retry, cancellation, watchdog restart and audit/outbox;
- two genuinely overlapping PostgreSQL append sessions with exactly one
  winner and no loser projection.

Focused `tsc -p tsconfig.p0.json --noEmit` and the complete retained T07
deterministic writer/race runner also exited `0`.

## Commits

- `5fa6b6f3` — true-overlap append race and fingerprint evidence
- `570d953e` — Frank append integration and persistent hold watchdog
- `c02e15e0` — deterministic replay and complete candidate reasons

## Boundaries

No production database, flag, scheduler, route provider, order, push or
deployment was touched. Provider behavior is tested through deterministic
road/fallback contracts; live provider and production-scale behavior remain
T10 staging/release evidence, not a T08 production claim.
