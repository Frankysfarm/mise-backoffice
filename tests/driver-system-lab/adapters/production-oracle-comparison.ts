import { solveDispatchOracle } from '../oracle/dispatch-oracle';
import type { OracleCandidate, OracleInput, OracleSolution } from '../oracle/types';

export type ProductionAssignment = {
  driverId: string;
  orderIds: readonly string[];
};

export type ProductionDispatchDecision = {
  algorithmVersion: string;
  assignments: readonly ProductionAssignment[];
  unassignedOrderIds?: readonly string[];
};

export type ComparisonTolerance = {
  maxAssignedOrderGap: number;
  maxEndangeredAgeGapMinutes: number;
  maxWorstSlackLossMinutes: number;
  maxTravelExcessMinutes: number;
  maxWaitExcessMinutes: number;
  maxFairnessExcess: number;
};

export type ComparisonViolation = {
  code: 'UNKNOWN_DRIVER' | 'UNKNOWN_OR_INELIGIBLE_ORDER' | 'DUPLICATE_DRIVER' |
    'DUPLICATE_ORDER' | 'EMPTY_ASSIGNMENT' | 'INFEASIBLE_ASSIGNMENT' | 'UNASSIGNED_SET_MISMATCH';
  driverId?: string;
  orderIds?: string[];
};

export type ProductionOracleComparison = {
  verdict: 'HARD_CONSTRAINT_VIOLATION' | 'EXACT_MATCH' | 'WITHIN_TOLERANCE' | 'QUALITY_GAP';
  productionAlgorithmVersion: string;
  normalizedProductionAssignments: string[];
  normalizedOracleAssignments: string[];
  hardConstraintViolations: ComparisonViolation[];
  objectiveDelta: {
    assignedOrderGap: number;
    endangeredAgeGapMinutes: number;
    worstSlackLossMinutes: number | null;
    travelExcessMinutes: number;
    waitExcessMinutes: number;
    fairnessExcess: number;
  } | null;
  tolerance: ComparisonTolerance;
  oracle: OracleSolution;
};

const DEFAULT_TOLERANCE: ComparisonTolerance = {
  maxAssignedOrderGap: 0,
  maxEndangeredAgeGapMinutes: 0,
  maxWorstSlackLossMinutes: 0,
  maxTravelExcessMinutes: 0,
  maxWaitExcessMinutes: 0,
  maxFairnessExcess: 0,
};

const compareText = (left: string, right: string) => left.localeCompare(right, 'en');

function signature(driverId: string, orderIds: readonly string[]): string {
  return `${driverId}|${[...orderIds].sort(compareText).join(',')}`;
}

function normalize(assignments: readonly ProductionAssignment[]): string[] {
  return assignments.map(({ driverId, orderIds }) => signature(driverId, orderIds)).sort(compareText);
}

function normalizeOracle(solution: OracleSolution): string[] {
  return solution.assignments.map(({ driverId, orderIds }) => signature(driverId, orderIds)).sort(compareText);
}

function validateTolerance(tolerance: ComparisonTolerance): void {
  for (const value of Object.values(tolerance)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_COMPARISON_TOLERANCE');
  }
}

/**
 * Evaluate a production decision against the independently implemented small-N
 * oracle. This adapter accepts captured values only: it imports no production
 * scorer and performs no database, network, provider, or assignment mutation.
 */
