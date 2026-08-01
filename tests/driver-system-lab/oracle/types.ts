export type OrderState = 'candidate' | 'held' | 'assigned' | 'terminal';

export interface OracleOrder {
  id: string;
  tenantId: string;
  storeId: string;
  pickupNode: string;
  dropoffNode: string;
  state: OrderState;
  createdMinute: number;
  readyMinute: number;
  deadlineMinute: number;
  serviceMinutes: number;
  loadUnits: number;
  maxMinutesAfterPickup?: number;
}

export interface OracleDriver {
  id: string;
  tenantId: string;
  positionNode: string;
  online: boolean;
  sessionActive: boolean;
  gpsFresh: boolean;
  routeFeasible: boolean;
  capacityUnits: number;
  currentLoadUnits: number;
  assignmentsLastHour: number;
  shiftEndsMinute: number;
}

export interface OracleInput {
  nowMinute: number;
  tenantId: string;
  orders: readonly OracleOrder[];
  drivers: readonly OracleDriver[];
  travelMinutes: Readonly<Record<string, number>>;
  pickupServiceMinutes: number;
  maxBundleOrders: number;
  maxDriverWaitMinutes: number;
}

export interface OracleRoute {
  nodes: string[];
  orderIds: string[];
  pickupCompleteMinute: number;
  completionMinute: number;
  travelMinutes: number;
  waitMinutes: number;
  slackByOrder: Record<string, number>;
  minSlackMinutes: number;
}

export interface OracleCandidate {
  driverId: string;
  orderIds: string[];
  route: OracleRoute;
  oldestAgeMinutes: number;
  waitingAgeMinutes: number;
  maxDeadlinePressure: number;
  fairnessLoad: number;
  signature: string;
}

export interface OracleRejection {
  driverId: string;
  orderIds: string[];
  reason: string;
}

export interface OracleSolution {
  assignments: OracleCandidate[];
  unassignedOrderIds: string[];
  candidateCount: number;
  rejections: OracleRejection[];
  objective: {
    assignedOrders: number;
    endangeredAgeMinutes: number;
    worstSlackMinutes: number;
    totalTravelMinutes: number;
    totalWaitMinutes: number;
    fairnessLoad: number;
    signature: string;
  };
}
