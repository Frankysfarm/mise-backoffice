import { haversineApproxKm } from './intelligent-dispatch';

export type RoutePoint = { id: string; lat: number; lng: number };
export type RouteLeg = { distanceKm: number; durationMinutes: number; source: 'road_matrix' | 'conservative_fallback' };
export type RouteMatrix = Readonly<Record<string, RouteLeg>>;
export type RouteStop = {
  id: string; orderId: string; kind: 'pickup' | 'dropoff'; point: RoutePoint;
  serviceMinutes: number; readyAt?: string | null; deadlineAt?: string | null;
};

export function routeKey(from: RoutePoint, to: RoutePoint) {
  return `${from.id}->${to.id}`;
}

export function resolveRouteLeg(
  from: RoutePoint,
  to: RoutePoint,
  matrix: RouteMatrix,
  fallback: { speedKmh: number; distanceMultiplier: number } = {
    speedKmh: 25, distanceMultiplier: 1.35,
  },
): RouteLeg {
  const road = matrix[routeKey(from, to)];
  if (road && road.distanceKm >= 0 && road.durationMinutes >= 0) return road;
  const distanceKm = haversineApproxKm(from, to) * Math.max(1, fallback.distanceMultiplier);
  return {
    distanceKm,
    durationMinutes: distanceKm / Math.max(1, fallback.speedKmh) * 60,
    source: 'conservative_fallback',
  };
}

export type RouteFeasibilityConfig = {
  capacity: number;
  maxAddedDetourMinutes: number;
  maxExistingCustomerDelayMinutes: number;
  deadlineSafetyMinutes: number;
  allowMultiStore: boolean;
};

export type RouteInsertionInput = {
  now: string; start: RoutePoint; existingStops: readonly RouteStop[];
  candidatePickup: RouteStop; candidateDropoff: RouteStop;
  existingStoreId: string; candidateStoreId: string;
  matrix: RouteMatrix; config: RouteFeasibilityConfig;
};

export type RoutePlanDecision = {
  compatible: boolean;
  reasonCode: string;
  stops: RouteStop[];
  totalMinutes: number | null;
  addedMinutes: number | null;
  matrixFallbackUsed: boolean;
  arrivals: Record<string, string>;
};

function simulate(
  nowMs: number, start: RoutePoint, stops: readonly RouteStop[], matrix: RouteMatrix,
) {
  let cursor = start;
  let elapsed = 0;
  let fallback = false;
  const arrivals: Record<string, string> = {};
  for (const stop of stops) {
    const leg = resolveRouteLeg(cursor, stop.point, matrix);
    fallback ||= leg.source === 'conservative_fallback';
    elapsed += leg.durationMinutes;
    const readyMs = stop.readyAt ? Date.parse(stop.readyAt) : Number.NaN;
    if (Number.isFinite(readyMs)) elapsed = Math.max(elapsed, (readyMs - nowMs) / 60_000);
    arrivals[stop.id] = new Date(nowMs + elapsed * 60_000).toISOString();
    elapsed += Math.max(0, stop.serviceMinutes);
    cursor = stop.point;
  }
  return { totalMinutes: elapsed, arrivals, fallback };
}

export function evaluateBestInsertion(input: RouteInsertionInput): RoutePlanDecision {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('INVALID_ROUTE_EVALUATION_TIME');
  if (!input.config.allowMultiStore && input.existingStoreId !== input.candidateStoreId) {
    return { compatible: false, reasonCode: 'MULTI_STORE_NOT_ALLOWED', stops: [],
      totalMinutes: null, addedMinutes: null, matrixFallbackUsed: false, arrivals: {} };
  }
  const existingOrders = new Set(input.existingStops.map((stop) => stop.orderId));
  if (existingOrders.size + 1 > input.config.capacity) {
    return { compatible: false, reasonCode: 'CAPACITY_EXCEEDED', stops: [],
      totalMinutes: null, addedMinutes: null, matrixFallbackUsed: false, arrivals: {} };
  }
  const baseline = simulate(nowMs, input.start, input.existingStops, input.matrix);
  const options: RoutePlanDecision[] = [];
  for (let pickupIndex = 0; pickupIndex <= input.existingStops.length; pickupIndex++) {
    for (let dropIndex = pickupIndex + 1; dropIndex <= input.existingStops.length + 1; dropIndex++) {
      const stops = [...input.existingStops];
      stops.splice(pickupIndex, 0, input.candidatePickup);
      stops.splice(dropIndex, 0, input.candidateDropoff);
      const plan = simulate(nowMs, input.start, stops, input.matrix);
      const addedMinutes = plan.totalMinutes - baseline.totalMinutes;
      let reason = addedMinutes > input.config.maxAddedDetourMinutes
        ? 'DETOUR_LIMIT_EXCEEDED' : null;
      for (const stop of stops) {
        if (stop.kind !== 'dropoff' || !stop.deadlineAt) continue;
        const slack = (Date.parse(stop.deadlineAt) - Date.parse(plan.arrivals[stop.id])) / 60_000;
        if (!Number.isFinite(slack) || slack < input.config.deadlineSafetyMinutes) {
          reason = 'DEADLINE_INFEASIBLE';
        }
      }
      for (const stop of input.existingStops) {
        if (stop.kind !== 'dropoff') continue;
        const delay = (
          Date.parse(plan.arrivals[stop.id]) - Date.parse(baseline.arrivals[stop.id])
        ) / 60_000;
        if (delay > input.config.maxExistingCustomerDelayMinutes) {
          reason = 'EXISTING_CUSTOMER_DETOUR_EXCEEDED';
        }
      }
      if (!reason) options.push({
        compatible: true, reasonCode: 'INSERTION_FEASIBLE', stops,
        totalMinutes: plan.totalMinutes, addedMinutes,
        matrixFallbackUsed: plan.fallback, arrivals: plan.arrivals,
      });
    }
  }
  return options.sort((a, b) =>
    a.totalMinutes! - b.totalMinutes! ||
    a.stops.map((stop) => stop.id).join('|').localeCompare(b.stops.map((stop) => stop.id).join('|'))
  )[0] ?? {
    compatible: false, reasonCode: 'NO_FEASIBLE_INSERTION', stops: [],
    totalMinutes: null, addedMinutes: null, matrixFallbackUsed: false, arrivals: {},
  };
}

