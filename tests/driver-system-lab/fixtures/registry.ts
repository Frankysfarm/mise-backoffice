export const routingFixtures = {
  "evening-route": { provider: "google-contract-simulator", matrixSeconds: [[0, 240, 420], [240, 0, 180], [420, 180, 0]] },
} as const

export const trafficFixtures = {
  "evening-traffic": { multiplier: 1.35, validFromSecond: 0, validUntilSecond: 7_200 },
} as const

export const pushFixtures = {
  "reliable-push": { delivery: "immediate", duplicates: 0, lossRate: 0 },
} as const

export const networkFixtures = {
  "reliable-network": { latencyMs: 20, jitterMs: 0, lossRate: 0 },
  "lossy-network": { latencyMs: 250, jitterMs: 100, lossRate: 0.2 },
} as const

export const gpsFixtures = {
  "near-store": [{ atSeconds: 0, lat: 52.52, lng: 13.4 }, { atSeconds: 30, lat: 52.521, lng: 13.401 }],
  "west-route": [{ atSeconds: 0, lat: 52.5, lng: 13.38 }, { atSeconds: 30, lat: 52.505, lng: 13.386 }],
} as const

export const scenarioActions = new Set([
  "place-order", "cancel-order", "confirm-payment", "delay-payment",
  "start-preparation", "finish-preparation", "run-dispatch", "accept-offer",
  "pick-item", "persist-route", "depart-tour", "arrive-stop", "deliver-order",
  "accept-append", "reject-append", "replan-route", "reload-app", "reconnect",
])

export const scenarioFaults = new Set([
  "network-drop", "network-restore", "worker-stop", "worker-restart",
  "push-drop", "duplicate-push", "gps-stale", "gps-out-of-order", "route-timeout",
])

export const infrastructureTargets = new Set(["dispatch-worker", "push-worker", "routing-provider", "database-session"])
export const invariantIds = new Set([
  "no-duplicate-assignment", "all-orders-accounted", "all-picked-before-depart",
  "route-before-depart", "pickup-before-dropoff", "terminal-order-not-redispatched",
  "tenant-isolation", "provider-send-not-after-terminal", "no-partial-state",
])
export const uiStateIds = new Set([
  "order-visible", "kitchen-order-visible", "offer-visible", "pickup-visible",
  "route-visible", "on-route-visible", "delivered-visible", "error-visible",
])

export function hasOwnFixture(registry: object, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, id)
}
