# Acceptance Gates

## G0 — Baseline and isolated environment

Green only when:

- every pre-existing dirty/untracked file is inventoried and safely reproducible;
- an isolated remediation branch/worktree exists;
- package-manager choice is documented and lockfile ambiguity is resolved without deleting evidence;
- lint is non-interactive;
- focused typecheck/tests run reproducibly;
- a local or isolated schema-compatible database test path exists, or the exact blocker is documented;
- no production operation occurred.

## G1 — Canonical domain contract

Green only when:

- one canonical table/authority is chosen for order, driver, trip, assignment, kitchen and GPS current state;
- state/transition tables define expected state, actor, side effects, timeout, idempotency and audit event;
- normal driver rejection is absent from the target contract;
- safety exceptions and reassignments are explicit;
- compatibility semantics for old app/API are documented;
- contract tests exist and fail for current invalid behavior where appropriate.

## G2 — Atomic single writer

Green only when an isolated database proves:

- two or more concurrent workers cannot create two active assignments for one order;
- retries with the same idempotency key return the original result;
- injected failure at every write step leaves no partial batch/stop/order/driver state;
- tenant writer election permits exactly one active writer;
- stale expected-state/version transitions fail safely;
- assignment, trip/stops, order claim, audit and outbox commit atomically;
- rollback/disable path is documented and tested.

Target stress evidence: at least 100 repeated two-session races without duplicate active assignment.

## G3 — Server-authoritative API boundary

Green only when:

- no critical driver UI flow directly mutates canonical lifecycle tables;
- all critical actions use authenticated versioned APIs/RPCs;
- action IDs and expected versions are enforced;
- reconnect/app restart restores state from a canonical snapshot;
- old-client behavior is tested and safely constrained;
- RLS denies unauthorized direct writes in isolated tests.

## G4 — Pick, pickup, recovery and messaging correctness

Green only when:

- a trip cannot depart until every assigned order and required item has a server-resolved outcome;
- “missing” is not equivalent to “present”; it requires explicit resolution;
- multi-order pickup completes atomically;
- duplicate/offline actions are idempotent;
- one versioned offline outbox format exists;
- push loss, duplicate push and out-of-order events recover from server state;
- technical app acknowledgment is recorded without granting a normal decline decision.

## G5 — GPS reliability contract

Green only when:

- GPS events include session, sequence, captured time, received time, accuracy and app/platform version;
- delayed older points cannot overwrite newer current state;
- database errors are checked and observable;
- bounded offline replay is idempotent;
- invalid/impossible/low-quality points have documented handling;
- active dispatch excludes stale/untrusted locations;
- iOS and Android lifecycle tests cover foreground, background, locked screen, network loss and platform restart limits;
- tracking is limited to approved operational states and retention is configurable.

## G6 — Deterministic dispatch baseline

Green only when:

- it runs only through the canonical writer;
- every candidate exclusion and score component is auditable;
- stale GPS, capacity, state, tenant, deadline and current route are enforced;
- replaying the same snapshot produces the same decision;
- shadow mode compares decisions without mutating live assignments;
- no deadline-unsafe assignment is selected in the simulation suite;
- no reassignment thrash occurs.

## G7 — Routing, batching and kitchen hold

Green only when:

- road-route ETA or a documented conservative fallback is used;
- new orders are inserted only when all pickup and delivery windows remain feasible;
- existing customers' maximum detour/late-risk constraints are respected;
- kitchen readiness, prep estimate and driver ETA are inputs;
- `kitchen_release_at`/hold deadline is persisted and idempotent;
- cancellation, restart and duplicate release are tested;
- a watchdog releases or escalates overdue holds;
- hold decisions are stable but re-evaluated on material events;
- the global hard cap is configurable and production defaults remain conservative until replay data proves safety.

## G8 — Operations, security and observability

Green only when:

- correlation IDs connect order, assignment, trip, driver, GPS and push events;
- duplicate assignment, stale GPS, overdue hold, push no-ACK, queue backlog and delayed delivery alerts exist;
- manual override requires reason, actor, expected version and audit trail;
- kill switches and per-tenant feature flags exist;
- security/RLS contract tests pass;
- sensitive location data is minimized and retention policy is configurable.

## G9 — Release readiness

Green only when:

- full order-to-delivery E2E passes;
- concurrency, duplicate, out-of-order, cancellation, restart, two-store and old-app scenarios pass;
- real-device iOS and Android matrices pass to the documented platform limits;
- load/replay tests meet agreed latency and correctness thresholds;
- migration dry run and rollback pass;
- build SHA is traceable in backend and apps;
- canary plan, monitoring thresholds and automatic rollback criteria exist;
- production remains untouched until explicit human approval.
