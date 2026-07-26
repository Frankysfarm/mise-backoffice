/**
 * Pure domain contract for the server-authoritative delivery lifecycle.
 *
 * This is the target evolution of Atomic-v1. It deliberately contains no
 * database, API, feature-flag or side-effect implementation.
 */

export const CANONICAL_DELIVERY_CONTRACT_VERSION = 'atomic-v2-contract';

export const DOMAIN_AUTHORITIES = {
  order: {
    table: 'customer_orders',
    versionColumn: 'dispatch_version',
    legacyReadSources: [],
  },
  driver: {
    table: 'mise_drivers',
    versionColumn: 'state_version',
    legacyReadSources: ['driver_status'],
  },
  trip: {
    table: 'mise_delivery_batches',
    stateVersionColumn: 'state_version',
    routeVersionColumn: 'route_version',
    legacyReadSources: ['delivery_batches'],
  },
  stop: {
    table: 'mise_delivery_batch_stops',
    versionColumn: 'stop_version',
    legacyReadSources: ['delivery_batch_stops'],
  },
  assignment: {
    table: 'dispatch_offer_assignments',
    versionColumn: 'assignment_version',
    legacyReadSources: ['customer_orders.mise_driver_id', 'customer_orders.fahrer_id'],
  },
  kitchen: {
    table: 'kitchen_timings',
    versionColumn: 'kitchen_version',
    legacyReadSources: ['customer_orders.status'],
  },
  gpsCurrent: {
    table: 'mise_driver_position_current',
    versionColumn: 'position_version',
    legacyReadSources: [
      'mise_drivers.lat/lng/last_position_at',
      'driver_status.lat/lng/last_position_at',
    ],
  },
  gpsHistory: {
    table: 'mise_driver_locations',
    versionColumn: 'session_id+sequence',
    legacyReadSources: ['driver_gps_trail'],
  },
  notificationOutbox: {
    table: 'mise_push_outbox',
    versionColumn: 'attempt_version',
    legacyReadSources: ['driver_push_outbox'],
  },
  audit: {
    table: 'dispatch_offer_audit',
    versionColumn: 'event_id',
    legacyReadSources: ['mise_frank_decisions', 'dispatch_scores'],
  },
} as const;

export type CanonicalDomain =
  | 'order'
  | 'driver'
  | 'assignment'
  | 'trip'
  | 'stop'
  | 'kitchen'
  | 'gps'
  | 'driver_exception'
  | 'notification_outbox';

export type CanonicalActor =
  | 'customer_api'
  | 'dispatch_writer'
  | 'driver_app'
  | 'gps_device'
  | 'kitchen_user'
  | 'dispatcher'
  | 'watchdog'
  | 'system';

export type OrderState =
  | 'scheduled'
  | 'held'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type DriverState =
  | 'offline'
  | 'available'
  | 'assigned'
  | 'at_pickup'
  | 'delivering'
  | 'returning'
  | 'exception';

export type AssignmentState =
  | 'unassigned'
  | 'assigned'
  | 'picked_up'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reassigned';

export type TripState =
  | 'planned'
  | 'assigned'
  | 'at_pickup'
  | 'ready_to_depart'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type StopState =
  | 'pending'
  | 'arrived'
  | 'servicing'
  | 'completed'
  | 'cancelled';

export type KitchenState =
  | 'scheduled'
  | 'released'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

export type GpsState = 'unavailable' | 'fresh' | 'warning' | 'stale';

export type DriverExceptionState =
  | 'none'
  | 'reported'
  | 'triaged'
  | 'mitigating'
  | 'reassignment_required'
  | 'resolved'
  | 'closed';

export type NotificationOutboxState =
  | 'pending'
  | 'leased'
  | 'sent'
  | 'retry_wait'
  | 'dead_letter';

export type CanonicalState =
  | OrderState
  | DriverState
  | AssignmentState
  | TripState
  | StopState
  | KitchenState
  | GpsState
  | DriverExceptionState
  | NotificationOutboxState;

export type DriverExceptionKind =
  | 'medical_safety_emergency'
  | 'vehicle_failure'
  | 'accident_road_closure'
  | 'location_permission_gps_failure'
  | 'network_device_failure'
  | 'shift_invalid'
  | 'dispatcher_authorized_break';

export const DRIVER_EXCEPTION_KINDS: readonly DriverExceptionKind[] = [
  'medical_safety_emergency',
  'vehicle_failure',
  'accident_road_closure',
  'location_permission_gps_failure',
  'network_device_failure',
  'shift_invalid',
  'dispatcher_authorized_break',
];

export interface DomainStateMap {
  order: OrderState;
  driver: DriverState;
  assignment: AssignmentState;
  trip: TripState;
  stop: StopState;
  kitchen: KitchenState;
  gps: GpsState;
  driver_exception: DriverExceptionState;
  notification_outbox: NotificationOutboxState;
}

export interface AuthorityVersionEvidence {
  current: number;
  expected: number;
}

export interface DomainAuthorityVersionMap {
  order: { orderDispatchVersion: AuthorityVersionEvidence };
  driver: { driverStateVersion: AuthorityVersionEvidence };
  assignment: { assignmentVersion: AuthorityVersionEvidence };
  trip: {
    tripStateVersion: AuthorityVersionEvidence;
    routeVersion: AuthorityVersionEvidence;
  };
  stop: {
    stopVersion: AuthorityVersionEvidence;
    tripRouteVersion: AuthorityVersionEvidence;
  };
  kitchen: { kitchenVersion: AuthorityVersionEvidence };
  gps: { positionVersion: AuthorityVersionEvidence };
  driver_exception: { exceptionVersion: AuthorityVersionEvidence };
  notification_outbox: { attemptVersion: AuthorityVersionEvidence };
}

export const MANUAL_OVERRIDE_REQUIRED_FIELDS = [
  'reasonCode',
  'note',
  'actorId',
  'expectedState',
  'expectedAuthorityVersions',
  'actionId',
] as const;

export type ManualOverrideContract =
  | { mode: 'not_applicable' }
  | {
      mode: 'required';
      actors: readonly ['dispatcher'];
      requiredFields: typeof MANUAL_OVERRIDE_REQUIRED_FIELDS;
      auditRequired: true;
    };

export interface TransitionContract<
  D extends CanonicalDomain = CanonicalDomain,
> {
  key: `${D}.${string}`;
  domain: D;
  action: string;
  from: readonly DomainStateMap[D][];
  to: DomainStateMap[D] | 'same';
  actors: readonly CanonicalActor[];
  expected: {
    stateRequired: true;
    versionRequired: true;
    authorityKeys: readonly (keyof DomainAuthorityVersionMap[D])[];
    versionAuthorities: readonly string[];
    versionEffect: 'increment' | 'unchanged';
  };
  validation: readonly string[];
  atomicEffects: readonly string[];
  idempotency: {
    keyRequired: true;
    scope: string;
    replay: 'return_original_result';
  };
  auditEvent: string;
  timeoutRecovery: string;
  compatibility: string;
  manualOverride: ManualOverrideContract;
}

export type AnyTransitionContract = {
  [D in CanonicalDomain]: TransitionContract<D>;
}[CanonicalDomain];

type TransitionInput<D extends CanonicalDomain> = Omit<
  TransitionContract<D>,
  'key' | 'expected' | 'idempotency' | 'manualOverride'
> & {
  versionEffect?: 'increment' | 'unchanged';
  versionAuthorities?: readonly string[];
  idempotencyScope?: string;
};

const VERSION_AUTHORITIES: Record<CanonicalDomain, readonly string[]> = {
  order: ['customer_orders.dispatch_version'],
  driver: ['mise_drivers.state_version'],
  assignment: ['dispatch_offer_assignments.assignment_version'],
  trip: [
    'mise_delivery_batches.state_version',
    'mise_delivery_batches.route_version',
  ],
  stop: [
    'mise_delivery_batch_stops.stop_version',
    'mise_delivery_batches.route_version',
  ],
  kitchen: ['kitchen_timings.kitchen_version'],
  gps: ['mise_driver_position_current.position_version'],
  driver_exception: ['driver_exceptions.exception_version'],
  notification_outbox: ['mise_push_outbox.attempt_version'],
};

const AUTHORITY_KEYS: {
  [D in CanonicalDomain]: readonly (keyof DomainAuthorityVersionMap[D])[];
} = {
  order: ['orderDispatchVersion'],
  driver: ['driverStateVersion'],
  assignment: ['assignmentVersion'],
  trip: ['tripStateVersion', 'routeVersion'],
  stop: ['stopVersion', 'tripRouteVersion'],
  kitchen: ['kitchenVersion'],
  gps: ['positionVersion'],
  driver_exception: ['exceptionVersion'],
  notification_outbox: ['attemptVersion'],
};

