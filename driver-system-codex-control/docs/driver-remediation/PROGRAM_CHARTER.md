# Program Charter: Driver & Dispatch Remediation

## Outcome

Create a production-ready delivery control plane in which server-side state, not UI behavior or push receipt, determines the assignment and lifecycle of every order.

## Non-goals before correctness gates

- no production activation of Atomic-v1 or intelligent 20 km behavior;
- no new visual redesign unrelated to correctness;
- no optimization of scoring weights before replay evidence;
- no 10–15 minute dynamic hold in production before persistent deadlines and product-quality constraints exist;
- no broad framework rewrite.

## Canonical capabilities to deliver

- one writer per tenant;
- atomic assignment/reassignment;
- canonical state machines;
- no normal decline path for drivers;
- explicit safety exceptions;
- multi-order trip correctness;
- monotonic GPS and native background tracking where technically permitted;
- push/realtime recovery by server snapshot;
- deadline-aware route insertion and kitchen release;
- auditable decisions and manual emergency override;
- isolated staging, simulation, race tests, device tests, canary and rollback.

## Source evidence from the audit

The program is based on these proven findings:

- parallel `delivery_*`/`driver_status` and `mise_delivery_*`/`mise_drivers` worlds;
- Legacy DB, Frank DB RPC, Frank JS, and optional Atomic-v1 writer paths;
- separate non-atomic Legacy writes for batch/stops/order assignment;
- direct Supabase client writes in the driver UI;
- missing native background-location implementation;
- missing complete E2E/concurrency/device release gate;
- default-off intelligent scorer and long-distance policy;
- non-persisted long-distance `holdUntil`.

## Delivery principle

Every phase first creates a contract and a failing test, then implements the smallest change that satisfies the contract, then proves rollback and compatibility. No phase is accepted solely from code review.
