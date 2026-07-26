# P1 Long-distance smart batching

## Default-off flags

- `P0_INTELLIGENT_20KM_ENABLED=true` enables the 20 km eligibility scorer.
- `P0_SMART_LONG_DISTANCE_BATCHING_ENABLED=true` is reserved for integration
  of `long-distance-batching.ts` into the batch writer.

Both are false when absent.

## Deterministic policy

`lib/delivery/long-distance-batching.ts` provides two pure decisions:

1. A distance-tiered hold decision with a hard 20 km cap, deadline override,
   and absolute hold deadline. Local orders up to 3 km have no hold by default.
2. A route-corridor decision that checks heading, corridor width, maximum
   detour kilometres and ratio, three-additional-order limit, capacity, and
   candidate deadline feasibility.

Every outcome has one stable reason code and numeric audit inputs. A hold never
extends from the current time: it is anchored to `createdAt`, so restarts and
retries cannot wait indefinitely. At deadline it returns `dispatch_now`, even
with no compatible sibling.

## Live Phase 4/5 additive patch plan

Target: `/tmp/mise-live-merge/lib_frank.ts.merged`

1. Copy `long-distance-batching.ts` with the release artifact and import
   `decideLongDistanceHold` and `evaluateCorridorBundle`.
2. Add `smartLongDistanceBatchingEnabled()` reading only
   `P0_SMART_LONG_DISTANCE_BATCHING_ENABLED === 'true'`.
3. After geocoding and before the existing Phase-4 sibling hold, evaluate
   `decideLongDistanceHold`. Persist its absolute `holdUntil` in the existing
   `dispatch_after` column and log its reason/audit. On `dispatch_now`, clear
   only the long-distance hold and continue through the existing live path.
4. Do not replace Phase-4/5 capacity, solo, stale-GPS, orphan, or active-route
   logic. Before `addOrderToBundle`, additionally require
   `evaluateCorridorBundle(...).compatible` when the new flag is on.
5. Build corridor input from the existing route pickup and final open dropoff;
   count only additional dropoff orders. Keep the existing atomic claim guard.
6. Do not merge `atomic_v1` offers until the atomic schema supports a
   multi-order assignment/version contract. For now the policy can hold or
   dispatch atomic single orders, while corridor bundling remains on the
   existing Phase-5 batch writer.
7. Log the full pure decision in `reason_data`. Roll back by removing the flag;
   existing Phase-4/5 behavior remains unchanged.

## Verification

- `scripts/tests/intelligent-dispatch.test.ts`
- `scripts/tests/long-distance-batching.test.ts`
- targeted TypeScript check and `git diff --check`
