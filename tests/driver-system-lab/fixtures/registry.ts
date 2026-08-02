export const routingFixtures = {
  "evening-route": { provider: "google-contract-simulator", matrixSeconds: [[0, 240, 420], [240, 0, 180], [420, 180, 0]] },
  "slow-route": { provider: "google-contract-simulator", delayMs: 4_000, matrixSeconds: [[0, 600], [600, 0]] },
  "partial-route": { provider: "google-contract-simulator", matrixSeconds: [[0, null], [420, 0]], missingPairs: [[0, 1]] },
  "unavailable-route": { provider: "google-contract-simulator", error: "UNAVAILABLE", matrixSeconds: [] },
} as const

export const trafficFixtures = {
  "evening-traffic": { multiplier: 1.35, validFromSecond: 0, validUntilSecond: 7_200 },
} as const

export const pushFixtures = {
  "reliable-push": { delivery: "immediate", duplicates: 0, lossRate: 0 },
  "lost-push": { delivery: "dropped", duplicates: 0, lossRate: 1 },
  "duplicate-push": { delivery: "immediate", duplicates: 1, lossRate: 0 },
  "delayed-push": { delivery: "delayed", delayMs: 120_000, duplicates: 0, lossRate: 0 },
} as const

export const networkFixtures = {
  "reliable-network": { latencyMs: 20, jitterMs: 0, lossRate: 0 },
  "lossy-network": { latencyMs: 250, jitterMs: 100, lossRate: 0.2 },
  "realtime-disconnect": { latencyMs: 20, jitterMs: 0, lossRate: 0, realtimeDisconnectAtSeconds: 60, reconnectAtSeconds: 120 },
} as const

export const paymentFixtures = {
  "successful-payment": { confirmations: 1, delayMs: 0, outcome: "confirmed" },
  "duplicate-payment": { confirmations: 2, delayMs: 0, outcome: "confirmed" },
  "delayed-payment": { confirmations: 1, delayMs: 300_000, outcome: "confirmed" },
} as const

export const geocodingFixtures = {
  "successful-geocoding": { outcome: "matched", lat: 52.52, lng: 13.4 },
  "failed-geocoding": { outcome: "zero-results", lat: null, lng: null },
} as const

export const clockFixtures = {
  "stable-clock": { skewMs: 0, tickMode: "virtual" },
  "skewed-clock": { skewMs: 120_000, tickMode: "virtual" },
} as const

export const infrastructureFixtures = {
  "healthy-infrastructure": { events: [] },
  "worker-crash-restart": { events: [{ atSeconds: 60, type: "worker-crash" }, { atSeconds: 75, type: "worker-restart" }] },
  "database-timeout": { events: [{ atSeconds: 60, type: "database-timeout", durationMs: 5_000 }] },
  "disk-near-full": { events: [{ atSeconds: 60, type: "disk-usage", percent: 95 }] },
  "cache-growth": { events: [{ atSeconds: 60, type: "cache-entries", count: 100_000 }] },
  "queue-backlog": { events: [{ atSeconds: 60, type: "queue-depth", count: 5_000 }] },
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
export const actionActorKinds: Readonly<Record<string, readonly string[]>> = {
  "place-order": ["customer"], "cancel-order": ["customer"], "confirm-payment": ["customer"], "delay-payment": ["customer"],
  "start-preparation": ["kitchen"], "finish-preparation": ["kitchen"],
  "run-dispatch": ["system", "dispatcher"], "persist-route": ["system"], "replan-route": ["system", "dispatcher"],
  "accept-offer": ["driver"], "pick-item": ["driver"], "depart-tour": ["driver"], "arrive-stop": ["driver"], "deliver-order": ["driver"],
  "accept-append": ["driver"], "reject-append": ["driver"], "reload-app": ["driver", "kitchen", "dispatcher"], "reconnect": ["driver", "kitchen", "dispatcher"],
}

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
