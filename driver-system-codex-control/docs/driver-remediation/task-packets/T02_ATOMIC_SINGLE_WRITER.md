# T02 — Atomic Single Writer and Database Invariants

## Objective

Make duplicate/partial assignment structurally impossible in an isolated database.

## Required implementation

1. Implement tenant-scoped single-writer election/gate with explicit active writer identity.
2. Create or evolve one atomic assignment RPC/transaction that commits together:
   - assignment/trip creation or route insertion;
   - all stops;
   - order claim/link;
   - driver capacity/load/version;
   - decision/audit rows;
   - notification outbox;
   - persistent deadlines needed by the canonical contract.
3. Enforce one active assignment per order with database constraints.
4. Add expected-state/version CAS guards to lifecycle transitions.
5. Add stable idempotency keys and replay-result storage.
6. Define safe cancellation/reassignment transaction semantics.
7. Add compatibility views/adapters only when necessary; do not maintain two writable authorities.
8. Create migration dry-run, rollback/disable and data-backfill verification scripts.
9. Instrument structured errors; no ignored PostgREST/SQL failures.

## Mandatory tests

- at least 100 repeated two-session worker races;
- duplicate idempotency request;
- failure injected after each internal write step;
- stale version transition;
- two writers competing for same tenant;
- cancellation versus assignment race;
- reassignment versus delivery race;
- multi-order trip insertion rollback.

## File ownership

Exclusive ownership of assignment migrations/RPCs and `lib/frank.ts` integration surfaces while active.

## Acceptance

Gate G2 green in isolated staging. No production migration or flag activation.