export function compareProductionDecisionToOracle(
  input: OracleInput,
  production: ProductionDispatchDecision,
  overrides: Partial<ComparisonTolerance> = {},
): ProductionOracleComparison {
  const tolerance = { ...DEFAULT_TOLERANCE, ...overrides };
  validateTolerance(tolerance);
  const oracle = solveDispatchOracle(input);
  const violations: ComparisonViolation[] = [];
  const driverIds = new Set(input.drivers.map(({ id }) => id));
  const eligibleOrderIds = new Set(input.orders
    .filter(({ state, tenantId }) => state === 'candidate' && tenantId === input.tenantId)
    .map(({ id }) => id));
  const seenDrivers = new Set<string>();
  const seenOrders = new Set<string>();
  const evaluated: OracleCandidate[] = [];

  for (const assignment of production.assignments) {
    const orderIds = [...assignment.orderIds].sort(compareText);
    if (orderIds.length === 0) violations.push({ code: 'EMPTY_ASSIGNMENT', driverId: assignment.driverId, orderIds });
    if (!driverIds.has(assignment.driverId)) {
      violations.push({ code: 'UNKNOWN_DRIVER', driverId: assignment.driverId, orderIds });
      continue;
    }
    if (seenDrivers.has(assignment.driverId)) {
      violations.push({ code: 'DUPLICATE_DRIVER', driverId: assignment.driverId, orderIds });
    }
    seenDrivers.add(assignment.driverId);
    const unknown = orderIds.filter((id) => !eligibleOrderIds.has(id));
    if (unknown.length) violations.push({ code: 'UNKNOWN_OR_INELIGIBLE_ORDER', driverId: assignment.driverId, orderIds: unknown });
    const localIds = new Set<string>();
    const duplicate = orderIds.filter((id) => seenOrders.has(id) || (localIds.has(id) ? true : (localIds.add(id), false)));
    if (duplicate.length) violations.push({ code: 'DUPLICATE_ORDER', driverId: assignment.driverId, orderIds: duplicate });
    orderIds.forEach((id) => seenOrders.add(id));
    if (unknown.length || duplicate.length || orderIds.length === 0) continue;

    const restricted = solveDispatchOracle({
      ...input,
      orders: input.orders.filter(({ id }) => orderIds.includes(id)),
      drivers: input.drivers.filter(({ id }) => id === assignment.driverId),
    });
    const selected = restricted.assignments[0];
    if (restricted.objective.assignedOrders !== orderIds.length ||
      !selected || signature(selected.driverId, selected.orderIds) !== signature(assignment.driverId, orderIds)) {
      violations.push({ code: 'INFEASIBLE_ASSIGNMENT', driverId: assignment.driverId, orderIds });
    } else {
      evaluated.push(selected);
    }
  }

  const expectedUnassigned = [...eligibleOrderIds].filter((id) => !seenOrders.has(id)).sort(compareText);
  if (production.unassignedOrderIds &&
    JSON.stringify([...production.unassignedOrderIds].sort(compareText)) !== JSON.stringify(expectedUnassigned)) {
    violations.push({ code: 'UNASSIGNED_SET_MISMATCH', orderIds: [...production.unassignedOrderIds].sort(compareText) });
  }

  const normalizedProductionAssignments = normalize(production.assignments);
  const normalizedOracleAssignments = normalizeOracle(oracle);
  if (violations.length) return {
    verdict: 'HARD_CONSTRAINT_VIOLATION', productionAlgorithmVersion: production.algorithmVersion,
    normalizedProductionAssignments, normalizedOracleAssignments,
    hardConstraintViolations: violations, objectiveDelta: null, tolerance, oracle,
  };

  const assignedCount = seenOrders.size;
  const worstSlack = evaluated.length ? Math.min(...evaluated.map(({ route }) => route.minSlackMinutes)) : Number.POSITIVE_INFINITY;
  const oracleSlack = oracle.objective.worstSlackMinutes;
  const objectiveDelta = {
    assignedOrderGap: oracle.objective.assignedOrders - assignedCount,
    endangeredAgeGapMinutes: oracle.objective.endangeredAgeMinutes - evaluated.reduce((sum, item) => sum + item.waitingAgeMinutes, 0),
    worstSlackLossMinutes: Number.isFinite(worstSlack) && Number.isFinite(oracleSlack) ? oracleSlack - worstSlack : null,
    travelExcessMinutes: evaluated.reduce((sum, item) => sum + item.route.travelMinutes, 0) - oracle.objective.totalTravelMinutes,
    waitExcessMinutes: evaluated.reduce((sum, item) => sum + item.route.waitMinutes, 0) - oracle.objective.totalWaitMinutes,
    fairnessExcess: evaluated.reduce((sum, item) => sum + item.fairnessLoad, 0) - oracle.objective.fairnessLoad,
  };
  const exact = JSON.stringify(normalizedProductionAssignments) === JSON.stringify(normalizedOracleAssignments);
  const withinTolerance = objectiveDelta.assignedOrderGap <= tolerance.maxAssignedOrderGap &&
    objectiveDelta.endangeredAgeGapMinutes <= tolerance.maxEndangeredAgeGapMinutes &&
    (objectiveDelta.worstSlackLossMinutes === null || objectiveDelta.worstSlackLossMinutes <= tolerance.maxWorstSlackLossMinutes) &&
    objectiveDelta.travelExcessMinutes <= tolerance.maxTravelExcessMinutes &&
    objectiveDelta.waitExcessMinutes <= tolerance.maxWaitExcessMinutes &&
    objectiveDelta.fairnessExcess <= tolerance.maxFairnessExcess;
  return {
    verdict: exact ? 'EXACT_MATCH' : withinTolerance ? 'WITHIN_TOLERANCE' : 'QUALITY_GAP',
    productionAlgorithmVersion: production.algorithmVersion,
    normalizedProductionAssignments, normalizedOracleAssignments,
    hardConstraintViolations: [], objectiveDelta, tolerance, oracle,
  };
}
