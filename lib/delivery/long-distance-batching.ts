import { haversineApproxKm, type DispatchPoint } from './intelligent-dispatch';

export type LongDistanceReasonCode =
  | 'LOCAL_NO_HOLD'
  | 'DISTANCE_TIER_HOLD'
  | 'HOLD_DEADLINE_REACHED'
  | 'DELIVERY_DEADLINE_OVERRIDE'
  | 'OUTSIDE_20KM_HARD_CAP'
  | 'MISSING_COORDINATES'
  | 'BUNDLE_COMPATIBLE'
  | 'OPPOSITE_DIRECTION'
  | 'OUTSIDE_ROUTE_CORRIDOR'
  | 'DETOUR_KM_EXCEEDED'
  | 'DETOUR_RATIO_EXCEEDED'
  | 'CAPACITY_EXCEEDED'
  | 'ADDITIONAL_ORDER_LIMIT'
  | 'BUNDLE_DEADLINE_INFEASIBLE';

export interface LongDistanceBatchConfig {
  hardMaxDeliveryKm: number;
  localMaxKm: number;
  localMaxHoldSeconds: number;
  mediumMaxKm: number;
  mediumMaxHoldSeconds: number;
  farMaxKm: number;
  farMaxHoldSeconds: number;
  edgeMaxHoldSeconds: number;
  maxAdditionalOrders: number;
  corridorWidthKm: number;
  maxHeadingDegrees: number;
  maxDetourKm: number;
  maxDetourRatio: number;
  averageSpeedKmh: number;
  serviceMinutesPerOrder: number;
  deadlineSafetyMinutes: number;
}

export const DEFAULT_LONG_DISTANCE_BATCH_CONFIG: LongDistanceBatchConfig = {
  hardMaxDeliveryKm: 20,
  localMaxKm: 3,
  localMaxHoldSeconds: 0,
  mediumMaxKm: 8,
  mediumMaxHoldSeconds: 60,
  farMaxKm: 15,
  farMaxHoldSeconds: 180,
  edgeMaxHoldSeconds: 300,
  maxAdditionalOrders: 3,
  corridorWidthKm: 2,
  maxHeadingDegrees: 50,
  maxDetourKm: 3,
  maxDetourRatio: 0.25,
  averageSpeedKmh: 30,
  serviceMinutesPerOrder: 4,
  deadlineSafetyMinutes: 5,
};

export interface LongDistanceOrder {
  id: string;
  pickup: DispatchPoint;
  dropoff: DispatchPoint;
  createdAt: string;
  deadlineAt: string | null;
}

export interface HoldDecision {
  action: 'reject' | 'dispatch_now' | 'hold';
  reasonCode: LongDistanceReasonCode;
  deliveryDistanceKm: number | null;
  maxHoldSeconds: number;
  holdUntil: string | null;
  audit: Record<string, number | string | null>;
}

export interface CorridorBundleInput {
  routeStart: DispatchPoint;
  routeEnd: DispatchPoint;
  candidate: LongDistanceOrder;
  existingAdditionalOrders: number;
  activeStops: number;
  maxCapacity: number;
}

export interface CorridorBundleDecision {
  compatible: boolean;
  reasonCode: LongDistanceReasonCode;
  corridorDistanceKm: number | null;
  headingDifferenceDegrees: number | null;
  detourKm: number | null;
  detourRatio: number | null;
  estimatedCandidateCompletionAt: string | null;
}

