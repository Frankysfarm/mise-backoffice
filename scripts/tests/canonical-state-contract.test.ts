import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ASSIGNMENT_TRANSITIONS,
  CANONICAL_DELIVERY_CONTRACT_VERSION,
  CANONICAL_TRANSITIONS,
  CURRENT_COMPATIBILITY_BRIDGE_FIXTURES,
  DATABASE_INVARIANTS,
  DOMAIN_AUTHORITIES,
  DRIVER_EXCEPTION_KINDS,
  DRIVER_EXCEPTION_RESOLUTION_TARGETS,
  LEGACY_STATE_MAPPINGS,
  MANUAL_OVERRIDE_REQUIRED_FIELDS,
  POST_PICKUP_REASSIGNMENT_POLICY,
  TRIP_EXCEPTION_RESUME_TARGETS,
  decideCanonicalTransition,
  decideGpsIngest,
  decideReassignmentEligibility,
  decideTargetCompatibilityBridge,
  diagnoseCurrentCompatibilityBridge,
  type CanonicalDomain,
  type DomainAuthorityVersionMap,
  type DomainStateMap,
} from '../../lib/delivery/canonical-state-contract';

const actionKey = '11111111-1111-4111-8111-111111111111';
const override = {
  reasonCode: 'SAFETY_EXCEPTION',
  note: 'Supervised resolution with exact aggregate snapshot.',
  actorId: 'dispatcher-user-id',
};
const noneEvidence = { kind: 'none' as const };
const assignmentVersions = (
  current: number,
  expected = current,
): DomainAuthorityVersionMap['assignment'] => ({
  assignmentVersion: { current, expected },
});
const tripVersions = (
  stateCurrent: number,
  stateExpected = stateCurrent,
  routeCurrent = 1,
  routeExpected = routeCurrent,
): DomainAuthorityVersionMap['trip'] => ({
  tripStateVersion: { current: stateCurrent, expected: stateExpected },
  routeVersion: { current: routeCurrent, expected: routeExpected },
});
const stopVersions = (
  stopCurrent: number,
  stopExpected = stopCurrent,
): DomainAuthorityVersionMap['stop'] => ({
  stopVersion: { current: stopCurrent, expected: stopExpected },
  tripRouteVersion: { current: 1, expected: 1 },
});
const gpsVersions = (
  current: number,
  expected = current,
): DomainAuthorityVersionMap['gps'] => ({
  positionVersion: { current, expected },
});
const exceptionVersions = (
  current: number,
  expected = current,
): DomainAuthorityVersionMap['driver_exception'] => ({
  exceptionVersion: { current, expected },
});

assert.equal(CANONICAL_DELIVERY_CONTRACT_VERSION, 'atomic-v2-contract');
assert.equal(DOMAIN_AUTHORITIES.trip.stateVersionColumn, 'state_version');
assert.equal(DOMAIN_AUTHORITIES.trip.routeVersionColumn, 'route_version');
assert.notEqual(
  DOMAIN_AUTHORITIES.trip.stateVersionColumn,
  DOMAIN_AUTHORITIES.trip.routeVersionColumn,
);

