import { createHash } from "node:crypto"
import type { InvariantEvidence, LabRow, LabSnapshot, Severity } from "./types"

export class InvariantViolationError extends Error {
  readonly evidence: InvariantEvidence

  constructor(evidence: InvariantEvidence) {
    super(`${evidence.invariantId}: ${evidence.message}`)
    this.name = "InvariantViolationError"
    this.evidence = evidence
  }
}

type Finding = Omit<InvariantEvidence, "schemaVersion" | "testRunId" | "observedAt" | "reproduction">

function fail(snapshot: LabSnapshot, finding: Finding): never {
  throw new InvariantViolationError({
    schemaVersion: 1,
    testRunId: snapshot.testRunId,
    observedAt: snapshot.observedAt,
    ...finding,
    reproduction: { snapshot },
  })
}

function duplicate(values: string[]): string | undefined {
  const seen = new Set<string>()
  return values.find((value) => (seen.has(value) ? true : (seen.add(value), false)))
}

function active(status: string): boolean {
  return status === "active" || status === "proposed"
}

function assertRunBinding(snapshot: LabSnapshot): void {
  if (!/^tl_[a-z0-9][a-z0-9_-]{7,}$/i.test(snapshot.testRunId)) {
    fail(snapshot, {
      invariantId: "LAB.RUN_ID.INVALID",
      severity: "P0",
      message: "Snapshot has no valid test_run_id",
      entityIds: [],
      facts: { supplied: snapshot.testRunId },
    })
  }
  const collections: LabRow[][] = [
    snapshot.orders,
    snapshot.assignments,
    snapshot.drivers,
    snapshot.batches,
    snapshot.stops,
    snapshot.routePlans,
    snapshot.picks,
    snapshot.pushes,
    snapshot.audits,
  ]
  for (const row of collections.flat()) {
    if (row.testRunId !== snapshot.testRunId) {
      fail(snapshot, {
        invariantId: "LAB.RUN_ID.CROSS_RUN_ROW",
        severity: "P0",
        message: "Snapshot contains a row from another test run",
        entityIds: [row.id],
        facts: { expected: snapshot.testRunId, actual: row.testRunId },
      })
    }
  }
}

function tenantMatch(snapshot: LabSnapshot, rows: LabRow[], expected: string, entityIds: string[]): void {
  const mismatch = rows.find((row) => row.tenantId !== expected)
  if (mismatch) {
    fail(snapshot, {
      invariantId: "SECURITY.CROSS_TENANT_REFERENCE",
      severity: "P0",
      message: "Dependent rows cross a tenant boundary",
      entityIds: [...entityIds, mismatch.id],
      facts: { expectedTenant: expected, actualTenant: mismatch.tenantId },
    })
  }
}

