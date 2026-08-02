import type { ActorKind } from './runtime'

export type CustomerBehavior =
  | 'instant'
  | 'multi-item'
  | 'large-order'
  | 'short-route'
  | 'long-route'
  | 'tight-deadline'
  | 'scheduled'
  | 'cancel-before-kitchen'
  | 'cancel-during-prep'
  | 'cancel-after-assignment'
  | 'geocoding-error'
  | 'duplicate-payment-webhook'
  | 'delayed-payment'
  | 'order-during-worker-restart'
  | 'simultaneous-orders'

export type KitchenBehavior =
  | 'normal'
  | 'empty'
  | 'overloaded'
  | 'early-ready'
  | 'late-ready'
  | 'prep-time-change'
  | 'missing-required-item'
  | 'bundle-order-delayed'
  | 'realtime-reload'
  | 'worker-restart'
  | 'release-at-hold'
  | 'deadline-override'
  | 'duplicate-ready'
  | 'cancel-during-hold'
  | 'invalid-transition'

export type DriverBehavior =
  | 'bike-small'
  | 'car-large'
  | 'near-store'
  | 'far-better-route'
  | 'active-single'
  | 'active-multi'
  | 'full-capacity'
  | 'stale-gps'
  | 'inaccurate-gps'
  | 'offline'
  | 'network-loss'
  | 'app-restart'
  | 'two-tabs'
  | 'duplicate-notification'
  | 'off-route'
  | 'waiting-at-kitchen'
  | 'mid-tour-consent'
  | 'expired-proposal'
  | 'vehicle-emergency'
  | 'unsafe-shift-end'
  | 'three-deliveries'
  | 'middle-order-cancelled'
  | 'skip-stop-attempt'
  | 'depart-before-pick-attempt'
  | 'depart-without-route-attempt'

export type DispatcherBehavior =
  | 'observe-live-state'
  | 'inspect-unresolved'
  | 'inspect-holds'
  | 'inspect-driver-state'
  | 'inspect-route-sequence'
  | 'inspect-dispatch-audit'
  | 'manual-exception'
  | 'versioned-override'
  | 'cancel-and-reassign'
  | 'inspect-watchdogs'

export interface ActorProfile<TBehavior extends string> {
  id: string
  kind: ActorKind
  behavior: TBehavior
  displayName: string
  testRunId: string
  tenantId: string
  metadata: Readonly<Record<string, string | number | boolean>>
}