function transition<D extends CanonicalDomain>(
  input: TransitionInput<D>,
): TransitionContract<D> {
  const {
    versionEffect = 'increment',
    versionAuthorities = VERSION_AUTHORITIES[input.domain],
    idempotencyScope = `${input.domain}:${input.action}:aggregate`,
    ...contract
  } = input;
  const manualOverride: ManualOverrideContract = input.actors.includes('dispatcher')
    ? {
        mode: 'required',
        actors: ['dispatcher'],
        requiredFields: MANUAL_OVERRIDE_REQUIRED_FIELDS,
        auditRequired: true,
      }
    : { mode: 'not_applicable' };
  return {
    ...contract,
    key: `${input.domain}.${input.action}`,
    expected: {
      stateRequired: true,
      versionRequired: true,
      authorityKeys: AUTHORITY_KEYS[input.domain],
      versionAuthorities,
      versionEffect,
    },
    idempotency: {
      keyRequired: true,
      scope: idempotencyScope,
      replay: 'return_original_result',
    },
    manualOverride,
  };
}

const rejectLegacyWrites =
  'Old clients are read-only projections; direct legacy writes are rejected after tenant cutover.';
const defaultOffCompatibility =
  'Unavailable before tenant cutover; keep the existing elected writer and feature path default-off.';

export const DRIVER_EXCEPTION_RESOLUTION_TARGETS: readonly Exclude<
  DriverState,
  'exception'
>[] = [
  'offline',
  'available',
  'assigned',
  'at_pickup',
  'delivering',
  'returning',
];

export const TRIP_EXCEPTION_RESUME_TARGETS: readonly Exclude<
  TripState,
  'planned' | 'paused' | 'completed' | 'cancelled'
>[] = ['assigned', 'at_pickup', 'ready_to_depart', 'in_progress'];

export const ORDER_TRANSITIONS: readonly TransitionContract<'order'>[] = [
  transition({
    domain: 'order', action: 'release_schedule', from: ['scheduled'], to: 'confirmed',
    actors: ['watchdog', 'dispatcher'],
    validation: ['persistent release_at is due', 'tenant writer is canonical'],
    atomicEffects: ['advance order version', 'release or create kitchen schedule', 'enqueue snapshot notification'],
    auditEvent: 'order.schedule_released',
    timeoutRecovery: 'Persistent release_at watchdog retries with the same action key.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'order', action: 'place_dispatch_hold', from: ['confirmed'], to: 'held',
    actors: ['dispatch_writer'],
    validation: ['hold policy enabled', 'absolute hold deadline present', 'deadline feasibility proven'],
    atomicEffects: ['persist reason and inputs', 'persist next_evaluation_at and absolute deadline'],
    auditEvent: 'order.dispatch_held',
    timeoutRecovery: 'Watchdog releases or escalates no later than the absolute deadline.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'order', action: 'release_dispatch_hold', from: ['held'], to: 'confirmed',
    actors: ['watchdog', 'dispatch_writer', 'dispatcher'],
    validation: ['release reason present', 'deadline not extended beyond configured hard cap'],
    atomicEffects: ['clear active hold', 'advance kitchen release decision', 'enqueue canonical snapshot signal'],
    auditEvent: 'order.dispatch_hold_released',
    timeoutRecovery: 'Deadline watchdog owns forced release/escalation.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'order', action: 'start_preparation', from: ['confirmed'], to: 'preparing',
    actors: ['kitchen_user', 'watchdog'],
    validation: ['kitchen state is released or preparing', 'location authorization'],
    atomicEffects: ['advance kitchen and order consistently', 'record preparation start'],
    auditEvent: 'order.preparation_started',
    timeoutRecovery: 'Preparation SLA watchdog escalates; it never fabricates ready.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'order', action: 'mark_ready', from: ['preparing'], to: 'ready',
    actors: ['kitchen_user'],
    validation: ['location authorization', 'required preparation checks complete'],
    atomicEffects: ['advance matching kitchen state', 'wake canonical dispatch writer'],
    auditEvent: 'order.ready',
    timeoutRecovery: 'No automatic ready transition; overdue preparation escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'order', action: 'assign', from: ['ready'], to: 'assigned',
    actors: ['dispatch_writer', 'dispatcher'],
    validation: ['exactly one elected writer', 'driver/trip feasibility', 'no active assignment'],
    atomicEffects: ['create assignment, trip and stops', 'reserve driver/load', 'write audit and outbox'],
    auditEvent: 'order.assigned',
    timeoutRecovery: 'Missing technical ACK triggers retry/escalation, never unassignment.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'order', action: 'confirm_pickup', from: ['assigned'], to: 'picked_up',
    actors: ['driver_app'],
    validation: ['all required order items have server-resolved outcomes', 'pickup stop is current'],
    atomicEffects: ['advance assignment, trip, stop and kitchen', 'record pickup timestamp'],
    auditEvent: 'order.picked_up',
    timeoutRecovery: 'Pickup deadline watchdog escalates without guessing completion.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'order', action: 'depart_pickup', from: ['picked_up'], to: 'out_for_delivery',
    actors: ['driver_app'],
    validation: ['every assigned pickup is complete', 'server route version matches'],
    atomicEffects: ['advance trip and assignment', 'set driver delivering'],
    auditEvent: 'order.out_for_delivery',
    timeoutRecovery: 'Stuck departure escalates; replay uses the original action result.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'order', action: 'confirm_delivery', from: ['out_for_delivery'], to: 'delivered',
    actors: ['driver_app'],
    validation: ['dropoff stop is current', 'delivery evidence policy satisfied'],
    atomicEffects: ['complete stop/order/assignment when final', 'advance trip and driver as applicable'],
    auditEvent: 'order.delivered',
    timeoutRecovery: 'Delivery deadline watchdog escalates; no synthetic delivery.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'order', action: 'cancel', from: ['scheduled', 'held', 'confirmed', 'preparing', 'ready', 'assigned'], to: 'cancelled',
    actors: ['customer_api', 'dispatcher', 'system'],
    validation: ['authenticated cancellation policy', 'reason code', 'assigned-order compensation plan'],
    atomicEffects: ['cancel kitchen/open stops', 'release or reassign active work atomically', 'enqueue notifications'],
    auditEvent: 'order.cancelled',
    timeoutRecovery: 'Retry until the canonical snapshot is terminal and internally consistent.',
    compatibility: 'Translate supported old cancel calls at the API boundary; reject direct table writes.',
  }),
];

export const DRIVER_TRANSITIONS: readonly TransitionContract<'driver'>[] = [
  transition({
    domain: 'driver', action: 'start_shift', from: ['offline'], to: 'available',
    actors: ['driver_app'],
    validation: ['authenticated driver', 'valid tenant membership and shift', 'GPS policy evaluated'],
    atomicEffects: ['open driver session', 'set capacity baseline'],
    auditEvent: 'driver.shift_started',
    timeoutRecovery: 'Session heartbeat watchdog moves inactive sessions offline only when no active trip.',
    compatibility: 'Old online calls translate at the API boundary after cutover.',
  }),
  transition({
    domain: 'driver', action: 'end_shift', from: ['available', 'returning'], to: 'offline',
    actors: ['driver_app', 'dispatcher', 'watchdog'],
    validation: ['no active assignment or trip', 'reason required for dispatcher/watchdog'],
    atomicEffects: ['close session', 'stop operational GPS eligibility'],
    auditEvent: 'driver.shift_ended',
    timeoutRecovery: 'Heartbeat timeout may end an idle session; active work only escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'driver', action: 'reserve_for_assignment', from: ['available', 'returning'], to: 'assigned',
    actors: ['dispatch_writer', 'dispatcher'],
    validation: ['capacity and GPS eligible', 'no incompatible active trip'],
    atomicEffects: ['create assignment/trip/stops/order claim/audit/outbox'],
    auditEvent: 'driver.assigned',
    timeoutRecovery: 'ACK timeout cannot release the driver; exception/escalation flow is required.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'driver', action: 'arrive_pickup', from: ['assigned'], to: 'at_pickup',
    actors: ['driver_app', 'system'],
    validation: ['current trip and stop match', 'geofence evidence when system actor'],
    atomicEffects: ['advance pickup stop/trip', 'record event and receipt times'],
    auditEvent: 'driver.at_pickup',
    timeoutRecovery: 'Arrival deadline escalates; stale GPS does not fabricate arrival.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'driver', action: 'depart_pickup', from: ['at_pickup'], to: 'delivering',
    actors: ['driver_app'],
    validation: ['trip ready_to_depart', 'all assigned picks resolved'],
    atomicEffects: ['advance trip and affected assignments/orders'],
    auditEvent: 'driver.delivering',
    timeoutRecovery: 'Departure timeout escalates and remains idempotently retryable.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'driver', action: 'finish_trip', from: ['delivering'], to: 'returning',
    actors: ['driver_app', 'system'],
    validation: ['all non-cancelled stops terminal', 'all assignments terminal'],
    atomicEffects: ['complete trip', 'release capacity'],
    auditEvent: 'driver.returning',
    timeoutRecovery: 'Completion watchdog reconciles from terminal stops; otherwise escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'driver', action: 'become_available', from: ['returning'], to: 'available',
    actors: ['driver_app', 'system'],
    validation: ['no active assignment', 'return policy or geofence satisfied'],
    atomicEffects: ['mark driver dispatch-eligible if GPS policy passes'],
    auditEvent: 'driver.available',
    timeoutRecovery: 'Returning timeout escalates or applies configured return policy.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'driver', action: 'enter_exception', from: ['available', 'assigned', 'at_pickup', 'delivering', 'returning'], to: 'exception',
    actors: ['driver_app', 'dispatcher', 'system'],
    validation: ['structured exception kind', 'prior state stored', 'correlation ID present'],
    atomicEffects: ['create exception event', 'pause operational eligibility', 'preserve active assignment'],
    auditEvent: 'driver.exception_entered',
    timeoutRecovery: 'Exception SLA watchdog escalates; it cannot silently cancel work.',
    compatibility: 'Old decline/issue gestures do not map; only the structured exception API is accepted.',
  }),
  ...([
    ['resolve_exception_offline', 'offline', 'no active assignment; shift is closed'],
    ['resolve_exception_available', 'available', 'no active assignment; shift and GPS eligibility valid'],
    ['resume_exception_assigned', 'assigned', 'active assignment is assigned and trip is assigned'],
    ['resume_exception_at_pickup', 'at_pickup', 'active assignment remains pre-departure and trip is at_pickup'],
    ['resume_exception_delivering', 'delivering', 'same driver retains custody and trip is in_progress'],
    ['resume_exception_returning', 'returning', 'no active assignment and return trip remains valid'],
  ] as const).map(([action, target, targetValidation]) => transition({
    domain: 'driver',
    action,
    from: ['exception'],
    to: target,
    actors: ['dispatcher', 'system'],
    validation: [
      'linked exception is resolved',
      targetValidation,
      'driver, assignment and trip expected versions reconcile exactly',
    ],
    atomicEffects: [
      `set driver to explicit ${target} resolution`,
      'close operational exception hold and write resolution audit',
    ],
    auditEvent: `driver.${action}`,
    timeoutRecovery: 'If exact resolution validation fails, remain exception and escalated.',
    compatibility: defaultOffCompatibility,
  })),
];

