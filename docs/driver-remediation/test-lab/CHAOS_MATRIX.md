# Deterministic Chaos Matrix

The chaos controller under `tests/driver-system-lab/chaos/` uses a virtual monotonic clock. Every fault has an ID, kind, explicit `atMs`, a `test:` target, payload, run ID, seed, and deterministic sequence. It never sleeps or calls an external provider itself.

Construction is fail-closed. The caller must first supply authorization from the central environment guard proving `enabled: true`, an environment in `local|test|staging`, a valid `tl_*` run ID, and a `tl_*` tenant prefix. Production-like environments, non-test targets, duplicate IDs, fractional/negative timing, and non-deterministic seeds are rejected before scheduling.

Supported deterministic fault classes:

| Area | Faults |
|---|---|
| Database | timeout, transaction abort, failpoint after write, lock wait |
| Worker/events | crash, restart, duplicate, stale and out-of-order event |
| Push | 4xx, 5xx, missing ticket, partial result |
| Client/network | realtime disconnect, slow/offline network, service-worker restart, browser reload |
| Clock/GPS | clock skew, stale GPS, impossible GPS jump |
| Routing | timeout, partial matrix, quota response |
| Capacity | disk-fast-full, cache growth, queue backlog |

Fault consumers remain responsible for transaction rollback and invariant snapshots. After every fired fault the orchestrator must run the invariant monitor and store fault evidence alongside API/DB/UI evidence. Same initial state, seed and timeline produce byte-equivalent fault evidence. Chaos targets must be local adapters or explicit staging test sinks; the controller cannot authorize production or real-user devices.

Focused verification:

```text
npx tsx --test tests/driver-system-lab/chaos/controller.test.ts
```