const EXPECTED_TRANSITION_GRAPH = [
  ['order.release_schedule', 'order', ['scheduled'], 'confirmed', ['watchdog', 'dispatcher']],
  ['order.place_dispatch_hold', 'order', ['confirmed'], 'held', ['dispatch_writer']],
  ['order.release_dispatch_hold', 'order', ['held'], 'confirmed', ['watchdog', 'dispatch_writer', 'dispatcher']],
  ['order.start_preparation', 'order', ['confirmed'], 'preparing', ['kitchen_user', 'watchdog']],
  ['order.mark_ready', 'order', ['preparing'], 'ready', ['kitchen_user']],
  ['order.assign', 'order', ['ready'], 'assigned', ['dispatch_writer', 'dispatcher']],
  ['order.confirm_pickup', 'order', ['assigned'], 'picked_up', ['driver_app']],
  ['order.depart_pickup', 'order', ['picked_up'], 'out_for_delivery', ['driver_app']],
  ['order.confirm_delivery', 'order', ['out_for_delivery'], 'delivered', ['driver_app']],
  ['order.cancel', 'order', ['scheduled', 'held', 'confirmed', 'preparing', 'ready', 'assigned'], 'cancelled', ['customer_api', 'dispatcher', 'system']],

  ['driver.start_shift', 'driver', ['offline'], 'available', ['driver_app']],
  ['driver.end_shift', 'driver', ['available', 'returning'], 'offline', ['driver_app', 'dispatcher', 'watchdog']],
  ['driver.reserve_for_assignment', 'driver', ['available', 'returning'], 'assigned', ['dispatch_writer', 'dispatcher']],
  ['driver.arrive_pickup', 'driver', ['assigned'], 'at_pickup', ['driver_app', 'system']],
  ['driver.depart_pickup', 'driver', ['at_pickup'], 'delivering', ['driver_app']],
  ['driver.finish_trip', 'driver', ['delivering'], 'returning', ['driver_app', 'system']],
  ['driver.become_available', 'driver', ['returning'], 'available', ['driver_app', 'system']],
  ['driver.enter_exception', 'driver', ['available', 'assigned', 'at_pickup', 'delivering', 'returning'], 'exception', ['driver_app', 'dispatcher', 'system']],
  ['driver.resolve_exception_offline', 'driver', ['exception'], 'offline', ['dispatcher', 'system']],
  ['driver.resolve_exception_available', 'driver', ['exception'], 'available', ['dispatcher', 'system']],
  ['driver.resume_exception_assigned', 'driver', ['exception'], 'assigned', ['dispatcher', 'system']],
  ['driver.resume_exception_at_pickup', 'driver', ['exception'], 'at_pickup', ['dispatcher', 'system']],
  ['driver.resume_exception_delivering', 'driver', ['exception'], 'delivering', ['dispatcher', 'system']],
  ['driver.resume_exception_returning', 'driver', ['exception'], 'returning', ['dispatcher', 'system']],

  ['assignment.assign', 'assignment', ['unassigned'], 'assigned', ['dispatch_writer', 'dispatcher']],
  ['assignment.ack_receipt', 'assignment', ['assigned', 'picked_up', 'in_progress'], 'same', ['driver_app']],
  ['assignment.confirm_pickup', 'assignment', ['assigned'], 'picked_up', ['driver_app']],
  ['assignment.start_delivery', 'assignment', ['picked_up'], 'in_progress', ['driver_app']],
  ['assignment.complete', 'assignment', ['in_progress'], 'completed', ['driver_app', 'system']],
  ['assignment.cancel_before_pickup', 'assignment', ['assigned'], 'cancelled', ['dispatcher', 'system']],
  ['assignment.reassign_before_pickup', 'assignment', ['assigned'], 'reassigned', ['dispatcher']],

  ['trip.assign', 'trip', ['planned'], 'assigned', ['dispatch_writer', 'dispatcher']],
  ['trip.arrive_pickup', 'trip', ['assigned'], 'at_pickup', ['driver_app', 'system']],
  ['trip.complete_pick', 'trip', ['at_pickup'], 'ready_to_depart', ['driver_app']],
  ['trip.depart', 'trip', ['ready_to_depart'], 'in_progress', ['driver_app']],
  ['trip.complete', 'trip', ['in_progress'], 'completed', ['driver_app', 'system']],
  ['trip.pause_for_exception', 'trip', ['assigned', 'at_pickup', 'ready_to_depart', 'in_progress'], 'paused', ['driver_app', 'dispatcher', 'system']],
  ['trip.resume_to_assigned', 'trip', ['paused'], 'assigned', ['dispatcher', 'system']],
  ['trip.resume_to_at_pickup', 'trip', ['paused'], 'at_pickup', ['dispatcher', 'system']],
  ['trip.resume_to_ready_to_depart', 'trip', ['paused'], 'ready_to_depart', ['dispatcher', 'system']],
  ['trip.resume_to_in_progress', 'trip', ['paused'], 'in_progress', ['dispatcher', 'system']],
  ['trip.cancel', 'trip', ['planned', 'assigned', 'at_pickup'], 'cancelled', ['dispatcher', 'system']],

  ['stop.arrive', 'stop', ['pending'], 'arrived', ['driver_app', 'system']],
  ['stop.start_service', 'stop', ['arrived'], 'servicing', ['driver_app']],
  ['stop.complete', 'stop', ['servicing'], 'completed', ['driver_app']],
  ['stop.cancel', 'stop', ['pending', 'arrived', 'servicing'], 'cancelled', ['dispatcher', 'system']],

  ['kitchen.release', 'kitchen', ['scheduled'], 'released', ['watchdog', 'dispatch_writer', 'dispatcher']],
  ['kitchen.start_preparation', 'kitchen', ['released'], 'preparing', ['kitchen_user']],
  ['kitchen.mark_ready', 'kitchen', ['preparing'], 'ready', ['kitchen_user']],
  ['kitchen.confirm_pickup', 'kitchen', ['ready'], 'picked_up', ['driver_app']],
  ['kitchen.cancel', 'kitchen', ['scheduled', 'released', 'preparing', 'ready'], 'cancelled', ['dispatcher', 'system']],

  ['gps.ingest_advance_current', 'gps', ['unavailable', 'fresh', 'warning', 'stale'], 'fresh', ['gps_device', 'system']],
  ['gps.ingest_history_only', 'gps', ['unavailable', 'fresh', 'warning', 'stale'], 'same', ['gps_device', 'system']],
  ['gps.reject_position', 'gps', ['unavailable', 'fresh', 'warning', 'stale'], 'same', ['gps_device', 'system']],
  ['gps.mark_warning', 'gps', ['fresh'], 'warning', ['watchdog']],
  ['gps.mark_stale', 'gps', ['warning'], 'stale', ['watchdog']],
  ['gps.mark_unavailable', 'gps', ['fresh', 'warning', 'stale'], 'unavailable', ['gps_device', 'driver_app', 'watchdog']],

  ['driver_exception.report', 'driver_exception', ['none'], 'reported', ['driver_app', 'dispatcher', 'system']],
  ['driver_exception.triage', 'driver_exception', ['reported'], 'triaged', ['dispatcher']],
  ['driver_exception.start_mitigation', 'driver_exception', ['triaged'], 'mitigating', ['dispatcher', 'system']],
  ['driver_exception.require_reassignment', 'driver_exception', ['reported', 'triaged', 'mitigating'], 'reassignment_required', ['dispatcher', 'watchdog']],
  ['driver_exception.resolve', 'driver_exception', ['reported', 'triaged', 'mitigating', 'reassignment_required'], 'resolved', ['dispatcher', 'system']],
  ['driver_exception.close', 'driver_exception', ['resolved'], 'closed', ['dispatcher', 'system']],

  ['notification_outbox.lease', 'notification_outbox', ['pending', 'retry_wait'], 'leased', ['watchdog']],
  ['notification_outbox.mark_sent', 'notification_outbox', ['leased'], 'sent', ['system']],
  ['notification_outbox.schedule_retry', 'notification_outbox', ['leased'], 'retry_wait', ['system', 'watchdog']],
  ['notification_outbox.dead_letter', 'notification_outbox', ['leased', 'retry_wait'], 'dead_letter', ['system', 'watchdog']],
] as const;