export const ASSIGNMENT_TRANSITIONS: readonly TransitionContract<'assignment'>[] = [
  transition({
    domain: 'assignment', action: 'assign', from: ['unassigned'], to: 'assigned',
    actors: ['dispatch_writer', 'dispatcher'],
    validation: ['order and driver CAS', 'one active assignment per order', 'single tenant writer'],
    atomicEffects: ['create active assignment, trip and stops', 'claim order and driver', 'write audit and outbox'],
    auditEvent: 'assignment.created',
    timeoutRecovery: 'Technical ACK timeout retries notification and escalates; assignment remains active.',
    compatibility: 'Atomic-v1 offered/accepted rows are drained or converted during a gated cutover.',
  }),
  transition({
    domain: 'assignment', action: 'ack_receipt', from: ['assigned', 'picked_up', 'in_progress'], to: 'same',
    actors: ['driver_app'],
    validation: ['driver owns assignment', 'snapshot version exactly matches', 'receipt key unique'],
    atomicEffects: ['record received_at and app/device metadata only', 'write receipt audit'],
    auditEvent: 'assignment.receipt_acknowledged',
    timeoutRecovery: 'Retry same snapshot/action key; missing ACK only wakes/escalates.',
    compatibility: 'Old accept is temporarily translated to receipt ACK only; decline is rejected.',
    versionEffect: 'unchanged',
    idempotencyScope: 'assignment:ack_receipt:snapshot_version',
  }),
  transition({
    domain: 'assignment', action: 'confirm_pickup', from: ['assigned'], to: 'picked_up',
    actors: ['driver_app'],
    validation: ['server pick completeness', 'current pickup stop', 'expected trip/stop versions'],
    atomicEffects: ['advance order/kitchen/stop/trip consistently'],
    auditEvent: 'assignment.picked_up',
    timeoutRecovery: 'Pickup SLA escalates; retry returns original result.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'assignment', action: 'start_delivery', from: ['picked_up'], to: 'in_progress',
    actors: ['driver_app'],
    validation: ['trip ready_to_depart', 'all assigned orders picked'],
    atomicEffects: ['advance trip/orders', 'set driver delivering'],
    auditEvent: 'assignment.in_progress',
    timeoutRecovery: 'Departure watchdog escalates without auto-advancing.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'assignment', action: 'complete', from: ['in_progress'], to: 'completed',
    actors: ['driver_app', 'system'],
    validation: ['corresponding dropoff complete', 'delivery evidence policy'],
    atomicEffects: ['complete order/stop', 'complete trip and release driver when final'],
    auditEvent: 'assignment.completed',
    timeoutRecovery: 'Reconcile from canonical stop results; never from push delivery.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'assignment', action: 'cancel_before_pickup', from: ['assigned'], to: 'cancelled',
    actors: ['dispatcher', 'system'],
    validation: ['reason code', 'custody not acquired', 'order cancellation or approved operational policy'],
    atomicEffects: ['cancel related open stops', 'release order and driver claims', 'notify affected actors'],
    auditEvent: 'assignment.cancelled',
    timeoutRecovery: 'Retry atomically; unresolved partial cancellation is a critical alert.',
    compatibility: 'No driver actor; post-pickup cancellation is not declared by this contract.',
  }),
  transition({
    domain: 'assignment', action: 'reassign_before_pickup', from: ['assigned'], to: 'reassigned',
    actors: ['dispatcher'],
    validation: [
      'active structured exception',
      'custody is not_acquired and no item/order is picked up',
      'replacement driver and route feasible',
      'old assignment, order, trip, stops and both drivers match expected versions',
    ],
    atomicEffects: [
      'old assignment becomes reassigned and ceases to be active',
      'replacement assignment is created assigned at version 1',
      'old trip/open stops are cancelled when no other active assignment remains',
      'replacement trip and stops are created in assigned/pending phase',
      'order remains assigned and points only to the replacement assignment/driver/trip',
      'old driver remains exception; replacement driver becomes assigned',
      'audit old/new IDs and enqueue both canonical snapshots in the same transaction',
    ],
    auditEvent: 'assignment.reassigned',
    timeoutRecovery: 'Supervised retry uses one action key; automatic reassignment remains default-off.',
    compatibility: 'Only supervised pre-pickup conversion is declared; post-pickup handoff is blocked.',
  }),
];

export const POST_PICKUP_REASSIGNMENT_POLICY = {
  enabledByDefault: false,
  supportedAssignmentStates: ['assigned'] as const,
  blockedAssignmentStates: ['picked_up', 'in_progress'] as const,
  blockedReason: 'POST_PICKUP_CUSTODY_HANDOFF_UNSPECIFIED',
  requiredOperationalPath:
    'preserve old assignment; pause trip/driver through structured exception; escalate to dispatcher',
} as const;

export type ReassignmentEligibility =
  | { allowed: true; phase: 'before_pickup'; replacementState: 'assigned' }
  | {
      allowed: false;
      reason:
        | 'CUSTODY_NOT_PROVEN_CLEAR'
        | 'POST_PICKUP_CUSTODY_HANDOFF_UNSPECIFIED'
        | 'ASSIGNMENT_NOT_ACTIVE';
    };

export function decideReassignmentEligibility(
  assignmentState: AssignmentState,
  custody: 'not_acquired' | 'acquired' | 'unknown',
): ReassignmentEligibility {
  if (assignmentState === 'picked_up' || assignmentState === 'in_progress') {
    return { allowed: false, reason: 'POST_PICKUP_CUSTODY_HANDOFF_UNSPECIFIED' };
  }
  if (assignmentState !== 'assigned') {
    return { allowed: false, reason: 'ASSIGNMENT_NOT_ACTIVE' };
  }
  if (custody !== 'not_acquired') {
    return { allowed: false, reason: 'CUSTODY_NOT_PROVEN_CLEAR' };
  }
  return { allowed: true, phase: 'before_pickup', replacementState: 'assigned' };
}

