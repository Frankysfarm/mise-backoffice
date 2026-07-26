# ADR-001 — Canonical delivery authorities and Atomic-v2 state model

- Status: Accepted as architecture contract; runtime activation is not authorized
- Date: 2026-07-26
- Contract version: `atomic-v2-contract`
- Scope: T01 only

## Context

The audited system has no single source of truth. `customer_orders`,
`driver_status`, `mise_drivers`, Legacy batches/stops, Mise batches/stops and
optional Atomic-v1 assignments can disagree. Several browser/API paths update
critical rows without expected-state/version checks. Atomic-v1 is the only
existing foundation with tenant writer election, transactional assignment,
idempotency and compare-and-swap, but its `offered -> accepted|declined`
semantics conflict with the product decision that assignment is
server-authoritative.

Creating another parallel lifecycle would deepen that conflict. The target is
therefore an evolution of Atomic-v1, called Atomic-v2 in this contract.

## Decision

Each tenant has one elected server writer. The following rows are authoritative
after that tenant's explicit cutover:

| Aggregate | Canonical authority | Version/order key | Legacy compatibility only |
|---|---|---|---|
| Order | `customer_orders` | `dispatch_version` | Legacy/English status aliases are projections |
| Driver operational state | `mise_drivers` | target `state_version` | `driver_status` is read-only |
| Trip/batch | `mise_delivery_batches` | target `state_version` for lifecycle CAS; existing `route_version` only for route/stop-order CAS | `delivery_batches` is read-only |
| Stop | `mise_delivery_batch_stops` | target `stop_version` | `delivery_batch_stops` is read-only |
| Assignment | `dispatch_offer_assignments`, evolved in place | `assignment_version` | order assignment columns are denormalized projections |
| Kitchen/preparation | `kitchen_timings` | target `kitchen_version` | order status is an aggregate projection |
| GPS current | target `mise_driver_position_current` | `position_version` plus session/sequence | coordinates on `mise_drivers`/`driver_status` are projections |
| GPS history | `mise_driver_locations` | unique driver/session/sequence | `driver_gps_trail` is read-only |
| Notification outbox | `mise_push_outbox`, evolved in place | target `attempt_version` and lease | `driver_push_outbox` is read-only |
| Lifecycle audit | `dispatch_offer_audit`, evolved to a generic event ledger | immutable event ID | Frank/score logs remain historical evidence |

“Target” columns/table names are contract requirements for later tasks, not a
claim that they exist now. T01 creates no migration.

## State ownership

The canonical state sets are:

- Order: `scheduled`, `held`, `confirmed`, `preparing`, `ready`, `assigned`,
  `picked_up`, `out_for_delivery`, `delivered`, `cancelled`.
- Driver: `offline`, `available`, `assigned`, `at_pickup`, `delivering`,
  `returning`, `exception`.
- Assignment: `unassigned` (conceptual absence), `assigned`, `picked_up`,
  `in_progress`, `completed`, `cancelled`, `reassigned`.
- Trip: `planned`, `assigned`, `at_pickup`, `ready_to_depart`, `in_progress`,
  `paused`, `completed`, `cancelled`.
- Stop: `pending`, `arrived`, `servicing`, `completed`, `cancelled`.
- Kitchen: `scheduled`, `released`, `preparing`, `ready`, `picked_up`,
  `cancelled`.
- GPS health: `unavailable`, `fresh`, `warning`, `stale`.
- Driver exception: `none` (conceptual absence), `reported`, `triaged`,
  `mitigating`, `reassignment_required`, `resolved`, `closed`.
- Notification outbox: `pending`, `leased`, `sent`, `retry_wait`,
  `dead_letter`.

The normative transition definitions are machine-checkable declarative data in
`lib/delivery/canonical-state-contract.ts`. Every definition includes actors,
expected state and typed current/expected authority versions, validation,
atomic effects, idempotency, audit, timeout/recovery and old-client
compatibility. Trip attempts require distinct lifecycle `tripStateVersion` and
route `routeVersion` evidence; stop attempts require `stopVersion` and the
related `tripRouteVersion`. The pure deciders validate only the evidence passed
to them; they do not implement or prove database effects.