const actualKeys = CANONICAL_TRANSITIONS.map((contract) => contract.key);
assert.equal(new Set(actualKeys).size, actualKeys.length, 'transition keys must be unique');
assert.deepEqual(
  [...actualKeys].sort(),
  EXPECTED_TRANSITION_GRAPH.map(([key]) => key).sort(),
  'transition key oracle must match exactly',
);
for (const [key, domain, from, to, actors] of EXPECTED_TRANSITION_GRAPH) {
  const contract = CANONICAL_TRANSITIONS.find((candidate) => candidate.key === key);
  assert.ok(contract, `${key} must exist`);
  assert.equal(contract.domain, domain, `${key} domain`);
  assert.deepEqual([...contract.from].sort(), [...from].sort(), `${key} from`);
  assert.equal(contract.to, to, `${key} to`);
  assert.deepEqual([...contract.actors].sort(), [...actors].sort(), `${key} actors`);
}

const DOMAIN_STATE_ORACLE = {
  order: ['scheduled', 'held', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
  driver: ['offline', 'available', 'assigned', 'at_pickup', 'delivering', 'returning', 'exception'],
  assignment: ['unassigned', 'assigned', 'picked_up', 'in_progress', 'completed', 'cancelled', 'reassigned'],
  trip: ['planned', 'assigned', 'at_pickup', 'ready_to_depart', 'in_progress', 'paused', 'completed', 'cancelled'],
  stop: ['pending', 'arrived', 'servicing', 'completed', 'cancelled'],
  kitchen: ['scheduled', 'released', 'preparing', 'ready', 'picked_up', 'cancelled'],
  gps: ['unavailable', 'fresh', 'warning', 'stale'],
  driver_exception: ['none', 'reported', 'triaged', 'mitigating', 'reassignment_required', 'resolved', 'closed'],
  notification_outbox: ['pending', 'leased', 'sent', 'retry_wait', 'dead_letter'],
} as const satisfies { [D in CanonicalDomain]: readonly DomainStateMap[D][] };

const INITIAL_STATES = {
  order: ['scheduled', 'confirmed'],
  driver: ['offline'],
  assignment: ['unassigned'],
  trip: ['planned'],
  stop: ['pending'],
  kitchen: ['scheduled'],
  gps: ['unavailable'],
  driver_exception: ['none'],
  notification_outbox: ['pending'],
} as const satisfies { [D in CanonicalDomain]: readonly DomainStateMap[D][] };

const AUTHORITY_KEY_ORACLE = {
  order: ['orderDispatchVersion'],
  driver: ['driverStateVersion'],
  assignment: ['assignmentVersion'],
  trip: ['tripStateVersion', 'routeVersion'],
  stop: ['stopVersion', 'tripRouteVersion'],
  kitchen: ['kitchenVersion'],
  gps: ['positionVersion'],
  driver_exception: ['exceptionVersion'],
  notification_outbox: ['attemptVersion'],
} as const;

for (const domain of Object.keys(DOMAIN_STATE_ORACLE) as CanonicalDomain[]) {
  const allowed = new Set<string>(DOMAIN_STATE_ORACLE[domain]);
  const reachable = new Set<string>(INITIAL_STATES[domain]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const contract of CANONICAL_TRANSITIONS.filter((row) => row.domain === domain)) {
      if (
        contract.from.some((state) => reachable.has(state)) &&
        contract.to !== 'same' &&
        !reachable.has(contract.to)
      ) {
        reachable.add(contract.to);
        changed = true;
      }
    }
  }
  for (const contract of CANONICAL_TRANSITIONS.filter((row) => row.domain === domain)) {
    assert.ok(contract.from.every((state) => allowed.has(state)), `${contract.key} from belongs to ${domain}`);
    assert.ok(contract.to === 'same' || allowed.has(contract.to), `${contract.key} to belongs to ${domain}`);
  }
  assert.deepEqual([...reachable].sort(), [...allowed].sort(), `${domain} graph reachability`);
}

