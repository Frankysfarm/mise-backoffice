import {
  optimizeAdaptiveDispatch,
  type AdaptivePlan,
  type BundleEstimate,
  type Point,
} from './adaptive-dispatch-optimizer';

export type RuntimeStop = {
  kind: 'pickup' | 'dropoff';
  orderId: string;
  storeId: string;
  sequence: number;
};

export type RuntimeDispatchSnapshot = {
  captureId: string;
  evaluatedAt: string;
  orders: readonly {
    id: string; storeId: string; pickup: Point; dropoff: Point;
    readyAt: string; deadlineAt: string; serviceMinutes: number;
    routeFeasible: boolean; endangered: boolean;
  }[];
  drivers: readonly {
    id: string; vehicle: 'bike' | 'car'; online: boolean; sessionActive: boolean;
    gps: Point | null; gpsAgeSeconds: number; gpsAccuracyM: number;
    load: number; capacity: number; radiusKm: number; routeFeasible: boolean;
    batteryPct: number | null; network: 'good' | 'poor' | 'offline';
    assignmentsLastHour: number; existingStops: readonly RuntimeStop[];
  }[];
  routeEstimates: readonly (BundleEstimate & {
    storeId: string;
    trafficMatrixVersion: string;
    stopSequence: readonly RuntimeStop[];
  })[];
};

export type PersistedDispatchObservation = {
  assignments: readonly {
    driverId: string;
    orderIds: readonly string[];
    stops: readonly RuntimeStop[];
  }[];
};

export type RuntimeShadowCapture = {
  mode: 'shadow';
  captureId: string;
  runtimeInput: RuntimeDispatchSnapshot;
  optimizerInput: Parameters<typeof optimizeAdaptiveDispatch>[0];
  plan: AdaptivePlan;
  persisted: PersistedDispatchObservation;
  comparison: {
    assignmentMatch: boolean;
    stopSequenceMatch: boolean;
    violations: string[];
  };
};

const text = (left: string, right: string) => left.localeCompare(right, 'en');
const assignmentKey = (driverId: string, orderIds: readonly string[]) =>
  `${driverId}|${[...orderIds].sort(text).join(',')}`;
const stopKey = (stop: RuntimeStop) =>
  `${stop.sequence}:${stop.kind}:${stop.storeId}:${stop.orderId}`;

function validateSnapshot(snapshot: RuntimeDispatchSnapshot): void {
  if (!snapshot.captureId.startsWith('tl_')) throw new Error('RUNTIME_CAPTURE_TEST_ID_REQUIRED');
  if (!Number.isFinite(Date.parse(snapshot.evaluatedAt))) throw new Error('RUNTIME_CAPTURE_TIME_INVALID');
  const orderIds = new Set(snapshot.orders.map(({ id }) => id));
  const driverIds = new Set(snapshot.drivers.map(({ id }) => id));
  if (orderIds.size !== snapshot.orders.length || driverIds.size !== snapshot.drivers.length) throw new Error('RUNTIME_CAPTURE_DUPLICATE_ID');
  for (const estimate of snapshot.routeEstimates) {
    if (!driverIds.has(estimate.driverId) || estimate.orderIds.some((id) => !orderIds.has(id))) throw new Error('RUNTIME_CAPTURE_ESTIMATE_REFERENCE');
    const stores = new Set(snapshot.orders.filter(({ id }) => estimate.orderIds.includes(id)).map(({ storeId }) => storeId));
    if (stores.size !== 1 || !stores.has(estimate.storeId)) throw new Error('RUNTIME_CAPTURE_MULTI_STORE_BUNDLE');
    const sequences = estimate.stopSequence.map(({ sequence }) => sequence);
    if (new Set(sequences).size !== sequences.length || sequences.some((value, index) => value !== index + 1)) throw new Error('RUNTIME_CAPTURE_STOP_SEQUENCE_INVALID');
    const driver = snapshot.drivers.find(({ id }) => id === estimate.driverId)!;
    const incumbent = driver.existingStops.map(({ kind, orderId, storeId }) => `${kind}:${storeId}:${orderId}`);
    const prefix = estimate.stopSequence.slice(0, incumbent.length).map(({ kind, orderId, storeId }) => `${kind}:${storeId}:${orderId}`);
    if (JSON.stringify(prefix) !== JSON.stringify(incumbent)) throw new Error('RUNTIME_CAPTURE_EXISTING_ROUTE_CHANGED');
    const latestReadyMinutes = Math.max(...snapshot.orders.filter(({ id }) => estimate.orderIds.includes(id))
      .map(({ readyAt }) => (Date.parse(readyAt) - Date.parse(snapshot.evaluatedAt)) / 60_000));
    if (!Number.isFinite(latestReadyMinutes) || estimate.etaMinutes < latestReadyMinutes) throw new Error('RUNTIME_CAPTURE_READY_TIME_IGNORED');
  }
}