export type KitchenHoldInput = {
  orderId: string; now: string; createdAt: string; deliveryDeadlineAt: string;
  prepMinutes: number; kitchenQueueMinutes: number; driverEtaToPickupMinutes: number;
  pickupToCustomerMinutes: number; serviceMinutes: number;
  configuredMaxHoldMinutes: number; confidenceMarginMinutes: number;
  previous?: { releaseAt: string; absoluteDeadlineAt: string; inputVersion: number } | null;
  inputVersion: number;
};

export function decideKitchenHold(input: KitchenHoldInput) {
  const nowMs = Date.parse(input.now);
  const createdMs = Date.parse(input.createdAt);
  const deadlineMs = Date.parse(input.deliveryDeadlineAt);
  if (![nowMs, createdMs, deadlineMs].every(Number.isFinite)) {
    throw new Error('INVALID_KITCHEN_HOLD_TIME');
  }
  const hardCapMinutes = Math.min(15, Math.max(0, input.configuredMaxHoldMinutes));
  const absoluteDeadlineMs = createdMs + hardCapMinutes * 60_000;
  const effectivePrep = Math.max(0, input.prepMinutes) + Math.max(0, input.kitchenQueueMinutes);
  const latestSafeStartMs = deadlineMs - (
    effectivePrep + input.pickupToCustomerMinutes + input.serviceMinutes +
    input.confidenceMarginMinutes
  ) * 60_000;
  const justInTimeMs = nowMs +
    Math.max(0, input.driverEtaToPickupMinutes - effectivePrep) * 60_000;
  const releaseMs = Math.min(absoluteDeadlineMs, latestSafeStartMs, justInTimeMs);
  const action = nowMs >= releaseMs ? 'release_now' : 'hold';
  const reasonCode = nowMs >= latestSafeStartMs ? 'DEADLINE_OVERRIDE'
    : nowMs >= absoluteDeadlineMs ? 'HARD_CAP_REACHED'
      : action === 'release_now' ? 'DRIVER_JIT_REACHED' : 'WAIT_FOR_DRIVER_OR_MATCH';
  const releaseAt = new Date(Math.max(nowMs, releaseMs)).toISOString();
  const previousReleaseMs = input.previous ? Date.parse(input.previous.releaseAt) : Number.NaN;
  const previousDeadlineMs = input.previous ? Date.parse(input.previous.absoluteDeadlineAt) : Number.NaN;
  const stable = input.previous && input.previous.inputVersion === input.inputVersion &&
      Number.isFinite(previousReleaseMs) && Number.isFinite(previousDeadlineMs) &&
      previousReleaseMs <= previousDeadlineMs
    ? input.previous.releaseAt : releaseAt;
  return {
    action, reasonCode, releaseAt: stable,
    absoluteDeadlineAt: new Date(absoluteDeadlineMs).toISOString(),
    nextEvaluationAt: new Date(Math.min(Date.parse(stable), nowMs + 60_000)).toISOString(),
    inputVersion: input.inputVersion,
    audit: {
      effectivePrepMinutes: effectivePrep, latestSafeStartAt: new Date(latestSafeStartMs).toISOString(),
      driverEtaToPickupMinutes: input.driverEtaToPickupMinutes,
      pickupToCustomerMinutes: input.pickupToCustomerMinutes,
      hardCapMinutes,
    },
  };
}