for (const contract of CANONICAL_TRANSITIONS) {
  assert.ok(contract.validation.length > 0, `${contract.key} validation`);
  assert.ok(contract.atomicEffects.length > 0, `${contract.key} declared effects`);
  assert.ok(contract.expected.versionAuthorities.length > 0, `${contract.key} version authority`);
  assert.deepEqual(
    [...contract.expected.authorityKeys],
    [...AUTHORITY_KEY_ORACLE[contract.domain]],
    `${contract.key} typed authority keys`,
  );
  assert.equal(contract.idempotency.replay, 'return_original_result');
  assert.ok(contract.auditEvent.length > 0, `${contract.key} audit`);
  assert.ok(contract.timeoutRecovery.length > 0, `${contract.key} recovery`);
  assert.ok(contract.compatibility.length > 0, `${contract.key} compatibility`);
  if (contract.actors.includes('dispatcher')) {
    assert.equal(contract.manualOverride.mode, 'required', `${contract.key} override`);
    if (contract.manualOverride.mode === 'required') {
      assert.deepEqual(
        contract.manualOverride.requiredFields,
        MANUAL_OVERRIDE_REQUIRED_FIELDS,
      );
      assert.equal(contract.manualOverride.auditRequired, true);
    }
  } else {
    assert.equal(contract.manualOverride.mode, 'not_applicable', `${contract.key} override`);
  }
}
for (const contract of CANONICAL_TRANSITIONS.filter((row) => row.domain === 'trip')) {
  assert.deepEqual(
    contract.expected.versionAuthorities,
    [
      'mise_delivery_batches.state_version',
      'mise_delivery_batches.route_version',
    ],
    `${contract.key} must CAS state and route independently`,
  );
}

assert.equal(
  CANONICAL_TRANSITIONS.some(
    (contract) => contract.domain === 'assignment' &&
      (contract.action === 'accept' || contract.action === 'decline'),
  ),
  false,
);
for (const action of ['accept', 'decline']) {
  assert.deepEqual(
    decideCanonicalTransition({
      domain: 'assignment',
      action,
      actor: 'driver_app',
      currentState: 'assigned',
      expectedState: 'assigned',
      authorityVersions: assignmentVersions(3),
      actionKey,
      evidence: noneEvidence,
    }),
    { ok: false, reason: 'ACTION_NOT_ALLOWED' },
  );
}

const receipt = decideCanonicalTransition({
  domain: 'assignment',
  action: 'ack_receipt',
  actor: 'driver_app',
  currentState: 'assigned',
  expectedState: 'assigned',
  authorityVersions: assignmentVersions(3),
  actionKey,
  evidence: {
    kind: 'assignment_ack',
    snapshotVersion: { current: 42, expected: 42 },
  },
});
assert.equal(receipt.ok, true);
if (receipt.ok) {
  assert.equal(receipt.nextState, 'assigned');
  assert.equal(receipt.nextPrimaryVersion, 3);
}
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'assignment',
    action: 'ack_receipt',
    actor: 'driver_app',
    currentState: 'assigned',
    expectedState: 'assigned',
    authorityVersions: assignmentVersions(3),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'ACK_SNAPSHOT_EVIDENCE_MISSING' },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'assignment',
    action: 'ack_receipt',
    actor: 'driver_app',
    currentState: 'assigned',
    expectedState: 'assigned',
    authorityVersions: assignmentVersions(3),
    actionKey,
    evidence: {
      kind: 'assignment_ack',
      snapshotVersion: { current: 43, expected: 42 },
    },
  }),
  { ok: false, reason: 'ACK_SNAPSHOT_VERSION_CONFLICT' },
);

assert.deepEqual(
  decideCanonicalTransition({
    domain: 'driver_exception',
    action: 'report',
    actor: 'driver_app',
    currentState: 'none',
    expectedState: 'none',
    authorityVersions: exceptionVersions(0),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXCEPTION_KIND_EVIDENCE_MISSING' },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'driver_exception',
    action: 'report',
    actor: 'driver_app',
    currentState: 'none',
    expectedState: 'none',
    authorityVersions: exceptionVersions(0),
    actionKey,
    evidence: {
      kind: 'driver_exception_report',
      exceptionKind: 'normal_decline' as never,
    },
  }),
  { ok: false, reason: 'EXCEPTION_KIND_INVALID' },
);
assert.equal(
  decideCanonicalTransition({
    domain: 'driver_exception',
    action: 'report',
    actor: 'driver_app',
    currentState: 'none',
    expectedState: 'none',
    authorityVersions: exceptionVersions(0),
    actionKey,
    evidence: {
      kind: 'driver_exception_report',
      exceptionKind: 'vehicle_failure',
    },
  }).ok,
  true,
);