function configuredMetadata(kind: ActorKind, behavior: string, index: number): ActorProfile<string>['metadata'] {
  const customer: Record<string, Record<string, string | number | boolean>> = {
    'instant': { itemCount: 1, routeKm: 4, paymentDelaySeconds: 0 },
    'multi-item': { itemCount: 5, routeKm: 4, paymentDelaySeconds: 0 },
    'large-order': { itemCount: 18, routeKm: 5, volumeUnits: 32 },
    'short-route': { itemCount: 2, routeKm: 0.8 }, 'long-route': { itemCount: 2, routeKm: 18 },
    'tight-deadline': { itemCount: 2, deadlineMinutes: 20 }, 'scheduled': { itemCount: 3, scheduleOffsetMinutes: 120 },
    'cancel-before-kitchen': { cancelPhase: 'before-kitchen', cancelAtSeconds: 20 },
    'cancel-during-prep': { cancelPhase: 'during-prep', cancelAtSeconds: 360 },
    'cancel-after-assignment': { cancelPhase: 'after-assignment', cancelAtSeconds: 600 },
    'geocoding-error': { addressValidity: 'invalid', geocodingResult: 'zero-results' },
    'duplicate-payment-webhook': { paymentWebhookCount: 2, idempotencyExpected: true },
    'delayed-payment': { paymentDelaySeconds: 300, initialPaymentState: 'pending' },
    'order-during-worker-restart': { orderAtRestartSecond: 30, workerUnavailableSeconds: 10 },
    'simultaneous-orders': { concurrencyGroup: 'customer-burst', groupSize: 15 },
  }
  const kitchen: Record<string, Record<string, string | number | boolean>> = {
    'normal': { queueDepth: 2, prepMinutes: 10 }, 'empty': { queueDepth: 0, prepMinutes: 8 },
    'overloaded': { queueDepth: 20, prepMinutes: 28 }, 'early-ready': { queueDepth: 2, plannedPrepMinutes: 12, actualPrepMinutes: 4 },
    'late-ready': { queueDepth: 4, plannedPrepMinutes: 8, actualPrepMinutes: 25 },
    'prep-time-change': { initialPrepMinutes: 8, changedPrepMinutes: 18, changeAtSeconds: 120 },
    'missing-required-item': { missingRequiredItem: true, missingItemIndex: 1 },
    'bundle-order-delayed': { delayedBundleOrderIndex: 2, delayMinutes: 15 },
    'realtime-reload': { realtimeDisconnectAtSeconds: 60, reloadAtSeconds: 90 },
    'worker-restart': { workerCrashAtSeconds: 60, workerRestartAtSeconds: 75 },
    'release-at-hold': { releaseMode: 'hold-until', releaseOffsetSeconds: 600 },
    'deadline-override': { releaseMode: 'deadline-override', deadlineSlackMinutes: 3 },
    'duplicate-ready': { readyActionCount: 2, exactlyOnceExpected: true },
    'cancel-during-hold': { cancelAtSeconds: 240, holdUntilSeconds: 600 },
    'invalid-transition': { attemptedTransition: 'pending-to-ready', rejectionExpected: true },
  }
  const driver: Record<string, Record<string, string | number | boolean>> = {
    'bike-small': { vehicle: 'bike', capacityOrders: 2, currentLoad: 0 }, 'car-large': { vehicle: 'car', capacityOrders: 4, currentLoad: 0 },
    'near-store': { distanceToStoreKm: 0.3, routeMinutes: 2 }, 'far-better-route': { distanceToStoreKm: 7, routeMinutes: 8, trafficAdvantageMinutes: 9 },
    'active-single': { tourState: 'on-route', activeOrders: 1, currentLoad: 1 }, 'active-multi': { tourState: 'on-route', activeOrders: 3, currentLoad: 3 },
    'full-capacity': { capacityOrders: 4, currentLoad: 4, eligibleForAppend: false },
    'stale-gps': { gpsAgeSeconds: 600, gpsAccuracyMeters: 12 }, 'inaccurate-gps': { gpsAgeSeconds: 5, gpsAccuracyMeters: 500 },
    'offline': { online: false, networkState: 'offline' }, 'network-loss': { online: true, networkDropAtSeconds: 45, reconnectAtSeconds: 120 },
    'app-restart': { appRestartAtSeconds: 60, snapshotRecoveryExpected: true }, 'two-tabs': { browserTabs: 2, staleTabVersion: 1 },
    'duplicate-notification': { pushDeliveryCount: 2, notificationDedupeExpected: true }, 'off-route': { offRouteMeters: 900, replanExpected: true },
    'waiting-at-kitchen': { tourState: 'at-restaurant', waitMinutes: 12 }, 'mid-tour-consent': { tourState: 'on-route', proposalState: 'pending' },
    'expired-proposal': { proposalState: 'expired', acceptMustFail: true }, 'vehicle-emergency': { emergencyType: 'vehicle', tourState: 'on-route' },
    'unsafe-shift-end': { tourState: 'on-route', shiftEndAttempted: true, rejectionExpected: true },
    'three-deliveries': { activeOrders: 3, stopCount: 3 }, 'middle-order-cancelled': { activeOrders: 3, cancelledStopIndex: 2 },
    'skip-stop-attempt': { attemptedStopIndex: 2, expectedStopIndex: 1, rejectionExpected: true },
    'depart-before-pick-attempt': { pickedRequiredItems: 0, requiredItems: 3, departureMustFail: true },
    'depart-without-route-attempt': { routeVersion: 0, departureMustFail: true },
  }
  const dispatcher: Record<string, Record<string, string | number | boolean>> = {
    'observe-live-state': { view: 'live-state' }, 'inspect-unresolved': { view: 'unresolved-orders' }, 'inspect-holds': { view: 'holds' },
    'inspect-driver-state': { view: 'driver-state' }, 'inspect-route-sequence': { view: 'route-sequence' }, 'inspect-dispatch-audit': { view: 'dispatch-audit' },
    'manual-exception': { action: 'manual-exception', reasonRequired: true }, 'versioned-override': { action: 'override', expectedVersion: 2 },
    'cancel-and-reassign': { action: 'cancel-reassign', auditRequired: true }, 'inspect-watchdogs': { view: 'alerts-watchdogs' },
  }
  return { scenario: behavior, sequence: index, ...(kind === 'customer' ? customer[behavior] : kind === 'kitchen' ? kitchen[behavior] : kind === 'driver' ? driver[behavior] : dispatcher[behavior]) }
}

