# Test Lab Invariant Monitor

The monitor under `tests/driver-system-lab/invariants/` is a read-only fail-fast boundary. The orchestrator supplies a coherent snapshot after every relevant event and before cleanup. The monitor performs no repair and no business mutation.

Every snapshot and every included row must carry the same syntactically valid `test_run_id`. A cross-run row is the first check and a P0 failure. Each failure throws `InvariantViolationError` with schema-versioned evidence: run ID, observation time, invariant ID, severity, involved entity IDs, redacted facts, and the full minimal input snapshot for reproduction.

Implemented checks cover:

- at most one active assignment per order; terminal orders cannot remain active; every non-terminal order is assigned, held, or explicitly unresolved;
- assignment referential and tenant integrity plus tenant-scoped idempotency history;
- at most one active batch per driver, offline-driver exclusion, and exact capacity/load agreement;
- exact pickup/drop-off presence and precedence, unique open sequences, and tenant-consistent route rows;
- no departure without a same-version persisted `google` or contract-equivalent `fixture-google` plan;
- no departure until every required item is picked and every missing item explicitly clarified;
- one active push row per logical event and no provider send after a terminal claim;
- immutable run binding across orders, assignments, drivers, batches, stops, routes, picks, pushes, and audits.

The fixture provider name means a deterministic simulator implementing the Google routing contract; it is not a production fallback. Orchestrator integration must persist the thrown evidence and stop scenario execution before any further destructive test step. Repairs and cleanup are separate, guarded workflows.

Focused verification:

```text
npx tsx --test tests/driver-system-lab/invariants/monitor.test.ts
```
