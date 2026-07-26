# Canonical delivery contract — Atomic-v2

This document is the declarative implementation contract consumed by T02–T06.
The machine-checkable definitions are in
`lib/delivery/canonical-state-contract.ts`. They provide pure classification and
shape/graph checks; they do not execute or prove database transactions, API/RLS
behavior, device transport or recovery. If prose and declarative data differ,
the contract must be corrected before later implementation.

No flag, writer gate, database schema or production behavior is changed by T01.

## Universal mutation envelope

Every critical mutation carries:

```json
{
  "action_id": "client-or-server UUID",
  "expected_state": "canonical current state",
  "authority_versions": {
    "aggregateAuthorityName": {
      "current": 7,
      "expected": 7
    }
  },
  "evidence": {"kind": "none"},
  "occurred_at": "device/event time when applicable",
  "payload": {}
}
```

The authority map is structural, not an open-ended bag. Its exact key set is
selected by aggregate: `orderDispatchVersion`, `driverStateVersion`,
`assignmentVersion`, `tripStateVersion` plus `routeVersion`, `stopVersion` plus
`tripRouteVersion`, `kitchenVersion`, `positionVersion`, `exceptionVersion` or
`attemptVersion`. Each authority carries both the observed `current` and caller
`expected` value. Omitting a required authority is
`EXPECTED_AUTHORITY_EVIDENCE_MISSING`; unequal values are
`EXPECTED_AUTHORITY_VERSION_CONFLICT`.

The `evidence` union is also structural. Ordinary actions require
`{"kind":"none"}`. Assignment receipt requires `assignment_ack` with
`snapshotVersion`; exception report requires `driver_exception_report` with one
exact `exceptionKind`; GPS ingest requires `gps_ingest` with the complete
classifier input. Missing, mismatched or unexpected action evidence is rejected
before a transition is selected.

The server authenticates the actor and tenant, checks exact state and every
declared authority version, validates aggregate-specific preconditions, and
executes all listed effects in one transaction. The server generates a
correlation ID and returns it in every success/error response; a client cannot
select it. A successful state-changing mutation increments the aggregate's
primary version once and returns the new version. Reusing the same action ID and
same request fingerprint returns the original result. Reusing it for a
different request is a conflict. No failed mutation may leave partial effects.

Technical receipt ACK and rejected GPS packets are the two explicit
same-state/version-unchanged operations. Valid-history-only GPS ingest is a
third. They still require expected state/authority versions and an action ID.

For trips, `state_version` is the lifecycle CAS authority and `route_version`
is independently the route/stop-order CAS authority. Trip actions carry
distinct `tripStateVersion` and `routeVersion` current/expected pairs; changing
one never silently substitutes for the other. Stop actions similarly carry
`stopVersion` and the related trip's `tripRouteVersion`.

Every transition that allows actor `dispatcher` has a structural manual
override requirement: non-empty `reasonCode`, `note`, authenticated `actorId`,
exact expected state/authority versions, action ID and the declared audit
event. The pure transition decider rejects a dispatcher attempt without these
fields.

## Transition tables

The following tables are the compact state graph. For every row, exact
validation, atomic effects, idempotency scope, audit event, timeout/recovery and
compatibility behavior are mandatory fields in the executable transition
table.

### Order

| Action | From → to | Actor |
|---|---|---|
| `release_schedule` | `scheduled → confirmed` | watchdog, dispatcher |
| `place_dispatch_hold` | `confirmed → held` | dispatch writer |
| `release_dispatch_hold` | `held → confirmed` | watchdog, writer, dispatcher |
| `start_preparation` | `confirmed → preparing` | kitchen, watchdog |
| `mark_ready` | `preparing → ready` | kitchen |
| `assign` | `ready → assigned` | elected writer, dispatcher override |
| `confirm_pickup` | `assigned → picked_up` | driver |
| `depart_pickup` | `picked_up → out_for_delivery` | driver |
| `confirm_delivery` | `out_for_delivery → delivered` | driver |
| `cancel` | any non-picked terminal-compatible state → `cancelled` | customer API, dispatcher, system |

Order assignment commits assignment, trip, stops, order claim, driver load,
audit and outbox atomically. Cancellation of assigned work includes the
corresponding release/compensation transaction.

### Driver

