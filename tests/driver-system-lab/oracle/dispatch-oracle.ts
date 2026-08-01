import { nonEmptySubsets, permutations } from './enumeration';
import type {
  OracleCandidate, OracleDriver, OracleInput, OracleOrder, OracleRejection,
  OracleRoute, OracleSolution,
} from './types';

const edge = (from: string, to: string) => `${from}->${to}`;
const compareText = (left: string, right: string) => left.localeCompare(right, 'en');

function assertInput(input: OracleInput): void {
  if (!Number.isFinite(input.nowMinute) || input.maxBundleOrders < 1) throw new Error('ORACLE_INVALID_CONFIG');
  const orderIds = input.orders.map(({ id }) => id);
  const driverIds = input.drivers.map(({ id }) => id);
  if (new Set(orderIds).size !== orderIds.length) throw new Error('ORACLE_DUPLICATE_ORDER_ID');
  if (new Set(driverIds).size !== driverIds.length) throw new Error('ORACLE_DUPLICATE_DRIVER_ID');
}

function travel(input: OracleInput, from: string, to: string): number | null {
  if (from === to) return 0;
  const value = input.travelMinutes[edge(from, to)];
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function staticDriverReason(input: OracleInput, driver: OracleDriver): string | null {
  if (driver.tenantId !== input.tenantId) return 'CROSS_TENANT_DRIVER';
  if (!driver.online) return 'DRIVER_OFFLINE';
  if (!driver.sessionActive) return 'SESSION_INACTIVE';
  if (!driver.gpsFresh) return 'GPS_STALE';
  if (!driver.routeFeasible) return 'DRIVER_ROUTE_INFEASIBLE';
  return null;
}

function routeForPermutation(
  input: OracleInput,
  driver: OracleDriver,
  orders: readonly OracleOrder[],
  sequence: readonly OracleOrder[],
): OracleRoute | null {
  const pickupNode = orders[0].pickupNode;
  const toPickup = travel(input, driver.positionNode, pickupNode);
  if (toPickup === null) return null;
  let minute = input.nowMinute + toPickup;
  const readyMinute = Math.max(...orders.map((order) => order.readyMinute));
  const waitMinutes = Math.max(0, readyMinute - minute);
  if (waitMinutes > input.maxDriverWaitMinutes) return null;
  minute += waitMinutes + input.pickupServiceMinutes;
  const pickupCompleteMinute = minute;
  let travelTotal = toPickup;
  let currentNode = pickupNode;
  const slackByOrder: Record<string, number> = {};
  for (const order of sequence) {
    const leg = travel(input, currentNode, order.dropoffNode);
    if (leg === null) return null;
    minute += leg + order.serviceMinutes;
    travelTotal += leg;
    const slack = order.deadlineMinute - minute;
    if (slack < 0) return null;
    if (order.maxMinutesAfterPickup !== undefined && minute - pickupCompleteMinute > order.maxMinutesAfterPickup) return null;
    if (minute > driver.shiftEndsMinute) return null;
    slackByOrder[order.id] = slack;
    currentNode = order.dropoffNode;
  }
  return {
    nodes: [pickupNode, ...sequence.map(({ dropoffNode }) => dropoffNode)],
    orderIds: sequence.map(({ id }) => id), pickupCompleteMinute,
    completionMinute: minute, travelMinutes: travelTotal, waitMinutes,
    slackByOrder, minSlackMinutes: Math.min(...Object.values(slackByOrder)),
  };
}

function bestRoute(input: OracleInput, driver: OracleDriver, orders: readonly OracleOrder[]): OracleRoute | null {
  let best: OracleRoute | null = null;
  for (const sequence of permutations(orders)) {
    const route = routeForPermutation(input, driver, orders, sequence);
    if (!route) continue;
    const routeSignature = route.orderIds.join(',');
    const bestSignature = best?.orderIds.join(',') ?? '';
    if (!best || route.minSlackMinutes > best.minSlackMinutes ||
      (route.minSlackMinutes === best.minSlackMinutes && route.travelMinutes < best.travelMinutes) ||
      (route.minSlackMinutes === best.minSlackMinutes && route.travelMinutes === best.travelMinutes && compareText(routeSignature, bestSignature) < 0)) {
      best = route;
    }
  }
  return best;
}

function enumerateCandidates(input: OracleInput): { candidates: OracleCandidate[]; rejections: OracleRejection[] } {
  const candidates: OracleCandidate[] = [];
  const rejections: OracleRejection[] = [];
  const orders = input.orders.filter((order) => order.state === 'candidate' && order.tenantId === input.tenantId)
    .sort((a, b) => compareText(a.id, b.id));
  for (const driver of [...input.drivers].sort((a, b) => compareText(a.id, b.id))) {
    const driverReason = staticDriverReason(input, driver);
    const available = Math.max(0, driver.capacityUnits - driver.currentLoadUnits);
    for (const storeId of [...new Set(orders.map(({ storeId }) => storeId))].sort(compareText)) {
      const storeOrders = orders.filter((order) => order.storeId === storeId);
      for (const subset of nonEmptySubsets(storeOrders, Math.min(input.maxBundleOrders, storeOrders.length))) {
        const ids = subset.map(({ id }) => id);
        let reason = driverReason;
        if (!reason && new Set(subset.map(({ pickupNode }) => pickupNode)).size !== 1) reason = 'MULTI_PICKUP_FORBIDDEN';
        if (!reason && subset.reduce((sum, order) => sum + order.loadUnits, 0) > available) reason = 'CAPACITY';
        const route = reason ? null : bestRoute(input, driver, subset);
        if (!reason && !route) reason = 'NO_FEASIBLE_ROUTE';
        if (reason || !route) {
          rejections.push({ driverId: driver.id, orderIds: ids, reason: reason ?? 'NO_FEASIBLE_ROUTE' });
          continue;
        }
        const signature = `${driver.id}|${[...ids].sort(compareText).join(',')}|${route.orderIds.join(',')}`;
        candidates.push({
          driverId: driver.id, orderIds: [...ids].sort(compareText), route,
          oldestAgeMinutes: Math.max(...subset.map((order) => input.nowMinute - order.createdMinute)),
          waitingAgeMinutes: subset.reduce((sum, order) => sum + input.nowMinute - order.createdMinute, 0),
          maxDeadlinePressure: -route.minSlackMinutes,
          fairnessLoad: driver.assignmentsLastHour,
          signature,
        });
      }
    }
  }
  return { candidates: candidates.sort((a, b) => compareText(a.signature, b.signature)), rejections };
}

type Selection = { options: OracleCandidate[]; orderIds: Set<string> };

function objective(selection: Selection) {
  const options = selection.options;
  return {
    assignedOrders: selection.orderIds.size,
    endangeredAgeMinutes: options.reduce((sum, option) => sum + option.waitingAgeMinutes, 0),
    worstSlackMinutes: options.length ? Math.min(...options.map(({ route }) => route.minSlackMinutes)) : Number.POSITIVE_INFINITY,
    totalTravelMinutes: options.reduce((sum, { route }) => sum + route.travelMinutes, 0),
    totalWaitMinutes: options.reduce((sum, { route }) => sum + route.waitMinutes, 0),
    fairnessLoad: options.reduce((sum, option) => sum + option.fairnessLoad, 0),
    signature: options.map(({ signature }) => signature).sort(compareText).join(';'),
  };
}

function isBetter(left: Selection, right: Selection | null): boolean {
  if (!right) return true;
  const a = objective(left); const b = objective(right);
  if (a.assignedOrders !== b.assignedOrders) return a.assignedOrders > b.assignedOrders;
  if (a.endangeredAgeMinutes !== b.endangeredAgeMinutes) return a.endangeredAgeMinutes > b.endangeredAgeMinutes;
  if (a.worstSlackMinutes !== b.worstSlackMinutes) return a.worstSlackMinutes > b.worstSlackMinutes;
  if (a.totalTravelMinutes !== b.totalTravelMinutes) return a.totalTravelMinutes < b.totalTravelMinutes;
  if (a.totalWaitMinutes !== b.totalWaitMinutes) return a.totalWaitMinutes < b.totalWaitMinutes;
  if (a.fairnessLoad !== b.fairnessLoad) return a.fairnessLoad < b.fairnessLoad;
  return compareText(a.signature, b.signature) < 0;
}

export function solveDispatchOracle(input: OracleInput): OracleSolution {
  assertInput(input);
  const { candidates, rejections } = enumerateCandidates(input);
  let best: Selection | null = null;
  const search = (index: number, options: OracleCandidate[], drivers: Set<string>, orderIds: Set<string>) => {
    if (index === candidates.length) {
      const selection = { options: [...options], orderIds: new Set(orderIds) };
      if (isBetter(selection, best)) best = selection;
      return;
    }
    search(index + 1, options, drivers, orderIds);
    const candidate = candidates[index];
    if (drivers.has(candidate.driverId) || candidate.orderIds.some((id) => orderIds.has(id))) return;
    const nextDrivers = new Set(drivers).add(candidate.driverId);
    const nextOrders = new Set(orderIds); candidate.orderIds.forEach((id) => nextOrders.add(id));
    search(index + 1, [...options, candidate], nextDrivers, nextOrders);
  };
  search(0, [], new Set(), new Set());
  // TypeScript does not model assignments made from the recursive closure.
  const chosen: Selection = (best as Selection | null) ?? { options: [], orderIds: new Set<string>() };
  const candidateOrderIds = input.orders.filter((order) => order.tenantId === input.tenantId && order.state === 'candidate')
    .map(({ id }) => id).sort(compareText);
  return {
    assignments: [...chosen.options].sort((a, b) => compareText(a.driverId, b.driverId)),
    unassignedOrderIds: candidateOrderIds.filter((id) => !chosen.orderIds.has(id)),
    candidateCount: candidates.length,
    rejections,
    objective: objective(chosen),
  };
}