function point(p: DispatchPoint): p is { lat: number; lng: number } {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

export function normalizeLongDistanceBatchConfig(
  input: Partial<LongDistanceBatchConfig>,
): LongDistanceBatchConfig {
  const d = { ...DEFAULT_LONG_DISTANCE_BATCH_CONFIG, ...input };
  return {
    ...d,
    hardMaxDeliveryKm: Math.min(20, Math.max(0.1, d.hardMaxDeliveryKm)),
    maxAdditionalOrders: Math.min(3, Math.max(0, Math.floor(d.maxAdditionalOrders))),
    localMaxHoldSeconds: Math.max(0, d.localMaxHoldSeconds),
    mediumMaxHoldSeconds: Math.max(0, d.mediumMaxHoldSeconds),
    farMaxHoldSeconds: Math.max(0, d.farMaxHoldSeconds),
    edgeMaxHoldSeconds: Math.max(0, d.edgeMaxHoldSeconds),
    maxDetourKm: Math.max(0, d.maxDetourKm),
    maxDetourRatio: Math.max(0, d.maxDetourRatio),
  };
}

function tierHoldSeconds(km: number, c: LongDistanceBatchConfig): number {
  if (km <= c.localMaxKm) return c.localMaxHoldSeconds;
  if (km <= c.mediumMaxKm) return c.mediumMaxHoldSeconds;
  if (km <= c.farMaxKm) return c.farMaxHoldSeconds;
  return c.edgeMaxHoldSeconds;
}

export function decideLongDistanceHold(
  order: LongDistanceOrder,
  now: Date,
  input: Partial<LongDistanceBatchConfig> = {},
): HoldDecision {
  const c = normalizeLongDistanceBatchConfig(input);
  if (!point(order.pickup) || !point(order.dropoff)) {
    return { action: 'reject', reasonCode: 'MISSING_COORDINATES', deliveryDistanceKm: null, maxHoldSeconds: 0, holdUntil: null, audit: {} };
  }
  const km = haversineApproxKm(order.pickup, order.dropoff);
  if (km > c.hardMaxDeliveryKm) {
    return { action: 'reject', reasonCode: 'OUTSIDE_20KM_HARD_CAP', deliveryDistanceKm: km, maxHoldSeconds: 0, holdUntil: null, audit: { hard_cap_km: c.hardMaxDeliveryKm } };
  }
  const maxHoldSeconds = tierHoldSeconds(km, c);
  const createdMs = new Date(order.createdAt).getTime();
  const holdUntilMs = createdMs + maxHoldSeconds * 1000;
  const soloMinutes = (km / c.averageSpeedKmh) * 60 + c.serviceMinutesPerOrder;
  const deadlineMs = order.deadlineAt ? new Date(order.deadlineAt).getTime() : Number.NaN;
  const latestDispatchMs = Number.isFinite(deadlineMs)
    ? deadlineMs - (soloMinutes + c.deadlineSafetyMinutes) * 60_000
    : Number.POSITIVE_INFINITY;
  const audit = {
    delivery_km: km,
    max_hold_seconds: maxHoldSeconds,
    solo_eta_minutes: soloMinutes,
    latest_dispatch_at: Number.isFinite(latestDispatchMs) ? new Date(latestDispatchMs).toISOString() : null,
  };
  if (maxHoldSeconds === 0) {
    return { action: 'dispatch_now', reasonCode: 'LOCAL_NO_HOLD', deliveryDistanceKm: km, maxHoldSeconds, holdUntil: null, audit };
  }
  if (now.getTime() >= latestDispatchMs) {
    return { action: 'dispatch_now', reasonCode: 'DELIVERY_DEADLINE_OVERRIDE', deliveryDistanceKm: km, maxHoldSeconds, holdUntil: null, audit };
  }
  if (now.getTime() >= holdUntilMs) {
    return { action: 'dispatch_now', reasonCode: 'HOLD_DEADLINE_REACHED', deliveryDistanceKm: km, maxHoldSeconds, holdUntil: null, audit };
  }
  const effectiveHoldUntil = Math.min(holdUntilMs, latestDispatchMs);
  return {
    action: 'hold',
    reasonCode: 'DISTANCE_TIER_HOLD',
    deliveryDistanceKm: km,
    maxHoldSeconds,
    holdUntil: new Date(effectiveHoldUntil).toISOString(),
    audit,
  };
}

function xyKm(origin: { lat: number; lng: number }, p: { lat: number; lng: number }) {
  const latKm = (p.lat - origin.lat) * 111.195;
  const lngKm = (p.lng - origin.lng) * 111.195 * Math.cos(origin.lat * Math.PI / 180);
  return { x: lngKm, y: latKm };
}

export function evaluateCorridorBundle(
  input: CorridorBundleInput,
  now: Date,
  configInput: Partial<LongDistanceBatchConfig> = {},
): CorridorBundleDecision {
  const c = normalizeLongDistanceBatchConfig(configInput);
  const reject = (
    reasonCode: LongDistanceReasonCode,
    extra: Partial<CorridorBundleDecision> = {},
  ): CorridorBundleDecision => ({
    compatible: false, reasonCode, corridorDistanceKm: null,
    headingDifferenceDegrees: null, detourKm: null, detourRatio: null,
    estimatedCandidateCompletionAt: null, ...extra,
  });
  if (!point(input.routeStart) || !point(input.routeEnd) ||
      !point(input.candidate.pickup) || !point(input.candidate.dropoff)) {
    return reject('MISSING_COORDINATES');
  }
  if (input.existingAdditionalOrders >= c.maxAdditionalOrders) return reject('ADDITIONAL_ORDER_LIMIT');
  if (input.activeStops + 1 > input.maxCapacity) return reject('CAPACITY_EXCEEDED');

  const route = xyKm(input.routeStart, input.routeEnd);
  const candidate = xyKm(input.routeStart, input.candidate.dropoff);
  const routeLength = Math.hypot(route.x, route.y);
  const candidateLength = Math.hypot(candidate.x, candidate.y);
  if (routeLength < 1e-9 || candidateLength < 1e-9) return reject('OPPOSITE_DIRECTION');
  const cosine = Math.max(-1, Math.min(1,
    (route.x * candidate.x + route.y * candidate.y) / (routeLength * candidateLength)));
  const heading = Math.acos(cosine) * 180 / Math.PI;
  if (heading > c.maxHeadingDegrees) {
    return reject('OPPOSITE_DIRECTION', { headingDifferenceDegrees: heading });
  }
  const projection = (candidate.x * route.x + candidate.y * route.y) / (routeLength ** 2);
  const corridorDistance = Math.hypot(
    candidate.x - projection * route.x,
    candidate.y - projection * route.y,
  );
  if (projection < 0 || corridorDistance > c.corridorWidthKm) {
    return reject('OUTSIDE_ROUTE_CORRIDOR', {
      corridorDistanceKm: corridorDistance,
      headingDifferenceDegrees: heading,
    });
  }
  const startToCandidate = haversineApproxKm(input.routeStart, input.candidate.dropoff);
  const candidateToEnd = haversineApproxKm(input.candidate.dropoff, input.routeEnd);
  const detourKm = Math.max(0, startToCandidate + candidateToEnd - routeLength);
  const detourRatio = detourKm / routeLength;
  if (detourKm > c.maxDetourKm) return reject('DETOUR_KM_EXCEEDED', { corridorDistanceKm: corridorDistance, headingDifferenceDegrees: heading, detourKm, detourRatio });
  if (detourRatio > c.maxDetourRatio) return reject('DETOUR_RATIO_EXCEEDED', { corridorDistanceKm: corridorDistance, headingDifferenceDegrees: heading, detourKm, detourRatio });
  const completionMinutes =
    ((routeLength + detourKm) / c.averageSpeedKmh) * 60 +
    c.serviceMinutesPerOrder * (input.existingAdditionalOrders + 2);
  const completionMs = now.getTime() + completionMinutes * 60_000;
  const deadlineMs = input.candidate.deadlineAt
    ? new Date(input.candidate.deadlineAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (completionMs + c.deadlineSafetyMinutes * 60_000 > deadlineMs) {
    return reject('BUNDLE_DEADLINE_INFEASIBLE', {
      corridorDistanceKm: corridorDistance, headingDifferenceDegrees: heading,
      detourKm, detourRatio,
      estimatedCandidateCompletionAt: new Date(completionMs).toISOString(),
    });
  }
  return {
    compatible: true,
    reasonCode: 'BUNDLE_COMPATIBLE',
    corridorDistanceKm: corridorDistance,
    headingDifferenceDegrees: heading,
    detourKm,
    detourRatio,
    estimatedCandidateCompletionAt: new Date(completionMs).toISOString(),
  };
}