function profile<TBehavior extends string>(
  testRunId: string,
  tenantId: string,
  kind: ActorKind,
  behavior: TBehavior,
  index: number,
  metadata: ActorProfile<TBehavior>['metadata'] = {},
): ActorProfile<TBehavior> {
  const prefix = `lab-${testRunId}`
  const defaults = configuredMetadata(kind, behavior, index)
  return {
    id: `${prefix}-${kind}-${index}`,
    kind,
    behavior,
    displayName: `${prefix} ${kind} ${behavior}`,
    testRunId,
    tenantId,
    metadata: Object.keys(metadata).length > 0 ? metadata : defaults,
  }
}

export function createCanonicalActorProfiles(testRunId: string, tenantId: string) {
  const customers: readonly CustomerBehavior[] = [
    'instant', 'multi-item', 'large-order', 'short-route', 'long-route',
    'tight-deadline', 'scheduled', 'cancel-before-kitchen', 'cancel-during-prep',
    'cancel-after-assignment', 'geocoding-error', 'duplicate-payment-webhook',
    'delayed-payment', 'order-during-worker-restart', 'simultaneous-orders',
  ]
  const kitchens: readonly KitchenBehavior[] = [
    'normal', 'empty', 'overloaded', 'early-ready', 'late-ready', 'prep-time-change',
    'missing-required-item', 'bundle-order-delayed', 'realtime-reload', 'worker-restart',
    'release-at-hold', 'deadline-override', 'duplicate-ready', 'cancel-during-hold',
    'invalid-transition',
  ]
  const drivers: readonly DriverBehavior[] = [
    'bike-small', 'car-large', 'near-store', 'far-better-route', 'active-single',
    'active-multi', 'full-capacity', 'stale-gps', 'inaccurate-gps', 'offline',
    'network-loss', 'app-restart', 'two-tabs', 'duplicate-notification', 'off-route',
    'waiting-at-kitchen', 'mid-tour-consent', 'expired-proposal', 'vehicle-emergency',
    'unsafe-shift-end', 'three-deliveries', 'middle-order-cancelled', 'skip-stop-attempt',
    'depart-before-pick-attempt', 'depart-without-route-attempt',
  ]
  const dispatchers: readonly DispatcherBehavior[] = [
    'observe-live-state', 'inspect-unresolved', 'inspect-holds', 'inspect-driver-state',
    'inspect-route-sequence', 'inspect-dispatch-audit', 'manual-exception',
    'versioned-override', 'cancel-and-reassign', 'inspect-watchdogs',
  ]

  return {
    customers: customers.map((behavior, index) => profile(testRunId, tenantId, 'customer', behavior, index + 1)),
    kitchens: kitchens.map((behavior, index) => profile(testRunId, tenantId, 'kitchen', behavior, index + 1)),
    drivers: drivers.map((behavior, index) => profile(testRunId, tenantId, 'driver', behavior, index + 1)),
    dispatchers: dispatchers.map((behavior, index) => profile(testRunId, tenantId, 'dispatcher', behavior, index + 1)),
  } as const
}