/**
 * Read-only runtime shadow seam. It consumes an already captured runtime
 * snapshot and an independently read persisted observation. It has no writer,
 * database, network, provider or feature-activation callback.
 */
export function captureAdaptiveDispatchRuntimeShadow(
  enabled: boolean,
  snapshot: RuntimeDispatchSnapshot,
  persisted: PersistedDispatchObservation,
  maxBundleOrders: number,
): RuntimeShadowCapture {
  if (!enabled) throw new Error('RUNTIME_CAPTURE_DISABLED');
  validateSnapshot(snapshot);
  const optimizerInput: Parameters<typeof optimizeAdaptiveDispatch>[0] = {
    evaluatedAt: snapshot.evaluatedAt,
    orders: snapshot.orders.map(({ id, pickup, dropoff, deadlineAt, serviceMinutes, routeFeasible }) => ({
      id, pickup, dropoff, deadlineAt, serviceMinutes, routeFeasible,
    })),
    drivers: snapshot.drivers.map((driver) => ({
      id: driver.id, online: driver.online, sessionActive: driver.sessionActive,
      gps: driver.gps, gpsAgeSeconds: driver.gpsAgeSeconds, gpsAccuracyM: driver.gpsAccuracyM,
      capacity: Math.min(driver.capacity, driver.vehicle === 'bike' ? 2 : 4), load: driver.load,
      radiusKm: driver.radiusKm, routeFeasible: driver.routeFeasible,
      batteryPct: driver.batteryPct, network: driver.network,
      assignmentsLastHour: driver.assignmentsLastHour,
    })),
    estimates: snapshot.routeEstimates.map(({ stopSequence: _stops, storeId: _store, trafficMatrixVersion: _matrix, ...estimate }) => ({ ...estimate })),
    config: { maxEnumeratedBundleSize: maxBundleOrders },
  };
  const plan = optimizeAdaptiveDispatch(optimizerInput);
  const planned = plan.assignments.map(({ driverId, orderIds }) => assignmentKey(driverId, orderIds)).sort(text);
  const observed = persisted.assignments.map(({ driverId, orderIds }) => assignmentKey(driverId, orderIds)).sort(text);
  const violations: string[] = [];
  if (JSON.stringify(planned) !== JSON.stringify(observed)) violations.push('PERSISTED_ASSIGNMENT_MISMATCH');
  for (const assignment of persisted.assignments) {
    const estimate = snapshot.routeEstimates.find((candidate) =>
      assignmentKey(candidate.driverId, candidate.orderIds) === assignmentKey(assignment.driverId, assignment.orderIds));
    if (!estimate) { violations.push(`PERSISTED_ROUTE_UNMAPPED:${assignment.driverId}`); continue; }
    if (JSON.stringify(estimate.stopSequence.map(stopKey)) !== JSON.stringify(assignment.stops.map(stopKey))) {
      violations.push(`PERSISTED_STOP_SEQUENCE_MISMATCH:${assignment.driverId}`);
    }
  }
  return {
    mode: 'shadow', captureId: snapshot.captureId, runtimeInput: snapshot,
    optimizerInput, plan, persisted,
    comparison: {
      assignmentMatch: !violations.includes('PERSISTED_ASSIGNMENT_MISMATCH'),
      stopSequenceMatch: !violations.some((value) => value.startsWith('PERSISTED_STOP_SEQUENCE_') || value.startsWith('PERSISTED_ROUTE_')),
      violations,
    },
  };
}
