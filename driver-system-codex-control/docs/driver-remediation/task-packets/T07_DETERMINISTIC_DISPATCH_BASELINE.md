# T07 — Deterministic Dispatch Baseline

## Objective

Select the best eligible driver through one atomic writer with reproducible, auditable decisions before advanced routing/hold optimization.

## Required implementation

1. Integrate only with the canonical writer/assignment transaction.
2. Pure candidate snapshot and pure scoring function; side effects occur only after winner selection.
3. Mandatory eligibility:
   - active tenant membership and shift;
   - allowed driver state;
   - trustworthy fresh GPS;
   - vehicle/capacity;
   - no blocking exception;
   - current route/load;
   - pickup and delivery deadline feasibility;
   - writer/feature gate.
4. Deterministic tie-breaker.
5. Strong lateness/deadline penalty dominates fairness.
6. Candidate audit includes every exclusion reason and score component.
7. Stability rule prevents reassignment thrash.
8. Shadow mode computes decisions without mutating assignment state.
9. Replay harness uses recorded/synthetic snapshots and compares decisions.
10. Legacy paths may remain readable for compatibility but cannot concurrently write.

## Mandatory tests

- one/multiple drivers;
- stale/no GPS;
- capacity full;
- offline/exception;
- two stores;
- deadline impossible;
- deterministic repeat;
- fairness tie only;
- current route workload;
- shadow mode no mutation;
- concurrent tick still one assignment.

## Acceptance

Gate G6 green. Do not yet activate advanced batching/hold in production.
