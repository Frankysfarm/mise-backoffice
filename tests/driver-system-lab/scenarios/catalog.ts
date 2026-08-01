export type ScenarioDescriptor = Readonly<{ id: string; suite: string; risk: "P0" | "P1" | "P2"; title: string }>

const groups: Readonly<Record<string, readonly string[]>> = {
  smoke: ["single-order-single-driver", "order-kitchen-dispatch-delivery", "two-drivers-one-order", "two-orders-one-driver", "lost-push-snapshot-recovery"],
  bundle: ["one-instead-of-four", "two-instead-of-four", "three-valid-four-invalid", "four-safely-valid", "bike-versus-car", "item-volume-capacity", "different-ready-times", "product-quality-limit", "oldest-risk-first", "global-multi-driver-distribution"],
  kitchen: ["no-wait", "short-hold", "fifteen-minute-cap", "deadline-override", "kitchen-early", "kitchen-late", "growing-queue", "hold-watchdog-restart", "cancel-during-hold", "duplicate-release", "kitchen-realtime-loss"],
  departure: ["all-orders-picked", "required-item-missing", "one-bundle-order-incomplete", "duplicate-pick-click", "offline-pick-replay", "route-missing", "route-version-stale", "google-fails-before-departure", "route-persisted", "separate-depart-transition"],
  routing: ["current-gps-origin", "completed-stops-excluded", "cancelled-stops-excluded", "pickup-before-dropoff", "mid-tour-append", "middle-cancel", "off-route", "traffic-change", "partial-matrix", "google-timeout", "stale-route-cas", "concurrent-replans", "identical-replan-retry"],
  push: ["initial-push", "duplicate-producer", "lost-push", "late-push", "cancel-before-send", "reassign-before-send", "offline-before-send", "app-ack-stops-reminder", "technical-ack-not-accept", "append-proposal-accepted", "append-proposal-expired", "append-proposal-ignored"],
  lifecycle: ["two-order-tour", "four-order-tour", "three-sequential-dropoffs", "batch-ends-on-last", "middle-order-cancelled", "last-two-dropoffs-race", "duplicate-delivery", "delivered-order-not-redispatched", "driver-state-through-rest-tour"],
  device: ["network-loss", "reconnect", "app-reload", "two-tabs", "stale-gps", "out-of-order-gps", "impossible-gps-jump", "locked-screen", "background-app", "terminated-app-contract", "permission-revoked", "low-power-mode", "old-app-new-backend"],
  race: ["two-dispatch-workers", "dispatch-versus-cancel", "dispatch-versus-delivery", "pickup-versus-append", "pickup-versus-cancel", "push-claim-versus-accept", "worker-crash-each-write", "restart-during-hold", "restart-route-pending", "duplicate-queue-worker", "writer-lease-switch"],
  security: ["foreign-order", "foreign-driver", "foreign-tenant", "cron-without-token", "expired-session", "direct-browser-mutation", "service-role-boundary", "rls-denial", "rate-limit", "old-request-replay", "production-url-denied"],
  soak: ["simultaneous-orders", "multiple-stores", "multiple-drivers", "rush-hour-matrix", "continuous-worker", "push-backlog", "reconnect-storm", "bounded-cache", "no-listener-leak", "no-long-run-orphans"],
}

export const scenarioCatalog: readonly ScenarioDescriptor[] = Object.entries(groups).flatMap(([suite, names]) =>
  names.map((name) => ({ id: `${suite}-${name}`, suite, risk: ["smoke", "departure", "race", "security"].includes(suite) ? "P0" : "P1", title: name.split("-").join(" ") } as const)),
)

export function scenariosForSuite(suite: string): readonly ScenarioDescriptor[] {
  if (suite === "full" || suite === "nightly" || suite === "soak") return suite === "soak" ? scenarioCatalog.filter((item) => item.suite === "soak") : scenarioCatalog
  const aliases: Record<string, readonly string[]> = { dispatch: ["bundle"], ui: ["smoke", "departure", "lifecycle"], offline: ["device"], chaos: ["race"], kitchen: ["kitchen"], routing: ["routing"], push: ["push"], security: ["security"], smoke: ["smoke"] }
  return scenarioCatalog.filter((item) => (aliases[suite] ?? [suite]).includes(item.suite))
}