export const TRIP_TRANSITIONS: readonly TransitionContract<'trip'>[] = [
  transition({
    domain: 'trip', action: 'assign', from: ['planned'], to: 'assigned',
    actors: ['dispatch_writer', 'dispatcher'],
    validation: ['route/capacity/deadlines feasible', 'all stops versioned'],
    atomicEffects: ['create assignments/order claims/driver load/audit/outbox'],
    auditEvent: 'trip.assigned',
    timeoutRecovery: 'ACK timeout does not revert the trip.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'trip', action: 'arrive_pickup', from: ['assigned'], to: 'at_pickup',
    actors: ['driver_app', 'system'],
    validation: ['current pickup stop', 'route version matches'],
    atomicEffects: ['advance stop and driver', 'record arrival'],
    auditEvent: 'trip.at_pickup',
    timeoutRecovery: 'Arrival SLA escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'trip', action: 'complete_pick', from: ['at_pickup'], to: 'ready_to_depart',
    actors: ['driver_app'],
    validation: ['every assigned order/item has server-resolved outcome'],
    atomicEffects: ['complete pickup stops', 'advance orders/assignments/kitchen'],
    auditEvent: 'trip.ready_to_depart',
    timeoutRecovery: 'Missing-item resolution remains explicit; timeout escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'trip', action: 'depart', from: ['ready_to_depart'], to: 'in_progress',
    actors: ['driver_app'],
    validation: ['server route version and next stop match'],
    atomicEffects: ['advance assignments/orders/driver'],
    auditEvent: 'trip.in_progress',
    timeoutRecovery: 'Departure timeout escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'trip', action: 'complete', from: ['in_progress'], to: 'completed',
    actors: ['driver_app', 'system'],
    validation: ['all non-cancelled stops and assignments terminal'],
    atomicEffects: ['complete trip', 'release driver/load'],
    auditEvent: 'trip.completed',
    timeoutRecovery: 'Reconcile only from canonical terminal children.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'trip', action: 'pause_for_exception', from: ['assigned', 'at_pickup', 'ready_to_depart', 'in_progress'], to: 'paused',
    actors: ['driver_app', 'dispatcher', 'system'],
    validation: ['structured exception exists', 'resume state stored'],
    atomicEffects: ['mark driver exception', 'preserve assignments and stops'],
    auditEvent: 'trip.paused_for_exception',
    timeoutRecovery: 'Exception watchdog requires resume, reassignment or cancellation.',
    compatibility: 'No mapping from normal decline.',
  }),
  ...([
    ['resume_to_assigned', 'assigned'],
    ['resume_to_at_pickup', 'at_pickup'],
    ['resume_to_ready_to_depart', 'ready_to_depart'],
    ['resume_to_in_progress', 'in_progress'],
  ] as const).map(([action, target]) => transition({
    domain: 'trip',
    action,
    from: ['paused'],
    to: target,
    actors: ['dispatcher', 'system'],
    validation: [
      'linked exception resolved',
      `stored pre-pause state is exactly ${target}`,
      'trip state_version and route_version match',
      'route/custody/assignment snapshot remains feasible',
    ],
    atomicEffects: [
      `restore trip explicitly to ${target}`,
      'resolve matching driver state and refresh snapshot/outbox',
    ],
    auditEvent: `trip.${action}`,
    timeoutRecovery: 'Remain paused and escalated if exact resolution validation fails.',
    compatibility: defaultOffCompatibility,
    versionAuthorities: [
      'mise_delivery_batches.state_version',
      'mise_delivery_batches.route_version',
    ],
  })),
  transition({
    domain: 'trip', action: 'cancel', from: ['planned', 'assigned', 'at_pickup'], to: 'cancelled',
    actors: ['dispatcher', 'system'],
    validation: ['reason code', 'custody is not_acquired; at_pickup alone does not prove pickup'],
    atomicEffects: ['cancel open stops/assignments', 'release order/driver claims', 'outbox'],
    auditEvent: 'trip.cancelled',
    timeoutRecovery: 'Atomic retry; partial release is prohibited.',
    compatibility: rejectLegacyWrites,
  }),
];

export const STOP_TRANSITIONS: readonly TransitionContract<'stop'>[] = [
  transition({
    domain: 'stop', action: 'arrive', from: ['pending'], to: 'arrived',
    actors: ['driver_app', 'system'],
    validation: ['server-selected next stop', 'trip route version matches'],
    atomicEffects: ['record arrival', 'advance trip/driver when applicable'],
    auditEvent: 'stop.arrived',
    timeoutRecovery: 'Stop deadline escalates; client cannot locally reorder.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'stop', action: 'start_service', from: ['arrived'], to: 'servicing',
    actors: ['driver_app'],
    validation: ['stop belongs to active trip', 'required workflow available'],
    atomicEffects: ['record service start'],
    auditEvent: 'stop.service_started',
    timeoutRecovery: 'Service SLA escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'stop', action: 'complete', from: ['servicing'], to: 'completed',
    actors: ['driver_app'],
    validation: ['pickup completeness or dropoff evidence satisfied'],
    atomicEffects: ['advance related order/assignment/trip atomically'],
    auditEvent: 'stop.completed',
    timeoutRecovery: 'Retry by action key; no client-only completion.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'stop', action: 'cancel', from: ['pending', 'arrived', 'servicing'], to: 'cancelled',
    actors: ['dispatcher', 'system'],
    validation: ['parent cancellation/reassignment', 'reason code'],
    atomicEffects: ['recompute route version', 'update parent aggregates'],
    auditEvent: 'stop.cancelled',
    timeoutRecovery: 'Parent recovery retries the whole atomic mutation.',
    compatibility: rejectLegacyWrites,
  }),
];

export const KITCHEN_TRANSITIONS: readonly TransitionContract<'kitchen'>[] = [
  transition({
    domain: 'kitchen', action: 'release', from: ['scheduled'], to: 'released',
    actors: ['watchdog', 'dispatch_writer', 'dispatcher'],
    validation: ['persistent release time due or manual override authorized', 'absolute deadline present'],
    atomicEffects: ['record decision reason/inputs', 'notify kitchen via outbox'],
    auditEvent: 'kitchen.released',
    timeoutRecovery: 'Watchdog guarantees release or escalation by absolute deadline.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'kitchen', action: 'start_preparation', from: ['released'], to: 'preparing',
    actors: ['kitchen_user'],
    validation: ['location authorization'],
    atomicEffects: ['advance matching order', 'record start'],
    auditEvent: 'kitchen.preparation_started',
    timeoutRecovery: 'Preparation SLA escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'kitchen', action: 'mark_ready', from: ['preparing'], to: 'ready',
    actors: ['kitchen_user'],
    validation: ['location authorization', 'required checks complete'],
    atomicEffects: ['advance matching order', 'wake dispatch writer'],
    auditEvent: 'kitchen.ready',
    timeoutRecovery: 'No automatic ready; overdue preparation escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'kitchen', action: 'confirm_pickup', from: ['ready'], to: 'picked_up',
    actors: ['driver_app'],
    validation: ['server pick completeness', 'matching pickup stop'],
    atomicEffects: ['advance order/assignment/stop/trip'],
    auditEvent: 'kitchen.picked_up',
    timeoutRecovery: 'Pickup SLA escalates.',
    compatibility: rejectLegacyWrites,
  }),
  transition({
    domain: 'kitchen', action: 'cancel', from: ['scheduled', 'released', 'preparing', 'ready'], to: 'cancelled',
    actors: ['dispatcher', 'system'],
    validation: ['matching order cancellation', 'reason code'],
    atomicEffects: ['advance matching order/stop as required'],
    auditEvent: 'kitchen.cancelled',
    timeoutRecovery: 'Order cancellation recovery owns retry.',
    compatibility: rejectLegacyWrites,
  }),
];