export function assertSnapshotInvariants(snapshot: LabSnapshot): void {
  assertRunBinding(snapshot)

  for (const order of snapshot.orders) {
    const assignments = snapshot.assignments.filter((item) => item.orderId === order.id)
    tenantMatch(snapshot, assignments, order.tenantId, [order.id])
    const activeAssignments = assignments.filter((item) => active(item.status))
    if (activeAssignments.length > 1) {
      fail(snapshot, {
        invariantId: "ORDER.MULTIPLE_ACTIVE_ASSIGNMENTS",
        severity: "P0",
        message: "Order has more than one active assignment",
        entityIds: [order.id, ...activeAssignments.map((item) => item.id)],
        facts: { count: activeAssignments.length },
      })
    }
    if (["delivered", "cancelled"].includes(order.status) && activeAssignments.length) {
      fail(snapshot, {
        invariantId: "ORDER.TERMINAL_WITH_ACTIVE_ASSIGNMENT",
        severity: "P0",
        message: "Terminal order still has an active assignment",
        entityIds: [order.id, activeAssignments[0].id],
        facts: { orderStatus: order.status },
      })
    }
    if (!["delivered", "cancelled"].includes(order.status) && !activeAssignments.length && !order.holdUntil && !order.unresolvedReason) {
      fail(snapshot, {
        invariantId: "ORDER.UNACCOUNTED_NON_TERMINAL",
        severity: "P1",
        message: "Non-terminal order is neither assigned, held nor unresolved",
        entityIds: [order.id],
        facts: { orderStatus: order.status },
      })
    }
  }

  const duplicateIdempotency = duplicate(snapshot.assignments.map((item) => `${item.tenantId}:${item.idempotencyKey}`))
  if (duplicateIdempotency) {
    fail(snapshot, {
      invariantId: "ASSIGNMENT.DUPLICATE_IDEMPOTENCY_HISTORY",
      severity: "P0",
      message: "Assignment history repeats a tenant-scoped idempotency key",
      entityIds: snapshot.assignments.filter((item) => `${item.tenantId}:${item.idempotencyKey}` === duplicateIdempotency).map((item) => item.id),
      facts: { keyHash: createHash("sha256").update(duplicateIdempotency).digest("hex") },
    })
  }

  for (const assignment of snapshot.assignments.filter((item) => active(item.status))) {
    const order = snapshot.orders.find((item) => item.id === assignment.orderId)
    const batch = snapshot.batches.find((item) => item.id === assignment.batchId)
    const driver = snapshot.drivers.find((item) => item.id === assignment.driverId)
    if (!order || !batch || !driver) {
      fail(snapshot, {
        invariantId: "ASSIGNMENT.ORPHAN",
        severity: "P0",
        message: "Active assignment lacks order, batch or driver",
        entityIds: [assignment.id],
        facts: { hasOrder: !!order, hasBatch: !!batch, hasDriver: !!driver },
      })
    }
    tenantMatch(snapshot, [order, batch, driver], assignment.tenantId, [assignment.id])
    if (driver.status === "offline") {
      fail(snapshot, {
        invariantId: "DRIVER.OFFLINE_ACTIVE_ASSIGNMENT",
        severity: "P0",
        message: "Offline driver has an active assignment",
        entityIds: [driver.id, assignment.id],
        facts: {},
      })
    }
  }

  for (const driver of snapshot.drivers) {
    const batches = snapshot.batches.filter((item) => item.driverId === driver.id && item.status === "active")
    if (batches.length > 1) {
      fail(snapshot, {
        invariantId: "DRIVER.MULTIPLE_ACTIVE_BATCHES",
        severity: "P0",
        message: "Driver has more than one active batch",
        entityIds: [driver.id, ...batches.map((item) => item.id)],
        facts: { count: batches.length },
      })
    }
    const load = snapshot.assignments.filter((item) => item.driverId === driver.id && active(item.status)).length
    if (driver.currentCapacity !== load || load < 0 || load > driver.capacity) {
      fail(snapshot, {
        invariantId: "DRIVER.CAPACITY_MISMATCH",
        severity: "P0",
        message: "Driver capacity does not match canonical active load",
        entityIds: [driver.id],
        facts: { currentCapacity: driver.currentCapacity, activeLoad: load, limit: driver.capacity },
      })
    }
  }

  for (const batch of snapshot.batches.filter((item) => item.status === "active")) {
    const assignments = snapshot.assignments.filter((item) => item.batchId === batch.id && active(item.status))
    const stops = snapshot.stops.filter((item) => item.batchId === batch.id && item.status === "open")
    tenantMatch(snapshot, [...assignments, ...stops], batch.tenantId, [batch.id])
    const sequences = stops.map((item) => String(item.sequence))
    const duplicateSequence = duplicate(sequences)
    if (duplicateSequence) {
      fail(snapshot, {
        invariantId: "ROUTE.DUPLICATE_OPEN_SEQUENCE",
        severity: "P0",
        message: "Open route sequences are not unique",
        entityIds: [batch.id, ...stops.filter((item) => String(item.sequence) === duplicateSequence).map((item) => item.id)],
        facts: { sequence: Number(duplicateSequence) },
      })
    }
    for (const assignment of assignments) {
      const assignmentStops = stops.filter((item) => item.assignmentId === assignment.id)
      const pickup = assignmentStops.find((item) => item.kind === "pickup")
      const dropoff = assignmentStops.find((item) => item.kind === "dropoff")
      if (!pickup || !dropoff || pickup.sequence >= dropoff.sequence) {
        fail(snapshot, {
          invariantId: "ROUTE.STOP_SET_OR_PRECEDENCE",
          severity: "P0",
          message: "Active assignment lacks ordered pickup and drop-off stops",
          entityIds: [assignment.id, ...assignmentStops.map((item) => item.id)],
          facts: { pickupSequence: pickup?.sequence, dropoffSequence: dropoff?.sequence },
        })
      }
    }
    const plan = snapshot.routePlans.find((item) => item.batchId === batch.id && item.routeVersion === batch.routeVersion)
    if (batch.departed && (!plan || !["google", "fixture-google"].includes(plan.provider))) {
      fail(snapshot, {
        invariantId: "ROUTE.DEPARTED_WITHOUT_CURRENT_GOOGLE_PLAN",
        severity: "P0",
        message: "Batch departed without a current persisted Google contract plan",
        entityIds: [batch.id],
        facts: { routeVersion: batch.routeVersion, planProvider: plan?.provider },
      })
    }
    if (batch.departed) {
      for (const assignment of assignments) {
        const pick = snapshot.picks.find((item) => item.assignmentId === assignment.id)
        if (!pick || pick.pickedItems < pick.requiredItems || pick.missingItems !== pick.clarifiedMissingItems) {
          fail(snapshot, {
            invariantId: "PICKING.DEPARTED_INCOMPLETE",
            severity: "P0",
            message: "Batch departed before every required item was picked or explicitly clarified",
            entityIds: [batch.id, assignment.id],
            facts: { pick },
          })
        }
      }
    }
  }

  const duplicatePush = duplicate(snapshot.pushes.filter((item) => item.status !== "terminal").map((item) => `${item.tenantId}:${item.logicalEventKey}`))
  if (duplicatePush) {
    fail(snapshot, {
      invariantId: "PUSH.DUPLICATE_ACTIVE_LOGICAL_EVENT",
      severity: "P0",
      message: "Logical push event has more than one active outbox row",
      entityIds: snapshot.pushes.filter((item) => `${item.tenantId}:${item.logicalEventKey}` === duplicatePush).map((item) => item.id),
      facts: { eventKeyHash: createHash("sha256").update(duplicatePush).digest("hex") },
    })
  }
  const sentTerminal = snapshot.pushes.find((item) => item.status === "terminal" && item.providerSendCount > 0)
  if (sentTerminal) {
    fail(snapshot, {
      invariantId: "PUSH.PROVIDER_SEND_AFTER_TERMINAL_CLAIM",
      severity: "P0",
      message: "Terminal push claim reached a provider",
      entityIds: [sentTerminal.id],
      facts: { providerSendCount: sentTerminal.providerSendCount },
    })
  }
}

export function classifySeverity(invariantId: string): Severity {
  if (invariantId.startsWith("LAB.") || invariantId.startsWith("SECURITY.")) return "P0"
  if (invariantId.startsWith("ORDER.UNACCOUNTED")) return "P1"
  return "P0"
}
