import { assertSnapshotInvariants, routeStopFingerprint } from "../invariants/monitor"
import type { LabSnapshot } from "../invariants/types"
import type { TestLabEnvironment } from "../support/environment"

export type TimelineEntry = Readonly<{ sequence: number; actor: string; action: string; observedAt: string; snapshot: LabSnapshot }>

function clone(snapshot: LabSnapshot): LabSnapshot {
  return structuredClone(snapshot)
}

export function runSingleOrderModel(environment: TestLabEnvironment, start = new Date("2026-08-01T12:00:00.000Z")): readonly TimelineEntry[] {
  const tenantId = environment.tenantId
  const run = environment.runId
  const row = { testRunId: run, tenantId }
  const snapshot: LabSnapshot = {
    testRunId: run, observedAt: start.toISOString(),
    orders: [{ ...row, id: "order-1", status: "pending", unresolvedReason: "awaiting-dispatch" }],
    assignments: [], drivers: [{ ...row, id: "driver-1", status: "idle", capacity: 2, currentCapacity: 0 }],
    batches: [], stops: [], routePlans: [], picks: [], pushes: [], audits: [],
  }
  const timeline: TimelineEntry[] = []
  const record = (actor: string, action: string) => {
    snapshot.observedAt = new Date(start.getTime() + timeline.length * 1000).toISOString()
    assertSnapshotInvariants(snapshot)
    timeline.push({ sequence: timeline.length + 1, actor, action, observedAt: snapshot.observedAt, snapshot: clone(snapshot) })
  }
  record("customer-1", "place-order-through-storefront")
  snapshot.orders[0] = { ...snapshot.orders[0], status: "assigned", unresolvedReason: undefined }
  snapshot.assignments.push({ ...row, id: "assignment-1", orderId: "order-1", driverId: "driver-1", batchId: "batch-1", status: "active", idempotencyKey: `${run}:assign:1` })
  snapshot.drivers[0] = { ...snapshot.drivers[0], status: "delivering", currentCapacity: 1 }
  snapshot.batches.push({ ...row, id: "batch-1", driverId: "driver-1", status: "active", routeVersion: 1, departed: false })
  snapshot.stops.push(
    { ...row, id: "stop-pickup-1", batchId: "batch-1", assignmentId: "assignment-1", orderId: "order-1", kind: "pickup", sequence: 1, status: "open" },
    { ...row, id: "stop-dropoff-1", batchId: "batch-1", assignmentId: "assignment-1", orderId: "order-1", kind: "dropoff", sequence: 2, status: "open" },
  )
  snapshot.audits.push({ ...row, id: "audit-assign-1", entityId: "assignment-1", mutation: "assign", correlationId: `${run}:corr:assign` })
  record("dispatcher-1", "dispatch")
  snapshot.picks.push({ ...row, id: "pick-1", assignmentId: "assignment-1", requiredItems: 2, pickedItems: 2, missingItems: 0, clarifiedMissingItems: 0 })
  record("kitchen-1", "release-and-driver-pick")
  snapshot.routePlans.push({ ...row, id: "route-1", batchId: "batch-1", routeVersion: 1, provider: "fixture-google", stopFingerprint: routeStopFingerprint(snapshot.stops) })
  record("system-1", "persist-google-contract-route")
  snapshot.batches[0] = { ...snapshot.batches[0], departed: true }
  record("driver-1", "depart")
  snapshot.orders[0] = { ...snapshot.orders[0], status: "delivered" }
  snapshot.assignments[0] = { ...snapshot.assignments[0], status: "completed" }
  snapshot.batches[0] = { ...snapshot.batches[0], status: "completed" }
  snapshot.stops = snapshot.stops.map((stop) => ({ ...stop, status: "completed" }))
  snapshot.drivers[0] = { ...snapshot.drivers[0], status: "idle", currentCapacity: 0 }
  snapshot.audits.push({ ...row, id: "audit-deliver-1", entityId: "order-1", mutation: "deliver", correlationId: `${run}:corr:deliver` })
  record("driver-1", "deliver")
  return timeline
}
