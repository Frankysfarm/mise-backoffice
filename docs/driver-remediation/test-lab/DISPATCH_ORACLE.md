# Independent Dispatch Oracle

## Purpose and boundary

The test-lab oracle is a small-N reference solver. It lives under
`tests/driver-system-lab/oracle/` and deliberately imports no application or
production optimizer module. Its data structures, route enumeration and
lexicographic reference objective are independent. It is read-only and has no
database, network, provider, LLM or mutation seam.

The oracle is a quality comparator, not a production dispatcher. It cannot
authorize an assignment, route, push or departure.

## Model

Inputs describe candidate orders, drivers, a directed street-time fixture and
a deterministic minute clock. Candidate generation enforces tenant, duty,
session, GPS, route feasibility, remaining capacity, same-store/single-pickup,
driver-wait, shift-end, delivery deadline and optional product-quality windows.
Terminal, held and already assigned orders are outside the candidate set.

For each driver and same-store order subset, the solver fully enumerates every
drop-off permutation. Pickup is structurally first. A route with a missing
matrix edge, late delivery, quality-window breach or shift-end breach is
rejected. Global exhaustive set-packing then selects conflict-free options:
one option per driver and each order at most once.

The reference objective is lexicographic and separately implemented:

1. maximize assigned feasible orders;
2. favor rescue of older waiting orders;
3. maximize worst deadline slack;
4. minimize street time;
5. minimize kitchen wait;
6. minimize prior driver workload;
7. stable `driver|orders|route` identifier tie-break.

Hard constraints are never represented as soft penalties. This objective is
intentionally not a copy of `adaptive-dispatch-optimizer.ts`.

## Reproducibility and property coverage

`dispatch-oracle.test.ts` covers terminal exclusion, global conflict freedom,
pickup precedence, stable ties and the mandatory metamorphic relations:
ineligible-order addition, relaxed deadlines, increased capacity, increased
distance, increased prep time, order removal and terminal-order exclusion.
It also executes 500 deterministic seeds. Each failure reports its seed and a
minimized order set; `minimizeArrayFailure` provides deterministic shrinking.

Focused command:

```bash
./node_modules/.bin/tsx --test tests/driver-system-lab/oracle/dispatch-oracle.test.ts
```

## Production comparison contract

The lab orchestrator should translate a validated scenario independently into
both production input and `OracleInput`, then compare normalized assignments.
A production hard-constraint violation is P0. For small N, a differing feasible
decision must expose its objective delta and configured tolerance rather than
being silently accepted. The complete oracle input, output, seed and candidate
rejections belong in the run evidence.

The exhaustive search is deliberately bounded by scenario design (normally no
more than four orders per store in commit tests). Large-N load tests use quality
metrics and do not claim oracle optimality.