export const GPS_TRANSITIONS: readonly TransitionContract<'gps'>[] = [
  transition({
    domain: 'gps', action: 'ingest_advance_current', from: ['unavailable', 'fresh', 'warning', 'stale'], to: 'fresh',
    actors: ['gps_device', 'system'],
    validation: [
      'decideGpsIngest returned monotonic_current_advance from explicit evidence',
      'coordinates and configured quality policy valid',
    ],
    atomicEffects: [
      'append accepted history idempotently',
      'advance current session/sequence/captured_at and position_version',
      'record server received_at and quality metadata',
    ],
    auditEvent: 'gps.current_advanced',
    timeoutRecovery: 'Bounded offline replay preserves session/sequence; older packets never replace current.',
    compatibility: 'Legacy position payloads remain default-off for canonical current-state writes.',
    idempotencyScope: 'gps:driver:session:sequence',
  }),
  transition({
    domain: 'gps', action: 'ingest_history_only', from: ['unavailable', 'fresh', 'warning', 'stale'], to: 'same',
    actors: ['gps_device', 'system'],
    validation: [
      'decideGpsIngest returned valid_history_only',
      'packet is valid but lacks explicit monotonic-current evidence',
    ],
    atomicEffects: [
      'append accepted history idempotently when not already present',
      'do not update current position, health state or position_version',
    ],
    auditEvent: 'gps.valid_history_only',
    timeoutRecovery: 'Continue freshness evaluation from the last trusted current point.',
    compatibility: defaultOffCompatibility,
    versionEffect: 'unchanged',
    idempotencyScope: 'gps:driver:session:sequence',
  }),
  transition({
    domain: 'gps', action: 'reject_position', from: ['unavailable', 'fresh', 'warning', 'stale'], to: 'same',
    actors: ['gps_device', 'system'],
    validation: ['decideGpsIngest returned rejected with a classified reason'],
    atomicEffects: [
      'record rejection audit with minimized metadata',
      'do not append accepted history or update current position/version',
    ],
    auditEvent: 'gps.position_rejected',
    timeoutRecovery: 'Continue with the last trusted current point and freshness watchdog.',
    compatibility: defaultOffCompatibility,
    versionEffect: 'unchanged',
    idempotencyScope: 'gps:driver:session:sequence',
  }),
  transition({
    domain: 'gps', action: 'mark_warning', from: ['fresh'], to: 'warning',
    actors: ['watchdog'],
    validation: ['tenant/activity warning threshold exceeded'],
    atomicEffects: ['mark quality warning', 'retain last trusted coordinates'],
    auditEvent: 'gps.warning',
    timeoutRecovery: 'Active-trip default 45s; idle/returning default 90s, configurable.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'gps', action: 'mark_stale', from: ['warning'], to: 'stale',
    actors: ['watchdog'],
    validation: ['tenant/activity stale threshold exceeded'],
    atomicEffects: ['exclude from new assignment', 'escalate active trip without abandoning it'],
    auditEvent: 'gps.stale',
    timeoutRecovery: 'Active-trip default 90s; idle/returning default 180s, configurable.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'gps', action: 'mark_unavailable', from: ['fresh', 'warning', 'stale'], to: 'unavailable',
    actors: ['gps_device', 'driver_app', 'watchdog'],
    validation: ['session ended or structured permission/device/network reason'],
    atomicEffects: ['close/annotate GPS session', 'preserve last trusted history'],
    auditEvent: 'gps.unavailable',
    timeoutRecovery: 'Active work escalates; no automatic unassignment.',
    compatibility: defaultOffCompatibility,
  }),
];

export interface GpsIngestEvidence {
  validation: 'valid' | 'rejected';
  rejectionReason?: string;
  sessionRelation: 'same' | 'authorized_successor' | 'unknown_or_older';
  current: {
    sessionId: string;
    sequence: number;
    capturedAtMs: number;
  } | null;
  incoming: {
    sessionId: string;
    sequence: number;
    capturedAtMs: number;
  };
}

export type GpsIngestDecision =
  | {
      outcome: 'monotonic_current_advance';
      transitionKey: 'gps.ingest_advance_current';
    }
  | {
      outcome: 'valid_history_only';
      transitionKey: 'gps.ingest_history_only';
      reason: 'NO_CURRENT_SUCCESSOR_PROOF' | 'OLDER_OR_DUPLICATE_PACKET';
    }
  | {
      outcome: 'rejected';
      transitionKey: 'gps.reject_position';
      reason: string;
    };

export function decideGpsIngest(
  evidence: GpsIngestEvidence,
): GpsIngestDecision {
  if (
    evidence.validation === 'rejected' ||
    !evidence.incoming.sessionId ||
    !Number.isSafeInteger(evidence.incoming.sequence) ||
    evidence.incoming.sequence < 0 ||
    !Number.isFinite(evidence.incoming.capturedAtMs)
  ) {
    return {
      outcome: 'rejected',
      transitionKey: 'gps.reject_position',
      reason: evidence.rejectionReason ?? 'INVALID_INGEST_EVIDENCE',
    };
  }

  if (!evidence.current) {
    return evidence.sessionRelation === 'authorized_successor'
      ? {
          outcome: 'monotonic_current_advance',
          transitionKey: 'gps.ingest_advance_current',
        }
      : {
          outcome: 'valid_history_only',
          transitionKey: 'gps.ingest_history_only',
          reason: 'NO_CURRENT_SUCCESSOR_PROOF',
        };
  }

  const sameSession =
    evidence.sessionRelation === 'same' &&
    evidence.incoming.sessionId === evidence.current.sessionId;
  const advancesSameSession =
    sameSession &&
    evidence.incoming.sequence > evidence.current.sequence &&
    evidence.incoming.capturedAtMs >= evidence.current.capturedAtMs;
  const advancesAuthorizedSession =
    evidence.sessionRelation === 'authorized_successor' &&
    evidence.incoming.sessionId !== evidence.current.sessionId;

  if (advancesSameSession || advancesAuthorizedSession) {
    return {
      outcome: 'monotonic_current_advance',
      transitionKey: 'gps.ingest_advance_current',
    };
  }
  return {
    outcome: 'valid_history_only',
    transitionKey: 'gps.ingest_history_only',
    reason: 'OLDER_OR_DUPLICATE_PACKET',
  };
}

export const DRIVER_EXCEPTION_TRANSITIONS: readonly TransitionContract<'driver_exception'>[] = [
  transition({
    domain: 'driver_exception', action: 'report', from: ['none'], to: 'reported',
    actors: ['driver_app', 'dispatcher', 'system'],
    validation: ['approved exception kind', 'driver/trip snapshot', 'event and receipt time'],
    atomicEffects: ['create immutable exception', 'enter driver/trip exception hold', 'enqueue operations alert'],
    auditEvent: 'driver_exception.reported',
    timeoutRecovery: 'Triage deadline watchdog escalates.',
    compatibility: 'Normal decline is not an exception and is rejected.',
  }),
  transition({
    domain: 'driver_exception', action: 'triage', from: ['reported'], to: 'triaged',
    actors: ['dispatcher'],
    validation: ['authenticated actor', 'severity and disposition'],
    atomicEffects: ['persist triage decision and next deadline'],
    auditEvent: 'driver_exception.triaged',
    timeoutRecovery: 'Untriaged deadline pages operations.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'driver_exception', action: 'start_mitigation', from: ['triaged'], to: 'mitigating',
    actors: ['dispatcher', 'system'],
    validation: ['mitigation plan and owner'],
    atomicEffects: ['persist plan/deadline', 'refresh canonical snapshots'],
    auditEvent: 'driver_exception.mitigation_started',
    timeoutRecovery: 'Mitigation deadline escalates.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'driver_exception', action: 'require_reassignment', from: ['reported', 'triaged', 'mitigating'], to: 'reassignment_required',
    actors: ['dispatcher', 'watchdog'],
    validation: ['reason', 'goods custody and route snapshot', 'replacement policy'],
    atomicEffects: ['keep old assignment active until atomic swap', 'enqueue operations alert'],
    auditEvent: 'driver_exception.reassignment_required',
    timeoutRecovery: 'Default-off automatic policy; supervised retry until atomic swap.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'driver_exception', action: 'resolve', from: ['reported', 'triaged', 'mitigating', 'reassignment_required'], to: 'resolved',
    actors: ['dispatcher', 'system'],
    validation: ['resolution code', 'assignment/trip reconciliation complete'],
    atomicEffects: ['resume, reassign or cancel through corresponding CAS transition'],
    auditEvent: 'driver_exception.resolved',
    timeoutRecovery: 'Cannot resolve while related aggregates are inconsistent.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'driver_exception', action: 'close', from: ['resolved'], to: 'closed',
    actors: ['dispatcher', 'system'],
    validation: ['required notes/evidence retained under policy'],
    atomicEffects: ['terminalize exception only'],
    auditEvent: 'driver_exception.closed',
    timeoutRecovery: 'No automatic semantic change after closure.',
    compatibility: defaultOffCompatibility,
  }),
];

export const NOTIFICATION_OUTBOX_TRANSITIONS: readonly TransitionContract<'notification_outbox'>[] = [
  transition({
    domain: 'notification_outbox', action: 'lease', from: ['pending', 'retry_wait'], to: 'leased',
    actors: ['watchdog'],
    validation: ['due_at reached', 'lease absent or expired'],
    atomicEffects: ['claim bounded lease', 'increment attempt'],
    auditEvent: 'outbox.leased',
    timeoutRecovery: 'Expired lease returns to retry_wait.',
    compatibility: 'Existing mise_push_outbox is evolved in place; push remains a wake-up signal.',
  }),
  transition({
    domain: 'notification_outbox', action: 'mark_sent', from: ['leased'], to: 'sent',
    actors: ['system'],
    validation: ['provider request completed', 'lease owner matches'],
    atomicEffects: ['record provider result and sent_at'],
    auditEvent: 'outbox.sent',
    timeoutRecovery: 'Client receipt is separately tracked; provider success is not app receipt.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'notification_outbox', action: 'schedule_retry', from: ['leased'], to: 'retry_wait',
    actors: ['system', 'watchdog'],
    validation: ['retryable failure', 'bounded backoff and attempt count'],
    atomicEffects: ['record sanitized error', 'persist next attempt'],
    auditEvent: 'outbox.retry_scheduled',
    timeoutRecovery: 'Due watchdog leases again.',
    compatibility: defaultOffCompatibility,
  }),
  transition({
    domain: 'notification_outbox', action: 'dead_letter', from: ['leased', 'retry_wait'], to: 'dead_letter',
    actors: ['system', 'watchdog'],
    validation: ['permanent failure or retry budget exhausted'],
    atomicEffects: ['record terminal reason', 'raise operations alert'],
    auditEvent: 'outbox.dead_lettered',
    timeoutRecovery: 'Manual replay requires a new action key and audit event.',
    compatibility: defaultOffCompatibility,
  }),
];