| Action | From → to | Actor |
|---|---|---|
| `start_shift` | `offline → available` | driver |
| `end_shift` | `available|returning → offline` | driver, dispatcher, watchdog |
| `reserve_for_assignment` | `available|returning → assigned` | writer, dispatcher |
| `arrive_pickup` | `assigned → at_pickup` | driver, server geofence |
| `depart_pickup` | `at_pickup → delivering` | driver |
| `finish_trip` | `delivering → returning` | driver, system |
| `become_available` | `returning → available` | driver, system |
| `enter_exception` | active state → `exception` | driver, dispatcher, system |
| `resolve_exception_offline` | `exception → offline` | dispatcher, system |
| `resolve_exception_available` | `exception → available` | dispatcher, system |
| `resume_exception_assigned` | `exception → assigned` | dispatcher, system |
| `resume_exception_at_pickup` | `exception → at_pickup` | dispatcher, system |
| `resume_exception_delivering` | `exception → delivering` | dispatcher, system |
| `resume_exception_returning` | `exception → returning` | dispatcher, system |

Heartbeat timeout may make an idle driver offline. It may not abandon an active
trip; active-work loss becomes an exception/escalation.

### Assignment

| Action | From → to | Actor | Special rule |
|---|---|---|---|
| `assign` | conceptual `unassigned → assigned` | writer, dispatcher | assignment is immediately authoritative |
| `ack_receipt` | active state → same state | owning driver app | receipt metadata only; no version increment |
| `confirm_pickup` | `assigned → picked_up` | driver | server pick completeness |
| `start_delivery` | `picked_up → in_progress` | driver | all assigned picks complete |
| `complete` | `in_progress → completed` | driver, system | canonical dropoff result |
| `cancel_before_pickup` | `assigned → cancelled` | dispatcher, system | custody must be `not_acquired` |
| `reassign_before_pickup` | `assigned → reassigned` plus replacement `assigned` | dispatcher | supervised, exception-linked, custody `not_acquired` |

There is no `accept`, `decline`, offer lease expiry or “no response means
release” transition in the target contract.

`reassign_before_pickup` declares one transaction: old assignment becomes
`reassigned`; replacement assignment is `assigned` version 1; old trip/open
stops are cancelled when no other assignment remains; replacement trip/stops
are `assigned`/`pending`; the order remains `assigned` and references only the
replacement; old driver remains `exception`; replacement driver becomes
`assigned`; audit/outbox includes both identities.

For `picked_up` and `in_progress`, reassignment/cancellation is not declared.
Custody/handoff policy is unknown, so it is default-off. The supervised path is
structured exception plus paused trip, preserved old assignment and dispatcher
escalation. No replacement or handoff is inferred.

### Trip

| Action | From → to | Actor |
|---|---|---|
| `assign` | `planned → assigned` | writer, dispatcher |
| `arrive_pickup` | `assigned → at_pickup` | driver, system |
| `complete_pick` | `at_pickup → ready_to_depart` | driver |
| `depart` | `ready_to_depart → in_progress` | driver |
| `complete` | `in_progress → completed` | driver, system |
| `pause_for_exception` | active state → `paused` | driver, dispatcher, system |
| `resume_to_assigned` | `paused → assigned` | dispatcher, system |
| `resume_to_at_pickup` | `paused → at_pickup` | dispatcher, system |
| `resume_to_ready_to_depart` | `paused → ready_to_depart` | dispatcher, system |
| `resume_to_in_progress` | `paused → in_progress` | dispatcher, system |
| `cancel` | `planned|assigned|at_pickup → cancelled` | dispatcher, system |

Trip departure is impossible until every assigned order and required item has a
server-resolved outcome. Trip cancellation at `at_pickup` additionally requires
`custody=not_acquired`; `ready_to_depart` and `in_progress` are not cancellable
by this table. The client cannot reorder the next stop.

### Stop

| Action | From → to | Actor |
|---|---|---|
| `arrive` | `pending → arrived` | driver, system |
| `start_service` | `arrived → servicing` | driver |
| `complete` | `servicing → completed` | driver |
| `cancel` | open state → `cancelled` | dispatcher, system |

All actions require the server-selected stop and exact route/stop versions.
Completion atomically advances the related order, assignment and trip.

### Kitchen

| Action | From → to | Actor |
|---|---|---|
| `release` | `scheduled → released` | watchdog, writer, dispatcher |
| `start_preparation` | `released → preparing` | kitchen |
| `mark_ready` | `preparing → ready` | kitchen |
| `confirm_pickup` | `ready → picked_up` | driver |
| `cancel` | non-terminal state → `cancelled` | dispatcher, system |