assert.deepEqual(
  decideCanonicalTransition({
    domain: 'assignment',
    action: 'confirm_pickup',
    actor: 'driver_app',
    currentState: 'assigned',
    expectedState: 'assigned',
    authorityVersions: assignmentVersions(4, 3),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXPECTED_AUTHORITY_VERSION_CONFLICT' },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'trip',
    action: 'assign',
    actor: 'dispatch_writer',
    currentState: 'planned',
    expectedState: 'planned',
    authorityVersions: {
      tripStateVersion: { current: 2, expected: 2 },
    } as DomainAuthorityVersionMap['trip'],
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXPECTED_AUTHORITY_EVIDENCE_MISSING' },
  'trip must carry separate route-version evidence',
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'trip',
    action: 'assign',
    actor: 'dispatch_writer',
    currentState: 'planned',
    expectedState: 'planned',
    authorityVersions: tripVersions(2, 2, 8, 7),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXPECTED_AUTHORITY_VERSION_CONFLICT' },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'stop',
    action: 'arrive',
    actor: 'driver_app',
    currentState: 'pending',
    expectedState: 'pending',
    authorityVersions: {
      stopVersion: { current: 1, expected: 1 },
    } as DomainAuthorityVersionMap['stop'],
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXPECTED_AUTHORITY_EVIDENCE_MISSING' },
  'stop must carry related trip route-version evidence',
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'stop',
    action: 'arrive',
    actor: 'driver_app',
    currentState: 'pending',
    expectedState: 'pending',
    authorityVersions: {
      stopVersion: { current: 1, expected: 1 },
      tripRouteVersion: { current: 8, expected: 7 },
    },
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'EXPECTED_AUTHORITY_VERSION_CONFLICT' },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'trip',
    action: 'depart',
    actor: 'driver_app',
    currentState: 'at_pickup',
    expectedState: 'at_pickup',
    authorityVersions: tripVersions(2),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'ACTION_NOT_ALLOWED' },
);
for (const action of ['skip', 'defer', 'reorder']) {
  assert.deepEqual(
    decideCanonicalTransition({
      domain: 'stop',
      action,
      actor: 'driver_app',
      currentState: 'pending',
      expectedState: 'pending',
      authorityVersions: stopVersions(1),
      actionKey,
      evidence: noneEvidence,
    }),
    { ok: false, reason: 'ACTION_NOT_ALLOWED' },
  );
}

const missingOverride = decideCanonicalTransition({
  domain: 'assignment',
  action: 'reassign_before_pickup',
  actor: 'dispatcher',
  currentState: 'assigned',
  expectedState: 'assigned',
  authorityVersions: assignmentVersions(4),
  actionKey,
  evidence: noneEvidence,
});
assert.deepEqual(missingOverride, { ok: false, reason: 'MANUAL_OVERRIDE_REQUIRED' });
assert.equal(
  decideCanonicalTransition({
    domain: 'assignment',
    action: 'reassign_before_pickup',
    actor: 'dispatcher',
    currentState: 'assigned',
    expectedState: 'assigned',
    authorityVersions: assignmentVersions(4),
    actionKey,
    evidence: noneEvidence,
    manualOverride: override,
  }).ok,
  true,
);

assert.deepEqual(
  decideReassignmentEligibility('assigned', 'not_acquired'),
  { allowed: true, phase: 'before_pickup', replacementState: 'assigned' },
);
assert.deepEqual(
  decideReassignmentEligibility('assigned', 'unknown'),
  { allowed: false, reason: 'CUSTODY_NOT_PROVEN_CLEAR' },
);
for (const state of ['picked_up', 'in_progress'] as const) {
  assert.deepEqual(
    decideReassignmentEligibility(state, 'acquired'),
    { allowed: false, reason: 'POST_PICKUP_CUSTODY_HANDOFF_UNSPECIFIED' },
  );
  assert.equal(
    ASSIGNMENT_TRANSITIONS.some(
      (contract) => contract.action.includes('reassign') && contract.from.includes(state),
    ),
    false,
  );
}
assert.equal(POST_PICKUP_REASSIGNMENT_POLICY.enabledByDefault, false);

