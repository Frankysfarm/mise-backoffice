# Complete System Gate Summary

Updated: 2026-07-29

| Gate | Status | Evidence |
|---|---|---|
| G0 baseline/toolchain | GREEN | Isolated worktrees, snapshots, disposable PostgreSQL and focused toolchain verified |
| G1 canonical state | GREEN | Canonical lifecycle/state contract and compatibility tests |
| G2 single writer | GREEN | Atomic-v2 transaction contract and repeated 100-case true-overlap races |
| G3 server/client boundary | GREEN | Authenticated v2 APIs, RLS/direct-write denial, idempotency and stop race |
| G4 pick/pickup/recovery | GREEN | Whole-batch invariants, two-device race, push/offline recovery |
| G5 GPS/native | BLOCKED_EXTERNAL | Backend/native source green; compiled mobile and physical devices unavailable |
| G6 deterministic dispatch | GREEN | Default-off shadow/active contract and canonical writer races |
| G7 routing/batching/hold | GREEN | Atomic append race, Frank integration, shadow snapshot, hold watchdog and replay |
| G8 operations/security | GREEN | Durable override CAS, authz/RLS, alerts, retention and monitor integration |
| G9 complete E2E/release | BLOCKED_EXTERNAL | Full local aggregate green; hosted services, networked build and hardware absent |

No blocked external gate has been promoted from source/unit evidence.