export const CANONICAL_TRANSITIONS: readonly AnyTransitionContract[] = [
  ...ORDER_TRANSITIONS,
  ...DRIVER_TRANSITIONS,
  ...ASSIGNMENT_TRANSITIONS,
  ...TRIP_TRANSITIONS,
  ...STOP_TRANSITIONS,
  ...KITCHEN_TRANSITIONS,
  ...GPS_TRANSITIONS,
  ...DRIVER_EXCEPTION_TRANSITIONS,
  ...NOTIFICATION_OUTBOX_TRANSITIONS,
];

export interface CanonicalTransitionAttempt<
  D extends CanonicalDomain = CanonicalDomain,
> {
  domain: D;
  action: string;
  actor: CanonicalActor;
  currentState: DomainStateMap[D];
  expectedState: DomainStateMap[D];
  authorityVersions: DomainAuthorityVersionMap[D];
  actionKey: string;
  manualOverride?: {
    reasonCode: string;
    note: string;
    actorId: string;
  };
  evidence: TransitionEvidence;
}

export type TransitionEvidence =
  | { kind: 'none' }
  | {
      kind: 'assignment_ack';
      snapshotVersion: AuthorityVersionEvidence;
    }
  | {
      kind: 'driver_exception_report';
      exceptionKind: DriverExceptionKind;
    }
  | {
      kind: 'gps_ingest';
      ingest: GpsIngestEvidence;
    };

export type AnyCanonicalTransitionAttempt = {
  [D in CanonicalDomain]: CanonicalTransitionAttempt<D>;
}[CanonicalDomain];

export type CanonicalTransitionDecision<D extends CanonicalDomain> =
  | {
      ok: true;
      transition: TransitionContract<D>;
      nextState: DomainStateMap[D];
      nextPrimaryVersion: number;
    }
  | {
      ok: false;
      reason:
        | 'ACTION_NOT_ALLOWED'
        | 'ACTOR_NOT_ALLOWED'
        | 'EXPECTED_STATE_CONFLICT'
        | 'EXPECTED_AUTHORITY_EVIDENCE_MISSING'
        | 'EXPECTED_AUTHORITY_VERSION_CONFLICT'
        | 'INVALID_ACTION_KEY'
        | 'MANUAL_OVERRIDE_REQUIRED'
        | 'ACK_SNAPSHOT_EVIDENCE_MISSING'
        | 'ACK_SNAPSHOT_VERSION_CONFLICT'
        | 'EXCEPTION_KIND_EVIDENCE_MISSING'
        | 'EXCEPTION_KIND_INVALID'
        | 'GPS_INGEST_EVIDENCE_MISSING'
        | 'GPS_INGEST_EVIDENCE_MISMATCH'
        | 'UNEXPECTED_ACTION_EVIDENCE';
    };

export type AnyCanonicalTransitionDecision = {
  [D in CanonicalDomain]: CanonicalTransitionDecision<D>;
}[CanonicalDomain];

export type CanonicalTransitionDecisionResult =
  | {
      ok: true;
      transition: AnyTransitionContract;
      nextState: CanonicalState;
      nextPrimaryVersion: number;
    }
  | Extract<AnyCanonicalTransitionDecision, { ok: false }>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function decideCanonicalTransition(
  attempt: AnyCanonicalTransitionAttempt,
): CanonicalTransitionDecisionResult {
  const contract = CANONICAL_TRANSITIONS.find(
    (candidate) =>
      candidate.domain === attempt.domain &&
      candidate.action === attempt.action &&
      candidate.from.some((state) => state === attempt.currentState),
  ) as AnyTransitionContract | undefined;
  if (!contract) return { ok: false, reason: 'ACTION_NOT_ALLOWED' };
  if (!contract.actors.includes(attempt.actor)) {
    return { ok: false, reason: 'ACTOR_NOT_ALLOWED' };
  }
  if (attempt.expectedState !== attempt.currentState) {
    return { ok: false, reason: 'EXPECTED_STATE_CONFLICT' };
  }
  const authorityVersions = attempt.authorityVersions as
    | Record<string, AuthorityVersionEvidence | undefined>
    | undefined;
  for (const key of contract.expected.authorityKeys) {
    const pair = authorityVersions?.[String(key)];
    if (
      !pair ||
      !Number.isSafeInteger(pair.current) ||
      !Number.isSafeInteger(pair.expected) ||
      pair.current < 0 ||
      pair.expected < 0
    ) {
      return { ok: false, reason: 'EXPECTED_AUTHORITY_EVIDENCE_MISSING' };
    }
    if (pair.current !== pair.expected) {
      return { ok: false, reason: 'EXPECTED_AUTHORITY_VERSION_CONFLICT' };
    }
  }
  if (!UUID.test(attempt.actionKey)) {
    return { ok: false, reason: 'INVALID_ACTION_KEY' };
  }
  if (
    (
      contract.key === 'gps.ingest_advance_current' ||
      contract.key === 'gps.ingest_history_only' ||
      contract.key === 'gps.reject_position'
    ) &&
    (
      attempt.evidence.kind !== 'gps_ingest'
    )
  ) {
    return { ok: false, reason: 'GPS_INGEST_EVIDENCE_MISSING' };
  }
  if (
    attempt.evidence.kind === 'gps_ingest' &&
    decideGpsIngest(attempt.evidence.ingest).transitionKey !== contract.key
  ) {
    return { ok: false, reason: 'GPS_INGEST_EVIDENCE_MISMATCH' };
  }
  if (contract.key === 'assignment.ack_receipt') {
    if (
      attempt.evidence.kind !== 'assignment_ack' ||
      !Number.isSafeInteger(attempt.evidence.snapshotVersion.current) ||
      !Number.isSafeInteger(attempt.evidence.snapshotVersion.expected) ||
      attempt.evidence.snapshotVersion.current < 0 ||
      attempt.evidence.snapshotVersion.expected < 0
    ) {
      return { ok: false, reason: 'ACK_SNAPSHOT_EVIDENCE_MISSING' };
    }
    if (
      attempt.evidence.snapshotVersion.current !==
      attempt.evidence.snapshotVersion.expected
    ) {
      return { ok: false, reason: 'ACK_SNAPSHOT_VERSION_CONFLICT' };
    }
  }
  if (contract.key === 'driver_exception.report') {
    if (attempt.evidence.kind !== 'driver_exception_report') {
      return { ok: false, reason: 'EXCEPTION_KIND_EVIDENCE_MISSING' };
    }
    if (!DRIVER_EXCEPTION_KINDS.includes(attempt.evidence.exceptionKind)) {
      return { ok: false, reason: 'EXCEPTION_KIND_INVALID' };
    }
  }
  const specialEvidenceExpected =
    contract.key === 'assignment.ack_receipt' ||
    contract.key === 'driver_exception.report' ||
    contract.key === 'gps.ingest_advance_current' ||
    contract.key === 'gps.ingest_history_only' ||
    contract.key === 'gps.reject_position';
  if (!specialEvidenceExpected && attempt.evidence.kind !== 'none') {
    return { ok: false, reason: 'UNEXPECTED_ACTION_EVIDENCE' };
  }
  if (
    attempt.actor === 'dispatcher' &&
    contract.manualOverride.mode === 'required' &&
    (
      !attempt.manualOverride?.reasonCode.trim() ||
      !attempt.manualOverride.note.trim() ||
      !attempt.manualOverride.actorId.trim()
    )
  ) {
    return { ok: false, reason: 'MANUAL_OVERRIDE_REQUIRED' };
  }
  return {
    ok: true,
    transition: contract,
    nextState: contract.to === 'same'
      ? attempt.currentState
      : contract.to as CanonicalState,
    nextPrimaryVersion:
      contract.expected.versionEffect === 'increment'
        ? authorityVersions![String(contract.expected.authorityKeys[0])]!.current + 1
        : authorityVersions![String(contract.expected.authorityKeys[0])]!.current,
  };
}

export type CurrentBridgeGapCode =
  | 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION'
  | 'CURRENT_DECLINE_EXPOSED'
  | 'CURRENT_ACK_LIMITED_TO_OFFERED_V1';

export interface CurrentCompatibilityBridgeFixture {
  id: string;
  surface: 'api' | 'client';
  sourceFile: string;
  action: 'accept' | 'decline' | 'ack_receipt';
  currentBehavior:
    | 'changes_pending_acceptance_or_offered_to_assigned_or_accepted'
    | 'permits_driver_decline_and_terminalizes_local_or_server_offer'
    | 'technical_ack_exists_but_requires_atomic_v1_offered_state';
  evidenceSnippets: readonly string[];
  expectedCurrentInvalidDiagnostic: CurrentBridgeGapCode;
}

