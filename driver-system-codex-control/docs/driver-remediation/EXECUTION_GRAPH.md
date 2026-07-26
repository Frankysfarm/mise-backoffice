# Execution Graph

```text
T00 Baseline/Staging/Toolchain
  |
  v
T01 Canonical State Model
  |
  v
T02 Atomic Single Writer
  |
  v
T03 Server API + Client Boundary
  |\
  | +--> T04 Pick/Pickup Correctness --------+
  | +--> T05 Recovery/Push/Offline ----------+--> T07 Deterministic Dispatch Baseline
  | +--> T06 GPS Transport + Native ---------+             |
  | +--> T09 Ops/Security/Observability* ----+             v
  |                                                T08 Routing/Batching/Kitchen Hold
  |                                                          |
  +----------------------------------------------------------+
                                                             v
                                                   T10 E2E/Canary/Release
```

`T09` may begin after T03 only for additive telemetry/security work that does not change canonical lifecycle contracts. Any RLS or state transition change waits for T02/T03 integration.

## Parallelism rules

### Must be sequential

- T00 → T01 → T02 → T03
- T07 → T08 → T10

### May run in parallel after T03

- T04, T05, T06 and additive portions of T09, only in separate worktrees with non-overlapping file ownership.

### Never edit concurrently

- `lib/frank.ts`
- assignment migrations/RPCs
- canonical lifecycle/state modules
- `lib/delivery/recovery.ts`
- `app/fahrer/app/client.tsx`

The orchestrator assigns these files to one task at a time and records ownership.

## Integration policy

Each task must be rebased on the latest green integration branch, pass its own tests, then pass the full current gate suite after merge. A later task may not paper over a failing earlier gate.