Release uses persistent `next_evaluation_at` and an absolute deadline. The hard
cap is configurable up to 15 minutes; the initial default is 5 minutes. No hold
may cross an order deadline margin. The watchdog must release or escalate.

### GPS

| Action | From → to | Actor | Atomic rule |
|---|---|---|---|
| `ingest_advance_current` | any health state → `fresh` | GPS device, system | accepted history and current advance only after explicit successor evidence |
| `ingest_history_only` | any → same | GPS device, system | valid accepted history; current/health/version unchanged |
| `reject_position` | any → same | GPS device, system | rejection audit; no accepted history/current change |
| `mark_warning` | `fresh → warning` | watchdog | retain last trusted coordinates |
| `mark_stale` | `warning → stale` | watchdog | exclude only from new assignment |
| `mark_unavailable` | trusted health state → `unavailable` | device, app, watchdog | preserve last trusted history |

The obsolete generic `ingest_position` action is absent. The pure classifier
returns exactly one of `monotonic_current_advance`, `valid_history_only` or
`rejected`. It advances only for same-session increasing sequence plus
non-regressing capture time, or an externally authorized successor session.
Valid older/duplicate/unknown-session packets are history-only. Invalid
evidence/quality is rejected. Position validation also includes coordinates,
accuracy and configured quality/impossible-jump policy; unapproved thresholds
remain configurable/default-off.

### Driver exception

| Action | From → to | Actor |
|---|---|---|
| `report` | conceptual `none → reported` | driver, dispatcher, system |
| `triage` | `reported → triaged` | dispatcher |
| `start_mitigation` | `triaged → mitigating` | dispatcher, system |
| `require_reassignment` | active exception → `reassignment_required` | dispatcher, watchdog |
| `resolve` | active exception → `resolved` | dispatcher, system |
| `close` | `resolved → closed` | dispatcher, system |

Allowed kinds are exactly: `medical_safety_emergency`, `vehicle_failure`,
`accident_road_closure`, `location_permission_gps_failure`,
`network_device_failure`, `shift_invalid` and
`dispatcher_authorized_break`.

An exception preserves ownership until an explicit enumerated resolution
succeeds. `require_reassignment` is a workflow/escalation state, not proof that
replacement is allowed: post-pickup remains blocked as described above.

### Notification outbox

| Action | From → to | Actor |
|---|---|---|
| `lease` | `pending|retry_wait → leased` | worker/watchdog |
| `mark_sent` | `leased → sent` | provider worker |
| `schedule_retry` | `leased → retry_wait` | worker/watchdog |
| `dead_letter` | `leased|retry_wait → dead_letter` | worker/watchdog |

Provider success is not app receipt. Push only wakes the app; the versioned
snapshot is authoritative.

## Target assignment flow

1. The elected writer locks the tenant and validates order, driver, GPS,
   capacity, route and deadlines against exact versions.
2. One transaction creates the `assigned` assignment, trip and stops; advances
   order and driver/load; writes the audit decision; and inserts the outbox row.
3. The app receives push/realtime or reconnects and fetches the canonical
   snapshot.
4. The app sends `ack_receipt` for that snapshot. The receipt changes no
   operational state or version.
5. Missing receipt causes bounded notification retry and operations escalation.
   The assignment remains visible and active.
6. Driver work mutations use action IDs and exact aggregate versions.
7. A safety/operational problem uses the exception flow, never decline.

## Legacy/Mise/Atomic mapping

The complete declarative mapping is checked against an independent constant
oracle in `canonical-state-contract.test.ts`; that oracle is not generated from
the mapping under test. It includes:

| Source | Source state | Canonical target | Handling |
|---|---|---|---|
| `customer_orders.status` | `neu`, `bestätigt`, `pending`, `confirmed`, `released` | `confirmed` | direct; `released` becomes historical event |
| same | `scheduled` | `scheduled` | direct with persistent deadline |
| same | `in_zubereitung`, `preparing` | `preparing` | direct |
| same | `fertig`, `ready`, `bereit_zur_lieferung` | `ready` | direct |
| same | `picked_up` | `picked_up` | direct |
| same | `abgeholt` | `picked_up` | delivery context required/default-off |
| same | `unterwegs` | `out_for_delivery` | direct |
| same | `geliefert`, `delivered` | `delivered` | direct |
| same | `abgeschlossen` | `delivered` | delivery context required/default-off |
| same | `storniert`, `cancelled`, `abgebrochen` | `cancelled` | direct |
| same | `abgelehnt`, `rejected` | `cancelled` | terminal history only; no target driver decline |
| `mise_drivers.state` | `offline` | `offline` | direct |
| same | `idle` | `available` | rename |
| same | `assigned` | `assigned` | direct |
| same | `at_restaurant` | `at_pickup` | rename |
| same | `en_route` | `delivering` | rename |
| same | `returning` | `returning` | direct |
| `driver_status.ist_online` | false | `offline` | cutover projection |
| same | true | `available` or active state | reconcile assignment/trip; default-off if ambiguous |
| `driver_status.aktueller_batch_id` | null | `offline`, `available` or `returning` | session/trip context required/default-off |
| same | non-null | `assigned`, `at_pickup`, `delivering` or `exception` | batch phase context required/default-off |
| Mise/bridge trip | `pending_acceptance` | `assigned` | gated conversion; no acceptance wait |
| same | `assigned` | `assigned` | direct |
| same | `at_restaurant` | `at_pickup` | rename |
| same | `picked_up` | `ready_to_depart` | departure not yet proven |
| same | `in_progress`, `completed`, `cancelled` | same | direct |
| Legacy `delivery_batches.status` | `pickup` | `planned` or `assigned` | driver/claim context required/default-off |
| Legacy/bridge `delivery_batches.state` | `pending_acceptance`, `assigned`, `at_restaurant`, `picked_up`, `in_progress`, `completed`, `cancelled` | corresponding canonical trip state | direct/rename/conversion |
| Atomic assignment | `offered`, `accepted` | `assigned` | drain or gated atomic conversion |
| same | `declined`, `expired` | `cancelled` | terminal history only |
| same | `picked_up`, `in_progress`, `completed`, `cancelled` | same | direct |
| Mise stop | neither arrived nor completed | `pending` | direct |
| same | arrived, not completed | `arrived` | servicing remains unknown/default-off |
| same | completed | `completed` | direct |
| Legacy stop | `geliefert_am` null/non-null | `pending/completed` | open row has no arrival/service distinction |
| Migration-004 bridge stop | row without `geliefert_am` | `pending` | sequence only; contextual/default-off |
| `kitchen_timings` | `scheduled`, `cooking`, `ready`, `picked_up` | `scheduled`, `preparing`, `ready`, `picked_up` | direct/rename |
| GPS lifecycle | `offline`, `permission_error`, `offline_network` | `unavailable` | retain reason |
| same | `watching` | `unavailable` | no trusted point proven |
| same | `fresh` | `fresh` | only after monotonic/quality validation |
| same | `stale` | `stale` | direct |
| `mise_push_outbox` | unsent/unfailed | `pending` | add lease/attempt semantics |
| same | sent | `sent` | provider send only |
| same | failed | `retry_wait` or `dead_letter` | retry context required/default-off |
| `driver_push_outbox` | unsent/no error | `pending` | cutover conversion |
| same | sent/no error | `sent` | provider send only |
| same | error | `retry_wait` or `dead_letter` | retry context required/default-off |

Unknown strings are not coerced. The tenant remains on its existing writer, and
the row is quarantined for reconciliation.

## Current compatibility-gap fixture

T01 inventories, but does not edit, the current bridge:

- `orders/accept` and `me/accept-tour` operationally change
  `pending_acceptance`/`offered` to `assigned`/`accepted`;
- `offers/transition` allows both `accept` and `decline`;
- `atomic-offer-client-state.ts` exposes both actions and clears local state on
  successful decline;
- `client.tsx` invokes operational Atomic `accept` while claiming a batch;
- `offers/ack` plus `native-offer-bridge.tsx` provide a technical receipt, but
  it is limited to Atomic-v1 `offered`.

`CURRENT_COMPATIBILITY_BRIDGE_FIXTURES` records the exact source files and the
expected current-invalid diagnostics. Its pure diagnostic reports
`CURRENT_ACCEPT_IS_OPERATIONAL_DECISION`, `CURRENT_DECLINE_EXPOSED` or
`CURRENT_ACK_LIMITED_TO_OFFERED_V1`. These are expected gap evidence, not a
failing build and not a claim that T01 fixed the current API/client.

The target bridge decider is explicit: legacy `accept` translates to
`ack_receipt` with state/version unchanged; legacy `decline` returns HTTP 409
`DRIVER_DECLINE_NOT_SUPPORTED` with a fresh canonical snapshot and the exact
seven supported exception kinds.