/**
 * Inventory fixture for current code that T01 is not authorized to change.
 * Tests keep the incompatibility visible until T03 replaces the bridge.
 */
export const CURRENT_COMPATIBILITY_BRIDGE_FIXTURES:
readonly CurrentCompatibilityBridgeFixture[] = [
  {
    id: 'api.orders.accept',
    surface: 'api',
    sourceFile: 'app/api/driver/v1/orders/accept/route.ts',
    action: 'accept',
    currentBehavior: 'changes_pending_acceptance_or_offered_to_assigned_or_accepted',
    evidenceSnippets: [
      "executeAtomicDriverTransition(c, m.driver.id, body, 'accept')",
      ".update({ state: 'assigned'",
    ],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION',
  },
  {
    id: 'api.me.accept_tour',
    surface: 'api',
    sourceFile: 'app/api/driver/v1/me/accept-tour/route.ts',
    action: 'accept',
    currentBehavior: 'changes_pending_acceptance_or_offered_to_assigned_or_accepted',
    evidenceSnippets: [
      "svc, drv.id, body, 'accept'",
      ".update({ state: 'assigned'",
    ],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION',
  },
  {
    id: 'api.offers.transition.accept',
    surface: 'api',
    sourceFile: 'app/api/driver/v1/offers/transition/route.ts',
    action: 'accept',
    currentBehavior: 'changes_pending_acceptance_or_offered_to_assigned_or_accepted',
    evidenceSnippets: ["'accept', 'decline'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION',
  },
  {
    id: 'api.offers.transition.decline',
    surface: 'api',
    sourceFile: 'app/api/driver/v1/offers/transition/route.ts',
    action: 'decline',
    currentBehavior: 'permits_driver_decline_and_terminalizes_local_or_server_offer',
    evidenceSnippets: ["'accept', 'decline'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_DECLINE_EXPOSED',
  },
  {
    id: 'client.atomic_offer.accept',
    surface: 'client',
    sourceFile: 'app/fahrer/app/atomic-offer-client-state.ts',
    action: 'accept',
    currentBehavior: 'changes_pending_acceptance_or_offered_to_assigned_or_accepted',
    evidenceSnippets: ["| 'accept'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION',
  },
  {
    id: 'client.atomic_offer.decline',
    surface: 'client',
    sourceFile: 'app/fahrer/app/atomic-offer-client-state.ts',
    action: 'decline',
    currentBehavior: 'permits_driver_decline_and_terminalizes_local_or_server_offer',
    evidenceSnippets: ["| 'decline'", "action === 'decline'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_DECLINE_EXPOSED',
  },
  {
    id: 'client.claim_batch.accept',
    surface: 'client',
    sourceFile: 'app/fahrer/app/client.tsx',
    action: 'accept',
    currentBehavior: 'changes_pending_acceptance_or_offered_to_assigned_or_accepted',
    evidenceSnippets: ["runAtomicAction('accept'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION',
  },
  {
    id: 'api.offers.ack',
    surface: 'api',
    sourceFile: 'app/api/driver/v1/offers/ack/route.ts',
    action: 'ack_receipt',
    currentBehavior: 'technical_ack_exists_but_requires_atomic_v1_offered_state',
    evidenceSnippets: ["fn_dispatch_ack_offer_v1"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACK_LIMITED_TO_OFFERED_V1',
  },
  {
    id: 'client.native_offer.ack',
    surface: 'client',
    sourceFile: 'app/fahrer/app/native-offer-bridge.tsx',
    action: 'ack_receipt',
    currentBehavior: 'technical_ack_exists_but_requires_atomic_v1_offered_state',
    evidenceSnippets: ["'/api/driver/v1/offers/ack'"],
    expectedCurrentInvalidDiagnostic: 'CURRENT_ACK_LIMITED_TO_OFFERED_V1',
  },
];

export function diagnoseCurrentCompatibilityBridge(
  fixture: CurrentCompatibilityBridgeFixture,
): CurrentBridgeGapCode {
  if (
    fixture.currentBehavior ===
    'changes_pending_acceptance_or_offered_to_assigned_or_accepted'
  ) {
    return 'CURRENT_ACCEPT_IS_OPERATIONAL_DECISION';
  }
  if (
    fixture.currentBehavior ===
    'permits_driver_decline_and_terminalizes_local_or_server_offer'
  ) {
    return 'CURRENT_DECLINE_EXPOSED';
  }
  return 'CURRENT_ACK_LIMITED_TO_OFFERED_V1';
}

export type TargetCompatibilityBridgeDecision =
  | {
      legacyAction: 'accept';
      targetAction: 'ack_receipt';
      httpStatus: 200;
      stateEffect: 'unchanged';
      versionEffect: 'unchanged';
    }
  | {
      legacyAction: 'decline';
      targetAction: null;
      httpStatus: 409;
      reasonCode: 'DRIVER_DECLINE_NOT_SUPPORTED';
      snapshot: {
        required: true;
        source: 'canonical_server_snapshot';
      };
      supportedExceptionKinds: typeof DRIVER_EXCEPTION_KINDS;
    };

export function decideTargetCompatibilityBridge(
  legacyAction: 'accept' | 'decline',
): TargetCompatibilityBridgeDecision {
  return legacyAction === 'accept'
    ? {
        legacyAction: 'accept',
        targetAction: 'ack_receipt',
        httpStatus: 200,
        stateEffect: 'unchanged',
        versionEffect: 'unchanged',
      }
    : {
        legacyAction: 'decline',
        targetAction: null,
        httpStatus: 409,
        reasonCode: 'DRIVER_DECLINE_NOT_SUPPORTED',
        snapshot: {
          required: true,
          source: 'canonical_server_snapshot',
        },
        supportedExceptionKinds: DRIVER_EXCEPTION_KINDS,
      };
}

export type MappingDisposition =
  | 'direct'
  | 'cutover_conversion'
  | 'terminal_history_only'
  | 'context_required_default_off';

export interface LegacyStateMapping {
  sourceModel: string;
  domain: CanonicalDomain;
  sourceState: string;
  targetState: string;
  disposition: MappingDisposition;
  note: string;
}

export const LEGACY_STATE_MAPPINGS: readonly LegacyStateMapping[] = [
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'neu', targetState: 'confirmed', disposition: 'direct', note: 'New delivery order.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'bestätigt', targetState: 'confirmed', disposition: 'direct', note: 'Confirmed spelling retained only in projection.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'pending', targetState: 'confirmed', disposition: 'direct', note: 'English alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'confirmed', targetState: 'confirmed', disposition: 'direct', note: 'English alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'scheduled', targetState: 'scheduled', disposition: 'direct', note: 'Requires persistent release_at.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'released', targetState: 'confirmed', disposition: 'direct', note: 'Release becomes an event, not a durable target state.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'in_zubereitung', targetState: 'preparing', disposition: 'direct', note: 'German alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'preparing', targetState: 'preparing', disposition: 'direct', note: 'English alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'fertig', targetState: 'ready', disposition: 'direct', note: 'German alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'ready', targetState: 'ready', disposition: 'direct', note: 'English alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'bereit_zur_lieferung', targetState: 'ready', disposition: 'direct', note: 'Observed analytics alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'picked_up', targetState: 'picked_up', disposition: 'direct', note: 'Atomic/API alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'abgeholt', targetState: 'picked_up', disposition: 'context_required_default_off', note: 'Delivery vs pickup order must be checked.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'unterwegs', targetState: 'out_for_delivery', disposition: 'direct', note: 'German delivery alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'geliefert', targetState: 'delivered', disposition: 'direct', note: 'German terminal alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'delivered', targetState: 'delivered', disposition: 'direct', note: 'English terminal alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'abgeschlossen', targetState: 'delivered', disposition: 'context_required_default_off', note: 'Only delivery orders may map to delivered.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'storniert', targetState: 'cancelled', disposition: 'direct', note: 'German cancellation alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'cancelled', targetState: 'cancelled', disposition: 'direct', note: 'English cancellation alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'abgebrochen', targetState: 'cancelled', disposition: 'direct', note: 'Observed cancellation alias.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'abgelehnt', targetState: 'cancelled', disposition: 'terminal_history_only', note: 'Historical order rejection; no target driver rejection.' },
  { sourceModel: 'customer_orders.status', domain: 'order', sourceState: 'rejected', targetState: 'cancelled', disposition: 'terminal_history_only', note: 'Historical order rejection; no target driver rejection.' },

  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'offline', targetState: 'offline', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'idle', targetState: 'available', disposition: 'direct', note: 'Canonical rename.' },
  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'assigned', targetState: 'assigned', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'at_restaurant', targetState: 'at_pickup', disposition: 'direct', note: 'Pickup is not necessarily a restaurant.' },
  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'en_route', targetState: 'delivering', disposition: 'direct', note: 'Canonical rename.' },
  { sourceModel: 'mise_drivers.state', domain: 'driver', sourceState: 'returning', targetState: 'returning', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'driver_status.ist_online', domain: 'driver', sourceState: 'false', targetState: 'offline', disposition: 'cutover_conversion', note: 'Read-only compatibility after cutover.' },
  { sourceModel: 'driver_status.ist_online', domain: 'driver', sourceState: 'true', targetState: 'available', disposition: 'context_required_default_off', note: 'Active assignment/trip must override available.' },
  { sourceModel: 'driver_status.aktueller_batch_id', domain: 'driver', sourceState: 'IS NULL', targetState: 'offline|available|returning', disposition: 'context_required_default_off', note: 'Online/session and canonical trip evidence choose the target.' },
  { sourceModel: 'driver_status.aktueller_batch_id', domain: 'driver', sourceState: 'IS NOT NULL', targetState: 'assigned|at_pickup|delivering|exception', disposition: 'context_required_default_off', note: 'Batch ID alone does not prove lifecycle phase.' },

  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'pending_acceptance', targetState: 'assigned', disposition: 'cutover_conversion', note: 'Server assignment removes acceptance wait.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'assigned', targetState: 'assigned', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'at_restaurant', targetState: 'at_pickup', disposition: 'direct', note: 'Canonical rename.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'picked_up', targetState: 'ready_to_depart', disposition: 'direct', note: 'Pickup completed but departure not yet proven.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'in_progress', targetState: 'in_progress', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'completed', targetState: 'completed', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'mise_delivery_batches.state', domain: 'trip', sourceState: 'cancelled', targetState: 'cancelled', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'delivery_batches.status', domain: 'trip', sourceState: 'pickup', targetState: 'planned|assigned', disposition: 'context_required_default_off', note: 'Driver/claim context is required.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'pending_acceptance', targetState: 'assigned', disposition: 'cutover_conversion', note: 'Bridge alias.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'assigned', targetState: 'assigned', disposition: 'direct', note: 'Bridge alias.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'at_restaurant', targetState: 'at_pickup', disposition: 'direct', note: 'Bridge alias.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'picked_up', targetState: 'ready_to_depart', disposition: 'direct', note: 'Bridge alias; departure is not proven.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'in_progress', targetState: 'in_progress', disposition: 'direct', note: 'Bridge alias.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'completed', targetState: 'completed', disposition: 'direct', note: 'Bridge alias.' },
  { sourceModel: 'delivery_batches.state', domain: 'trip', sourceState: 'cancelled', targetState: 'cancelled', disposition: 'direct', note: 'Bridge alias.' },

  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'offered', targetState: 'assigned', disposition: 'cutover_conversion', note: 'Drain or atomically convert; do not wait for driver decision.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'accepted', targetState: 'assigned', disposition: 'cutover_conversion', note: 'Acceptance history is retained as audit only.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'declined', targetState: 'cancelled', disposition: 'terminal_history_only', note: 'Historical only; decline is absent from target actions.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'expired', targetState: 'cancelled', disposition: 'terminal_history_only', note: 'Historical offer expiry; assignment ACK does not expire.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'cancelled', targetState: 'cancelled', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'picked_up', targetState: 'picked_up', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'in_progress', targetState: 'in_progress', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'dispatch_offer_assignments.state', domain: 'assignment', sourceState: 'completed', targetState: 'completed', disposition: 'direct', note: 'Direct.' },

  { sourceModel: 'mise_delivery_batch_stops', domain: 'stop', sourceState: 'completed_at IS NULL AND arrived_at IS NULL', targetState: 'pending', disposition: 'direct', note: 'No arrival or completion evidence.' },
  { sourceModel: 'mise_delivery_batch_stops', domain: 'stop', sourceState: 'completed_at IS NULL AND arrived_at IS NOT NULL', targetState: 'arrived', disposition: 'context_required_default_off', note: 'Arrival is proven; servicing is not.' },
  { sourceModel: 'mise_delivery_batch_stops', domain: 'stop', sourceState: 'completed_at IS NOT NULL', targetState: 'completed', disposition: 'direct', note: 'Terminal stop.' },
  { sourceModel: 'delivery_batch_stops', domain: 'stop', sourceState: 'geliefert_am IS NULL', targetState: 'pending', disposition: 'context_required_default_off', note: 'Legacy row has no arrival/service distinction.' },
  { sourceModel: 'delivery_batch_stops', domain: 'stop', sourceState: 'geliefert_am IS NOT NULL', targetState: 'completed', disposition: 'direct', note: 'Legacy completion timestamp.' },
  { sourceModel: 'delivery_batch_stops', domain: 'stop', sourceState: 'bridge row without geliefert_am', targetState: 'pending', disposition: 'context_required_default_off', note: 'Migration-004 shape proves sequence only.' },

  { sourceModel: 'kitchen_timings.status', domain: 'kitchen', sourceState: 'scheduled', targetState: 'scheduled', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'kitchen_timings.status', domain: 'kitchen', sourceState: 'cooking', targetState: 'preparing', disposition: 'direct', note: 'Canonical rename.' },
  { sourceModel: 'kitchen_timings.status', domain: 'kitchen', sourceState: 'ready', targetState: 'ready', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'kitchen_timings.status', domain: 'kitchen', sourceState: 'picked_up', targetState: 'picked_up', disposition: 'direct', note: 'Direct.' },

  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'offline', targetState: 'unavailable', disposition: 'direct', note: 'No active tracker.' },
  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'watching', targetState: 'unavailable', disposition: 'context_required_default_off', note: 'Watching is client state, not proof of a trusted point.' },
  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'fresh', targetState: 'fresh', disposition: 'cutover_conversion', note: 'Only after sequence/time/quality validation.' },
  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'stale', targetState: 'stale', disposition: 'direct', note: 'Direct.' },
  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'permission_error', targetState: 'unavailable', disposition: 'direct', note: 'Reason retained separately.' },
  { sourceModel: 'legacy GPS lifecycle', domain: 'gps', sourceState: 'offline_network', targetState: 'unavailable', disposition: 'direct', note: 'Reason retained separately.' },

  { sourceModel: 'mise_push_outbox', domain: 'notification_outbox', sourceState: 'sent_at IS NULL AND failed_at IS NULL', targetState: 'pending', disposition: 'cutover_conversion', note: 'Add lease/attempt semantics before writer activation.' },
  { sourceModel: 'mise_push_outbox', domain: 'notification_outbox', sourceState: 'sent_at IS NOT NULL', targetState: 'sent', disposition: 'direct', note: 'Provider send only, not app receipt.' },
  { sourceModel: 'mise_push_outbox', domain: 'notification_outbox', sourceState: 'failed_at IS NOT NULL', targetState: 'dead_letter|retry_wait', disposition: 'context_required_default_off', note: 'Retryability and attempt budget required.' },
  { sourceModel: 'driver_push_outbox', domain: 'notification_outbox', sourceState: 'sent_at IS NULL AND error IS NULL', targetState: 'pending', disposition: 'cutover_conversion', note: 'Legacy web-push pending row.' },
  { sourceModel: 'driver_push_outbox', domain: 'notification_outbox', sourceState: 'sent_at IS NOT NULL AND error IS NULL', targetState: 'sent', disposition: 'direct', note: 'Provider send only, not app receipt.' },
  { sourceModel: 'driver_push_outbox', domain: 'notification_outbox', sourceState: 'error IS NOT NULL', targetState: 'dead_letter|retry_wait', disposition: 'context_required_default_off', note: 'Retryability and attempt budget required.' },
];