Action-specific evidence is a closed union. Technical ACK structurally requires
the acknowledged `snapshotVersion`; exception report structurally requires one
of the exact seven exception kinds; and GPS ingest structurally requires the
complete three-way classifier evidence. Missing, conflicting or
action-inappropriate evidence is rejected with a specific reason.

Dispatcher transitions structurally require `reasonCode`, `note`, `actorId`,
expected state/authority versions and action ID, and every such transition
names its audit event. System/watchdog actors cannot impersonate a manual
override.

## Assignment and ACK semantics

Assignment creation is the decision. It atomically creates an `assigned`
assignment/trip/stops, claims the order and driver, writes audit, and enqueues a
wake-up notification. The driver does not accept or reject normal work.

`ack_receipt` is technical receipt only:

- it requires the owning driver, exact assignment snapshot version and a stable
  receipt key;
- it records receipt timestamp and app/device metadata;
- it does not change assignment, trip, order, stop or driver state;
- it does not increment `assignment_version`;
- missing ACK retries/wakes/escalates but never releases the assignment.

Atomic-v1 `accept` may be translated to this receipt operation only during the
documented compatibility window. Atomic-v1 `decline` has no target transition;
the compatibility response is a 409 with a fresh canonical snapshot and the
exact seven supported exception kinds.

## Structured driver exceptions

Only these categories are accepted:

- medical/safety emergency;
- vehicle failure;
- accident/road closure;
- location permission/GPS failure;
- network/device failure;
- invalid shift;
- dispatcher-authorized break.

Reporting declares an immutable exception event, driver/trip hold, preservation
of the active assignment and an operations alert. Resolution targets are
enumerated transitions; there is no dynamic `resume_state` string.

Only supervised pre-pickup reassignment with proven `custody=not_acquired` is
specified. Its declared transaction terminalizes the old assignment as
`reassigned`, creates the replacement `assigned`, replaces trip/open stops,
keeps the order assigned to only the replacement, leaves the old driver in
`exception`, assigns the replacement driver, and writes old/new audit/outbox
records.

Reassignment from `picked_up` or `in_progress` is default-off because custody
and handoff semantics are not approved. The old assignment remains active, the
trip/driver stay on structured exception hold, and a dispatcher is escalated.
No target transition may infer a goods handoff. Automatic reassignment is also
default-off.

## GPS decision

GPS ingest has three explicit outcomes:

1. `monotonic_current_advance`: accepted history plus current-row/version
   advance, but only when the caller supplies same-session increasing
   sequence/time evidence or an explicitly authorized successor session;
2. `valid_history_only`: accepted idempotent history with no current/health
   state or version change when successor evidence is absent, older or
   duplicate;
3. `rejected`: rejection audit only; no accepted history and no current change.

The pure GPS decider classifies only its explicit validation/session evidence.
It does not claim monotonicity from a generic “valid” packet.

Staging defaults are warning/stale at 45/90 seconds for active work and 90/180
seconds for idle/returning. They are tenant-configurable. Stale GPS prevents a
new assignment; it never abandons active work. Production retention is
configuration-driven and remains unapproved/default-off.

## Consequences

- T02 can evolve Atomic-v1 constraints/RPCs rather than create a new writer.
- T03 can make old APIs translation boundaries and deny direct critical writes.
- T04 consumes explicit trip/stop/pick invariants.
- T05 consumes the receipt/outbox and exception contracts.
- T06 owns the target GPS current table and monotonic ingestion implementation.
- Existing clients remain unchanged until a tenant is gated through cutover.
- Ambiguous legacy rows are quarantined or require contextual reconciliation;
  they are never guessed into an active canonical state.

## Rejected alternatives

- Keep `driver_status` and `mise_drivers` as co-authorities: rejected because
  non-transactional synchronization cannot define conflict precedence.
- Treat push or local client state as authority: rejected because delivery is
  lossy and clients restart/offline.
- Preserve normal offer decline: rejected by the product decision and G1.
- Introduce new trip/assignment tables: rejected because Atomic-v1 already
  provides the closest transactional foundation.