## Compatibility and cutover

Cutover is tenant-scoped and default-off:

1. Inventory the deployed backend, migrations, writer gate and app/TestFlight
   versions. Unknown deployment state blocks cutover.
2. Add schema/invariants and translation APIs without enabling the writer.
3. Backfill versions and build read-only canonical projections. Unknown or
   context-dependent mappings are quarantined.
4. Shadow-compare legacy and canonical snapshots; do not dual-write.
5. Drain Atomic-v1 `offered` rows and Legacy `pending_acceptance` work, or
   convert each under tenant lock with audit. No active row is bulk-guessed.
6. Require no conflicting active Legacy/Mise claims, then atomically elect
   Atomic-v2 for the tenant.
7. New clients use snapshot, receipt ACK, exception and versioned action APIs.
8. During the bounded old-app window:
   - old `accept` translates to `ack_receipt` and returns the same active state;
   - old `decline` returns `409 DRIVER_DECLINE_NOT_SUPPORTED` plus the current
     snapshot and supported exception kinds;
   - old push payloads receive `requires_acceptance=false`;
   - direct legacy critical writes are denied once G3 RLS/API gating is ready.
9. Observe conflicts, snapshot divergence, ACK/outbox and exception SLAs.
10. Rollback stops new Atomic-v2 creation, drains active work on the current
    writer, and only then switches the tenant gate. Active assignments are never
    rewritten by a flag flip.

## Database invariants

1. One enabled writer per tenant; switch and assignment share the tenant lock.
2. At most one active assignment per order and no incompatible active
   assignment per driver, enforced by database constraints.
3. Assignment, trip, stops, order claim, driver load, audit and outbox are one
   transaction.
4. Critical aggregate versions are non-negative and monotonic. Trip lifecycle
   uses `state_version`; route/stop order uses independent `route_version`.
5. Action keys are uniquely scoped; their request fingerprint/result is
   immutable.
6. Receipt ACK changes metadata only, not operational state/version.
7. Driver decline does not exist. Only supervised pre-pickup reassignment is
   declared; post-pickup custody/handoff remains blocked/default-off.
8. Departure requires server-resolved outcomes for all assigned orders/items.
9. Stop order is server-authoritative and protected by `route_version`.
10. GPS history is unique by driver/session/sequence. Current position advances
    only after explicit successor evidence; other valid packets are
    history-only and invalid packets are rejected.
11. Event and receipt time are stored separately.
12. Scheduled release, holds, freshness, leases and exception escalation have
    persistent deadlines.
13. Browser/mobile roles cannot directly write canonical lifecycle rows.
14. Push/outbox is not authority; clients recover from snapshots.
15. Dispatcher overrides structurally require authenticated actor ID,
    `reasonCode`, note, expected state/authority versions, action ID and
    declared audit.
16. Retention is configured; production GPS retention is not activated without
    an approved policy.

## API contract draft

All endpoints authenticate driver/tenant server-side and return
`correlation_id`.

### Snapshot

`GET /api/driver/v2/snapshot`

```json
{
  "contract_version": "atomic-v2-contract",
  "snapshot_version": 42,
  "driver": {"state": "assigned", "version": 8},
  "assignments": [{"id": "uuid", "state": "assigned", "version": 3}],
  "trip": {
    "id": "uuid",
    "state": "assigned",
    "state_version": 5,
    "route_version": 8
  },
  "stops": [],
  "active_exception": null
}
```

### Technical receipt

`POST /api/driver/v2/assignments/{id}/receipt`

```json
{
  "action_id": "uuid",
  "expected_state": "assigned",
  "authority_versions": {
    "assignmentVersion": {"current": 3, "expected": 3}
  },
  "evidence": {
    "kind": "assignment_ack",
    "snapshotVersion": {"current": 42, "expected": 42}
  },
  "observed_at": "2026-07-26T12:00:00Z",
  "app": {"version": "string", "platform": "ios", "device_id": "opaque"}
}
```

Success returns state/version unchanged and `receipt_recorded=true`.

### Driver/trip/stop mutation

`POST /api/driver/v2/actions`

```json
{
  "action_id": "uuid",
  "aggregate": {"type": "stop", "id": "uuid"},
  "action": "arrive",
  "expected_state": "pending",
  "authority_versions": {
    "stopVersion": {"current": 2, "expected": 2},
    "tripRouteVersion": {"current": 8, "expected": 8}
  },
  "evidence": {"kind": "none"},
  "occurred_at": "2026-07-26T12:01:00Z",
  "payload": {}
}
```