export const DATABASE_INVARIANTS = [
  'one enabled dispatch writer per tenant; writer switch and assignment share a tenant lock',
  'one active assignment per order and no incompatible active assignment per driver',
  'assignment, trip, stops, order claim, driver load, audit and outbox commit in one transaction',
  'every critical aggregate has a monotonically increasing non-negative version',
  'every retried mutation has a unique scoped action key and immutable request fingerprint/result',
  'technical ACK changes receipt metadata only and never changes assignment state or version',
  'normal driver decline does not exist; only structured exceptions can initiate reassignment',
  'trip departure requires all assigned orders and required items to have server-resolved outcomes',
  'stop order and next stop are server-authoritative under a route version',
  'GPS history is unique by driver/session/sequence; current advances only after explicit monotonic-current evidence, otherwise valid history-only or rejection applies',
  'event time and receipt time are stored separately for device and external events',
  'persistent deadlines back scheduled release, holds, freshness, leases and exception escalation',
  'canonical lifecycle tables deny direct critical writes from browser/mobile roles',
  'push/outbox delivery is not authoritative; clients recover from versioned server snapshots',
  'manual overrides require actor, reason, note, expected state/authority versions, action key and audit event',
  'retention is configuration-driven and production GPS retention remains unapproved/default-off',
] as const;