const currentGps = {
  sessionId: 'session-a',
  sequence: 7,
  capturedAtMs: 1_000,
};
const monotonicEvidence = {
  validation: 'valid' as const,
  sessionRelation: 'same' as const,
  current: currentGps,
  incoming: { sessionId: 'session-a', sequence: 8, capturedAtMs: 1_001 },
};
assert.deepEqual(
  decideGpsIngest(monotonicEvidence),
  {
    outcome: 'monotonic_current_advance',
    transitionKey: 'gps.ingest_advance_current',
  },
);
assert.deepEqual(
  decideGpsIngest({
    validation: 'valid',
    sessionRelation: 'same',
    current: currentGps,
    incoming: { sessionId: 'session-a', sequence: 6, capturedAtMs: 999 },
  }),
  {
    outcome: 'valid_history_only',
    transitionKey: 'gps.ingest_history_only',
    reason: 'OLDER_OR_DUPLICATE_PACKET',
  },
);
assert.deepEqual(
  decideGpsIngest({
    validation: 'valid',
    sessionRelation: 'unknown_or_older',
    current: null,
    incoming: { sessionId: 'session-a', sequence: 1, capturedAtMs: 1_000 },
  }),
  {
    outcome: 'valid_history_only',
    transitionKey: 'gps.ingest_history_only',
    reason: 'NO_CURRENT_SUCCESSOR_PROOF',
  },
);
assert.deepEqual(
  decideGpsIngest({
    validation: 'rejected',
    rejectionReason: 'LOW_QUALITY',
    sessionRelation: 'same',
    current: currentGps,
    incoming: { sessionId: 'session-a', sequence: 8, capturedAtMs: 1_001 },
  }),
  {
    outcome: 'rejected',
    transitionKey: 'gps.reject_position',
    reason: 'LOW_QUALITY',
  },
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'gps',
    action: 'ingest_advance_current',
    actor: 'gps_device',
    currentState: 'fresh',
    expectedState: 'fresh',
    authorityVersions: gpsVersions(7),
    actionKey,
    evidence: noneEvidence,
  }),
  { ok: false, reason: 'GPS_INGEST_EVIDENCE_MISSING' },
  'generic transition intent cannot claim monotonicity without evidence',
);
assert.equal(
  decideCanonicalTransition({
    domain: 'gps',
    action: 'ingest_advance_current',
    actor: 'gps_device',
    currentState: 'fresh',
    expectedState: 'fresh',
    authorityVersions: gpsVersions(7),
    actionKey,
    evidence: { kind: 'gps_ingest', ingest: monotonicEvidence },
  }).ok,
  true,
);
assert.deepEqual(
  decideCanonicalTransition({
    domain: 'gps',
    action: 'ingest_advance_current',
    actor: 'gps_device',
    currentState: 'fresh',
    expectedState: 'fresh',
    authorityVersions: gpsVersions(7),
    actionKey,
    evidence: {
      kind: 'gps_ingest',
      ingest: {
        validation: 'valid',
        sessionRelation: 'same',
        current: currentGps,
        incoming: { sessionId: 'session-a', sequence: 6, capturedAtMs: 999 },
      },
    },
  }),
  { ok: false, reason: 'GPS_INGEST_EVIDENCE_MISMATCH' },
);

assert.deepEqual(
  DRIVER_EXCEPTION_KINDS,
  [
    'medical_safety_emergency',
    'vehicle_failure',
    'accident_road_closure',
    'location_permission_gps_failure',
    'network_device_failure',
    'shift_invalid',
    'dispatcher_authorized_break',
  ],
);
assert.deepEqual(
  DRIVER_EXCEPTION_RESOLUTION_TARGETS,
  ['offline', 'available', 'assigned', 'at_pickup', 'delivering', 'returning'],
);
assert.deepEqual(
  TRIP_EXCEPTION_RESUME_TARGETS,
  ['assigned', 'at_pickup', 'ready_to_depart', 'in_progress'],
);
assert.equal(
  CANONICAL_TRANSITIONS.some((contract) =>
    contract.to === ('context.resume_state' as never)),
  false,
);

