import assert from "node:assert/strict"
import test from "node:test"
import { assertSnapshotInvariants, InvariantViolationError, routeStopFingerprint } from "./monitor"
import type { LabSnapshot } from "./types"

const runId = "tl_invariant_0001"
const tenantId = "tl_tenant_a"
const base = { testRunId: runId, tenantId }

function validSnapshot(): LabSnapshot {
  const snapshot: LabSnapshot = {
    testRunId: runId,
    observedAt: "2026-08-01T12:00:00.000Z",
    orders: [{ ...base, id: "order-1", status: "assigned" }],
    assignments: [{ ...base, id: "assignment-1", orderId: "order-1", driverId: "driver-1", batchId: "batch-1", status: "active", idempotencyKey: "assign-1" }],
    drivers: [{ ...base, id: "driver-1", status: "delivering", capacity: 2, currentCapacity: 1 }],
    batches: [{ ...base, id: "batch-1", driverId: "driver-1", status: "active", routeVersion: 3, departed: true }],
    stops: [
      { ...base, id: "pickup-1", batchId: "batch-1", assignmentId: "assignment-1", orderId: "order-1", kind: "pickup", sequence: 1, status: "open" },
      { ...base, id: "dropoff-1", batchId: "batch-1", assignmentId: "assignment-1", orderId: "order-1", kind: "dropoff", sequence: 2, status: "open" },
    ],
    routePlans: [],
    picks: [{ ...base, id: "pick-1", assignmentId: "assignment-1", requiredItems: 2, pickedItems: 2, missingItems: 0, clarifiedMissingItems: 0 }],
    pushes: [{ ...base, id: "push-1", notificationId: "notification-1", assignmentId: "assignment-1", assignmentVersion: 1, logicalEventKey: "assignment-1:offer:1", status: "sent", providerSendCount: 1 }],
    audits: [{ ...base, id: "audit-1", entityId: "assignment-1", mutation: "assignment.activate", correlationId: "corr-1" }],
  }
  snapshot.routePlans.push({ ...base, id: "route-1", batchId: "batch-1", routeVersion: 3, provider: "fixture-google", stopFingerprint: routeStopFingerprint(snapshot.stops) })
  return snapshot
}

function expectViolation(snapshot: LabSnapshot, invariantId: string): InvariantViolationError {
  let captured: unknown
  try {
    assertSnapshotInvariants(snapshot)
  } catch (error) {
    captured = error
  }
  assert.ok(captured instanceof InvariantViolationError)
  assert.equal(captured.evidence.invariantId, invariantId)
  assert.equal(captured.evidence.testRunId, runId)
  assert.deepEqual(captured.evidence.reproduction.snapshot, snapshot)
  return captured
}

test("accepts a coherent route-before-depart snapshot", () => {
  assert.doesNotThrow(() => assertSnapshotInvariants(validSnapshot()))
})

test("fails immediately on a row from another run with structured P0 evidence", () => {
  const snapshot = validSnapshot()
  snapshot.pushes[0].testRunId = "tl_other_run_1"
  const failure = expectViolation(snapshot, "LAB.RUN_ID.CROSS_RUN_ROW")
  assert.equal(failure.evidence.severity, "P0")
  assert.deepEqual(failure.evidence.entityIds, ["push-1"])
})

test("detects duplicate active assignments before downstream checks", () => {
  const snapshot = validSnapshot()
  snapshot.assignments.push({ ...snapshot.assignments[0], id: "assignment-2", idempotencyKey: "assign-2" })
  expectViolation(snapshot, "ORDER.MULTIPLE_ACTIVE_ASSIGNMENTS")
})

test("detects unaccounted non-terminal order", () => {
  const snapshot = validSnapshot()
  snapshot.orders.push({ ...base, id: "order-orphan", status: "pending" })
  const failure = expectViolation(snapshot, "ORDER.UNACCOUNTED_NON_TERMINAL")
  assert.equal(failure.evidence.severity, "P1")
})

test("detects departure without complete picking", () => {
  const snapshot = validSnapshot()
  snapshot.picks[0].pickedItems = 1
  expectViolation(snapshot, "PICKING.DEPARTED_INCOMPLETE")
})

test("detects departure without current Google-contract plan", () => {
  const snapshot = validSnapshot()
  snapshot.routePlans = []
  expectViolation(snapshot, "ROUTE.DEPARTED_WITHOUT_CURRENT_GOOGLE_PLAN")
})

test("detects terminal push provider send", () => {
  const snapshot = validSnapshot()
  snapshot.pushes[0].status = "terminal"
  snapshot.pushes[0].terminalClaimedAt = "2026-08-01T12:00:00.000Z"
  snapshot.pushes[0].providerSentAt = "2026-08-01T12:00:01.000Z"
  expectViolation(snapshot, "PUSH.PROVIDER_SEND_AFTER_TERMINAL_CLAIM")
})

test("accepts historical send before terminal claim", () => {
  const snapshot = validSnapshot()
  snapshot.pushes[0] = { ...snapshot.pushes[0], status: "terminal", providerSentAt: "2026-08-01T11:59:59.000Z", terminalClaimedAt: "2026-08-01T12:00:00.000Z" }
  assert.doesNotThrow(() => assertSnapshotInvariants(snapshot))
})

test("rejects assignment/batch driver mismatch", () => {
  const snapshot = validSnapshot(); snapshot.batches[0].driverId = "driver-other"
  expectViolation(snapshot, "ASSIGNMENT.BATCH_DRIVER_MISMATCH")
})

test("rejects cross-tenant route plan", () => {
  const snapshot = validSnapshot(); snapshot.routePlans[0].tenantId = "tl_tenant_other"
  expectViolation(snapshot, "SECURITY.CROSS_TENANT_REFERENCE")
})

test("rejects stop order mismatch", () => {
  const snapshot = validSnapshot(); snapshot.stops[0].orderId = "wrong-order"; snapshot.routePlans[0].stopFingerprint = routeStopFingerprint(snapshot.stops)
  expectViolation(snapshot, "ROUTE.STOP_ORDER_MISMATCH")
})

test("rejects negative pick counters", () => {
  const snapshot = validSnapshot(); snapshot.picks[0].missingItems = -1
  expectViolation(snapshot, "PICKING.INVALID_COUNTS")
})

test("rejects stale route fingerprint", () => {
  const snapshot = validSnapshot(); snapshot.routePlans[0].stopFingerprint = "sha256:stale"
  expectViolation(snapshot, "ROUTE.FINGERPRINT_MISMATCH")
})

test("detects an open stop outside the active assignment set", () => {
  const snapshot = validSnapshot()
  snapshot.stops.push({ ...snapshot.stops[1], id: "dropoff-stale", assignmentId: "assignment-completed", orderId: "order-old", sequence: 3 })
  expectViolation(snapshot, "ROUTE.OPEN_STOP_WITHOUT_ACTIVE_ASSIGNMENT")
})

test("detects missing mutation correlation", () => {
  const snapshot = validSnapshot()
  snapshot.audits[0].correlationId = ""
  expectViolation(snapshot, "AUDIT.MISSING_CORRELATION_ID")
})

test("redacts idempotency keys from duplicate evidence", () => {
  const snapshot = validSnapshot()
  snapshot.assignments.push({ ...snapshot.assignments[0], id: "assignment-old", status: "completed" })
  const failure = expectViolation(snapshot, "ASSIGNMENT.DUPLICATE_IDEMPOTENCY_HISTORY")
  assert.equal(typeof failure.evidence.facts.keyHash, "string")
  assert.ok(!JSON.stringify(failure.evidence).includes("tl_tenant_a:assign-1"))
})
