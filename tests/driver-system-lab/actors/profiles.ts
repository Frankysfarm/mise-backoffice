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

function profile<TBehavior extends string>(
  testRunId: string,
  tenantId: string,
  kind: ActorKind,
  behavior: TBehavior,
  index: number,
  metadata: ActorProfile<TBehavior>['metadata'] = {},
): ActorProfile<TBehavior> {
  const prefix = `lab-${testRunId}`
  return {
    id: `${prefix}-${kind}-${index}`,
    kind,
    behavior,
    displayName: `${prefix} ${kind} ${behavior}`,
    testRunId,
    tenantId,
    metadata,
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