const LEGACY_MAPPING_ROW_ORACLE = [
  ['customer_orders.status', 'neu', 'order', 'confirmed', 'direct'],
  ['customer_orders.status', 'bestätigt', 'order', 'confirmed', 'direct'],
  ['customer_orders.status', 'pending', 'order', 'confirmed', 'direct'],
  ['customer_orders.status', 'confirmed', 'order', 'confirmed', 'direct'],
  ['customer_orders.status', 'scheduled', 'order', 'scheduled', 'direct'],
  ['customer_orders.status', 'released', 'order', 'confirmed', 'direct'],
  ['customer_orders.status', 'in_zubereitung', 'order', 'preparing', 'direct'],
  ['customer_orders.status', 'preparing', 'order', 'preparing', 'direct'],
  ['customer_orders.status', 'fertig', 'order', 'ready', 'direct'],
  ['customer_orders.status', 'ready', 'order', 'ready', 'direct'],
  ['customer_orders.status', 'bereit_zur_lieferung', 'order', 'ready', 'direct'],
  ['customer_orders.status', 'picked_up', 'order', 'picked_up', 'direct'],
  ['customer_orders.status', 'abgeholt', 'order', 'picked_up', 'context_required_default_off'],
  ['customer_orders.status', 'unterwegs', 'order', 'out_for_delivery', 'direct'],
  ['customer_orders.status', 'geliefert', 'order', 'delivered', 'direct'],
  ['customer_orders.status', 'delivered', 'order', 'delivered', 'direct'],
  ['customer_orders.status', 'abgeschlossen', 'order', 'delivered', 'context_required_default_off'],
  ['customer_orders.status', 'storniert', 'order', 'cancelled', 'direct'],
  ['customer_orders.status', 'cancelled', 'order', 'cancelled', 'direct'],
  ['customer_orders.status', 'abgebrochen', 'order', 'cancelled', 'direct'],
  ['customer_orders.status', 'abgelehnt', 'order', 'cancelled', 'terminal_history_only'],
  ['customer_orders.status', 'rejected', 'order', 'cancelled', 'terminal_history_only'],

  ['mise_drivers.state', 'offline', 'driver', 'offline', 'direct'],
  ['mise_drivers.state', 'idle', 'driver', 'available', 'direct'],
  ['mise_drivers.state', 'assigned', 'driver', 'assigned', 'direct'],
  ['mise_drivers.state', 'at_restaurant', 'driver', 'at_pickup', 'direct'],
  ['mise_drivers.state', 'en_route', 'driver', 'delivering', 'direct'],
  ['mise_drivers.state', 'returning', 'driver', 'returning', 'direct'],
  ['driver_status.ist_online', 'false', 'driver', 'offline', 'cutover_conversion'],
  ['driver_status.ist_online', 'true', 'driver', 'available', 'context_required_default_off'],
  ['driver_status.aktueller_batch_id', 'IS NULL', 'driver', 'offline|available|returning', 'context_required_default_off'],
  ['driver_status.aktueller_batch_id', 'IS NOT NULL', 'driver', 'assigned|at_pickup|delivering|exception', 'context_required_default_off'],

  ['mise_delivery_batches.state', 'pending_acceptance', 'trip', 'assigned', 'cutover_conversion'],
  ['mise_delivery_batches.state', 'assigned', 'trip', 'assigned', 'direct'],
  ['mise_delivery_batches.state', 'at_restaurant', 'trip', 'at_pickup', 'direct'],
  ['mise_delivery_batches.state', 'picked_up', 'trip', 'ready_to_depart', 'direct'],
  ['mise_delivery_batches.state', 'in_progress', 'trip', 'in_progress', 'direct'],
  ['mise_delivery_batches.state', 'completed', 'trip', 'completed', 'direct'],
  ['mise_delivery_batches.state', 'cancelled', 'trip', 'cancelled', 'direct'],
  ['delivery_batches.status', 'pickup', 'trip', 'planned|assigned', 'context_required_default_off'],
  ['delivery_batches.state', 'pending_acceptance', 'trip', 'assigned', 'cutover_conversion'],
  ['delivery_batches.state', 'assigned', 'trip', 'assigned', 'direct'],
  ['delivery_batches.state', 'at_restaurant', 'trip', 'at_pickup', 'direct'],
  ['delivery_batches.state', 'picked_up', 'trip', 'ready_to_depart', 'direct'],
  ['delivery_batches.state', 'in_progress', 'trip', 'in_progress', 'direct'],
  ['delivery_batches.state', 'completed', 'trip', 'completed', 'direct'],
  ['delivery_batches.state', 'cancelled', 'trip', 'cancelled', 'direct'],

  ['dispatch_offer_assignments.state', 'offered', 'assignment', 'assigned', 'cutover_conversion'],
  ['dispatch_offer_assignments.state', 'accepted', 'assignment', 'assigned', 'cutover_conversion'],
  ['dispatch_offer_assignments.state', 'declined', 'assignment', 'cancelled', 'terminal_history_only'],
  ['dispatch_offer_assignments.state', 'expired', 'assignment', 'cancelled', 'terminal_history_only'],
  ['dispatch_offer_assignments.state', 'cancelled', 'assignment', 'cancelled', 'direct'],
  ['dispatch_offer_assignments.state', 'picked_up', 'assignment', 'picked_up', 'direct'],
  ['dispatch_offer_assignments.state', 'in_progress', 'assignment', 'in_progress', 'direct'],
  ['dispatch_offer_assignments.state', 'completed', 'assignment', 'completed', 'direct'],

  ['mise_delivery_batch_stops', 'completed_at IS NULL AND arrived_at IS NULL', 'stop', 'pending', 'direct'],
  ['mise_delivery_batch_stops', 'completed_at IS NULL AND arrived_at IS NOT NULL', 'stop', 'arrived', 'context_required_default_off'],
  ['mise_delivery_batch_stops', 'completed_at IS NOT NULL', 'stop', 'completed', 'direct'],
  ['delivery_batch_stops', 'geliefert_am IS NULL', 'stop', 'pending', 'context_required_default_off'],
  ['delivery_batch_stops', 'geliefert_am IS NOT NULL', 'stop', 'completed', 'direct'],
  ['delivery_batch_stops', 'bridge row without geliefert_am', 'stop', 'pending', 'context_required_default_off'],

  ['kitchen_timings.status', 'scheduled', 'kitchen', 'scheduled', 'direct'],
  ['kitchen_timings.status', 'cooking', 'kitchen', 'preparing', 'direct'],
  ['kitchen_timings.status', 'ready', 'kitchen', 'ready', 'direct'],
  ['kitchen_timings.status', 'picked_up', 'kitchen', 'picked_up', 'direct'],

  ['legacy GPS lifecycle', 'offline', 'gps', 'unavailable', 'direct'],
  ['legacy GPS lifecycle', 'watching', 'gps', 'unavailable', 'context_required_default_off'],
  ['legacy GPS lifecycle', 'fresh', 'gps', 'fresh', 'cutover_conversion'],
  ['legacy GPS lifecycle', 'stale', 'gps', 'stale', 'direct'],
  ['legacy GPS lifecycle', 'permission_error', 'gps', 'unavailable', 'direct'],
  ['legacy GPS lifecycle', 'offline_network', 'gps', 'unavailable', 'direct'],

  ['mise_push_outbox', 'sent_at IS NULL AND failed_at IS NULL', 'notification_outbox', 'pending', 'cutover_conversion'],
  ['mise_push_outbox', 'sent_at IS NOT NULL', 'notification_outbox', 'sent', 'direct'],
  ['mise_push_outbox', 'failed_at IS NOT NULL', 'notification_outbox', 'dead_letter|retry_wait', 'context_required_default_off'],
  ['driver_push_outbox', 'sent_at IS NULL AND error IS NULL', 'notification_outbox', 'pending', 'cutover_conversion'],
  ['driver_push_outbox', 'sent_at IS NOT NULL AND error IS NULL', 'notification_outbox', 'sent', 'direct'],
  ['driver_push_outbox', 'error IS NOT NULL', 'notification_outbox', 'dead_letter|retry_wait', 'context_required_default_off'],
] as const;
const actualMappingRows = LEGACY_STATE_MAPPINGS.map((mapping) => [
  mapping.sourceModel,
  mapping.sourceState,
  mapping.domain,
  mapping.targetState,
  mapping.disposition,
]);
assert.deepEqual(
  actualMappingRows.map((row) => JSON.stringify(row)).sort(),
  LEGACY_MAPPING_ROW_ORACLE.map((row) => JSON.stringify(row)).sort(),
);
const mappingKeys = LEGACY_STATE_MAPPINGS.map(
  (mapping) => `${mapping.sourceModel}:${mapping.sourceState}`,
);
assert.equal(new Set(mappingKeys).size, mappingKeys.length);
for (const mapping of LEGACY_STATE_MAPPINGS) {
  if (mapping.targetState.includes('|')) {
    assert.equal(mapping.disposition, 'context_required_default_off');
  }
}

