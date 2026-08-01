export type Severity = "P0" | "P1" | "P2" | "P3"

export interface LabRow {
  id: string
  testRunId: string
  tenantId: string
}

export interface OrderRow extends LabRow {
  status: "pending" | "held" | "assigned" | "delivered" | "cancelled"
  holdUntil?: string
  unresolvedReason?: string
}

export interface AssignmentRow extends LabRow {
  orderId: string
  driverId: string
  batchId: string
  status: "proposed" | "active" | "completed" | "cancelled" | "expired"
  idempotencyKey: string
}

export interface DriverRow extends LabRow {
  status: "offline" | "idle" | "delivering" | "returning"
  capacity: number
  currentCapacity: number
}

export interface BatchRow extends LabRow {
  driverId: string
  status: "pending" | "active" | "completed" | "cancelled"
  routeVersion: number
  departed: boolean
}

export interface StopRow extends LabRow {
  batchId: string
  assignmentId: string
  orderId: string
  kind: "pickup" | "dropoff"
  sequence: number
  status: "open" | "completed" | "cancelled"
}

export interface RoutePlanRow extends LabRow {
  batchId: string
  routeVersion: number
  provider: "google" | "fixture-google"
  stopFingerprint: string
}

export interface PickRow extends LabRow {
  assignmentId: string
  requiredItems: number
  pickedItems: number
  missingItems: number
  clarifiedMissingItems: number
}

export interface PushRow extends LabRow {
  notificationId: string
  assignmentId: string
  assignmentVersion: number
  logicalEventKey: string
  status: "pending" | "claimed" | "sent" | "terminal"
  providerSendCount: number
}

export interface AuditRow extends LabRow {
  entityId: string
  mutation: string
  correlationId: string
}

export interface LabSnapshot {
  testRunId: string
  observedAt: string
  orders: OrderRow[]
  assignments: AssignmentRow[]
  drivers: DriverRow[]
  batches: BatchRow[]
  stops: StopRow[]
  routePlans: RoutePlanRow[]
  picks: PickRow[]
  pushes: PushRow[]
  audits: AuditRow[]
}

export interface InvariantEvidence {
  schemaVersion: 1
  testRunId: string
  observedAt: string
  invariantId: string
  severity: Severity
  message: string
  entityIds: string[]
  facts: Record<string, unknown>
  reproduction: {
    snapshot: LabSnapshot
  }
}