For a trip action, the corresponding authority map is:

```json
{
  "tripStateVersion": {"current": 5, "expected": 5},
  "routeVersion": {"current": 8, "expected": 8}
}
```

The response contains every changed aggregate ID/state/version plus the new
snapshot version.

### Exception

`POST /api/driver/v2/exceptions`

```json
{
  "action_id": "uuid",
  "expected_state": "none",
  "authority_versions": {
    "exceptionVersion": {"current": 0, "expected": 0}
  },
  "evidence": {
    "kind": "driver_exception_report",
    "exceptionKind": "vehicle_failure"
  },
  "related_authority_versions": {
    "driverStateVersion": {"current": 9, "expected": 9},
    "tripStateVersion": {"current": 6, "expected": 6},
    "routeVersion": {"current": 8, "expected": 8}
  },
  "occurred_at": "2026-07-26T12:02:00Z",
  "details": {"safe_to_continue": false}
}
```

This records the exception/hold; it does not delete or decline the assignment.

### GPS

`POST /api/driver/v2/positions`

```json
{
  "action_id": "uuid",
  "expected_state": "fresh",
  "authority_versions": {
    "positionVersion": {"current": 122, "expected": 122}
  },
  "evidence": {
    "kind": "gps_ingest",
    "ingest": {
      "validation": "valid",
      "sessionRelation": "same",
      "current": {
        "sessionId": "uuid",
        "sequence": 122,
        "capturedAtMs": 1785060122000
      },
      "incoming": {
        "sessionId": "uuid",
        "sequence": 123,
        "capturedAtMs": 1785060123000
      }
    }
  },
  "session_id": "uuid",
  "sequence": 123,
  "captured_at": "2026-07-26T12:02:03Z",
  "coordinates": {"lat": 0, "lng": 0, "accuracy_m": 12},
  "motion": {"speed_mps": 0, "heading_deg": 0},
  "app": {"version": "string", "platform": "ios"}
}
```

The server supplies `received_at`. A duplicate returns its original result. The
response outcome is exactly `monotonic_current_advance`,
`valid_history_only` or `rejected`; only the first returns
`current_advanced=true`.

### Error model

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_ACTION` / `INVALID_PAYLOAD` | Contract violation |
| 401/403 | `UNAUTHENTICATED` / `ACTOR_FORBIDDEN` | Actor/tenant mismatch |
| 404 | `AGGREGATE_NOT_FOUND` | Scoped aggregate absent |
| 409 | `STATE_CONFLICT` / `VERSION_CONFLICT` | Refresh snapshot |
| 409 | `ACTION_KEY_REUSED` | Same key, different fingerprint |
| 409 | `DRIVER_DECLINE_NOT_SUPPORTED` | Use snapshot or structured exception |
| 422 | `PRECONDITION_FAILED` | Pick/route/deadline/quality validation |
| 503 | `CANONICAL_WRITER_DISABLED` | Tenant is not cut over |

Server/database errors include structured aggregate IDs, expected/current
versions and a correlation ID, without customer location or secrets.

## Explicitly unresolved and default-off

- Production writer/migration/app version is unknown.
- Automatic reassignment and every post-pickup custody/handoff policy are not
  approved and remain default-off.
- GPS impossible-jump/accuracy limits require device evidence.
- GPS production retention is not approved.
- Legacy `pickup`, `abgeholt`, `abgeschlossen`, online-only driver and failed
  outbox rows need context.
- Longer holds, batching and long-distance behavior remain disabled until their
  later gates prove feasibility and watchdog recovery.

## G1 evidence boundary

The T01 artifacts provide declarative evidence for G1 review:

- selected canonical authorities;
- typed domain transition graphs with exact keys and structured contracts;
- no target accept/decline action;
- explicit exception/resolution and pre-pickup-only reassignment policy;
- old app/API cutover semantics and current-gap fixtures;
- pure tests for graph shape, mappings and request classification.

The tests prove only these declarations and pure-decider behavior. They do not
prove that listed atomic effects, idempotency, audit, deadlines, compatibility
translation or database invariants are implemented. G1 approval remains the
reviewer's decision. No G2–G6 evidence is claimed: T01 performed no migration,
database race/failure injection, API/RLS, device GPS, recovery or production
cutover.