const CURRENT_BRIDGE_ORACLE = [
  'api.orders.accept',
  'api.me.accept_tour',
  'api.offers.transition.accept',
  'api.offers.transition.decline',
  'client.atomic_offer.accept',
  'client.atomic_offer.decline',
  'client.claim_batch.accept',
  'api.offers.ack',
  'client.native_offer.ack',
].sort();
assert.deepEqual(
  CURRENT_COMPATIBILITY_BRIDGE_FIXTURES.map((fixture) => fixture.id).sort(),
  CURRENT_BRIDGE_ORACLE,
);
for (const fixture of CURRENT_COMPATIBILITY_BRIDGE_FIXTURES) {
  const source = readFileSync(fixture.sourceFile, 'utf8');
  for (const snippet of fixture.evidenceSnippets) {
    assert.ok(source.includes(snippet), `${fixture.id} evidence: ${snippet}`);
  }
  assert.equal(
    diagnoseCurrentCompatibilityBridge(fixture),
    fixture.expectedCurrentDiagnostic,
  );
}
assert.deepEqual(
  decideTargetCompatibilityBridge('accept'),
  {
    legacyAction: 'accept',
    targetAction: 'ack_receipt',
    httpStatus: 200,
    stateEffect: 'unchanged',
    versionEffect: 'unchanged',
  },
);
assert.deepEqual(
  decideTargetCompatibilityBridge('decline'),
  {
    legacyAction: 'decline',
    targetAction: null,
    httpStatus: 409,
    reasonCode: 'DRIVER_DECLINE_NOT_SUPPORTED',
    snapshot: {
      required: true,
      source: 'canonical_server_snapshot',
    },
    supportedExceptionKinds: [
      'medical_safety_emergency',
      'vehicle_failure',
      'accident_road_closure',
      'location_permission_gps_failure',
      'network_device_failure',
      'shift_invalid',
      'dispatcher_authorized_break',
    ],
  },
);

assert.ok(
  DATABASE_INVARIANTS.some((invariant) =>
    invariant.includes('explicit monotonic-current evidence')),
);
assert.ok(
  DATABASE_INVARIANTS.some((invariant) =>
    invariant.includes('technical ACK changes receipt metadata only')),
);

console.log('canonical state contract tests: PASS');
