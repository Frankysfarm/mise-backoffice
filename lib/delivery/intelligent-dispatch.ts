export type DispatchReasonCode =
  | 'ELIGIBLE'
  | 'MISSING_PICKUP_COORDINATES'
  | 'MISSING_DROPOFF_COORDINATES'
  | 'OUTSIDE_DELIVERY_RADIUS'
  | 'MISSING_DRIVER_COORDINATES'
  | 'DRIVER_GPS_STALE'
  | 'DRIVER_STATE_INELIGIBLE'
  | 'DRIVER_CAPACITY_EXCEEDED'
  | 'DEADLINE_INFEASIBLE';

export interface DispatchPoint {
  lat: number | null;
  lng: number | null;
}

export interface IntelligentDispatchOrder {
  id: string;
  pickup: DispatchPoint;
  dropoff: DispatchPoint;
  deadlineAt: string | null;
}

export interface IntelligentDispatchDriver {
  id: string;
  vehicle: 'bike' | 'car';
  state: string;
  position: DispatchPoint;
  lastPositionAt: string | null;
  activeStops: number;
  maxCapacity: number;
  assignmentsLastHour: number;
  lastAssignedAt: string | null;
}

export interface IntelligentDispatchConfig {
  maxDeliveryKm: number;
  gpsFreshSeconds: number;
  bikeSpeedKmh: number;
  carSpeedKmh: number;
  pickupServiceMinutes: number;
  dropoffServiceMinutes: number;
  deadlineSafetyMinutes: number;
  workloadPenaltyMinutes: number;
  recentAssignmentPenaltyMinutes: number;
  recentAssignmentWindowMinutes: number;
}

export const DEFAULT_INTELLIGENT_DISPATCH_CONFIG: IntelligentDispatchConfig = {
  maxDeliveryKm: 8,
  gpsFreshSeconds: 300,
  bikeSpeedKmh: 18,
  carSpeedKmh: 35,
  pickupServiceMinutes: 3,
  dropoffServiceMinutes: 3,
  deadlineSafetyMinutes: 5,
  workloadPenaltyMinutes: 8,
  recentAssignmentPenaltyMinutes: 2,
  recentAssignmentWindowMinutes: 15,
};

export interface DispatchScoreBreakdown {
  driverToPickupMinutes: number;
  pickupToDropoffMinutes: number;
  serviceMinutes: number;
  workloadPenaltyMinutes: number;
  fairnessPenaltyMinutes: number;
  deadlineSlackMinutes: number | null;
  totalScore: number;
}

export interface DispatchCandidateDecision {
  driverId: string;
  eligible: boolean;
  reasonCodes: DispatchReasonCode[];
  deliveryDistanceKm: number | null;
  driverToPickupDistanceKm: number | null;
  estimatedCompletionAt: string | null;
  score: DispatchScoreBreakdown | null;
}

export interface IntelligentDispatchDecision {
  algorithmVersion: 'intelligent-haversine-v1';
  approximation: 'haversine_static_speed';
  evaluatedAt: string;
  effectiveMaxDeliveryKm: number;
  orderId: string;
  candidates: DispatchCandidateDecision[];
  winnerDriverId: string | null;
}

function validPoint(point: DispatchPoint): point is { lat: number; lng: number } {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat as number) <= 90 &&
    Math.abs(point.lng as number) <= 180
  );
}

export function haversineApproxKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function finiteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeIntelligentDispatchConfig(
  input: Partial<IntelligentDispatchConfig>,
): IntelligentDispatchConfig {
  return {
    maxDeliveryKm: Math.min(
      15,
      Math.max(0.1, finiteNonNegative(input.maxDeliveryKm ?? 8, 8)),
    ),
    gpsFreshSeconds: Math.max(
      30,
      finiteNonNegative(input.gpsFreshSeconds ?? 300, 300),
    ),
    bikeSpeedKmh: Math.max(1, finiteNonNegative(input.bikeSpeedKmh ?? 18, 18)),
    carSpeedKmh: Math.max(1, finiteNonNegative(input.carSpeedKmh ?? 35, 35)),
    pickupServiceMinutes: finiteNonNegative(input.pickupServiceMinutes ?? 3, 3),
    dropoffServiceMinutes: finiteNonNegative(input.dropoffServiceMinutes ?? 3, 3),
    deadlineSafetyMinutes: finiteNonNegative(input.deadlineSafetyMinutes ?? 5, 5),
    workloadPenaltyMinutes: finiteNonNegative(input.workloadPenaltyMinutes ?? 8, 8),
    recentAssignmentPenaltyMinutes: finiteNonNegative(
      input.recentAssignmentPenaltyMinutes ?? 2,
      2,
    ),
    recentAssignmentWindowMinutes: Math.max(
      1,
      finiteNonNegative(input.recentAssignmentWindowMinutes ?? 15, 15),
    ),
  };
}

function reject(
  driverId: string,
  reasonCode: DispatchReasonCode,
  deliveryDistanceKm: number | null,
  driverToPickupDistanceKm: number | null = null,
): DispatchCandidateDecision {
  return {
    driverId,
    eligible: false,
    reasonCodes: [reasonCode],
    deliveryDistanceKm,
    driverToPickupDistanceKm,
    estimatedCompletionAt: null,
    score: null,
  };
}

export function decideIntelligentDispatch(
  order: IntelligentDispatchOrder,
  drivers: IntelligentDispatchDriver[],
  configInput: Partial<IntelligentDispatchConfig>,
  nowInput: Date,
): IntelligentDispatchDecision {
  const config = normalizeIntelligentDispatchConfig(configInput);
  const nowMs = nowInput.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('invalid evaluation time');

  const base: IntelligentDispatchDecision = {
    algorithmVersion: 'intelligent-haversine-v1',
    approximation: 'haversine_static_speed',
    evaluatedAt: nowInput.toISOString(),
    effectiveMaxDeliveryKm: config.maxDeliveryKm,
    orderId: order.id,
    candidates: [],
    winnerDriverId: null,
  };

  if (!validPoint(order.pickup)) {
    base.candidates = drivers.map((driver) =>
      reject(driver.id, 'MISSING_PICKUP_COORDINATES', null));
    return base;
  }
  if (!validPoint(order.dropoff)) {
    base.candidates = drivers.map((driver) =>
      reject(driver.id, 'MISSING_DROPOFF_COORDINATES', null));
    return base;
  }

  const deliveryDistanceKm = haversineApproxKm(order.pickup, order.dropoff);
  if (deliveryDistanceKm > config.maxDeliveryKm) {
    base.candidates = drivers.map((driver) =>
      reject(driver.id, 'OUTSIDE_DELIVERY_RADIUS', deliveryDistanceKm));
    return base;
  }

  const deadlineMs = order.deadlineAt ? new Date(order.deadlineAt).getTime() : null;
  base.candidates = drivers.map((driver) => {
    if (!['idle', 'returning'].includes(driver.state)) {
      return reject(driver.id, 'DRIVER_STATE_INELIGIBLE', deliveryDistanceKm);
    }
    if (!validPoint(driver.position)) {
      return reject(driver.id, 'MISSING_DRIVER_COORDINATES', deliveryDistanceKm);
    }
    const positionAt = driver.lastPositionAt
      ? new Date(driver.lastPositionAt).getTime()
      : Number.NaN;
    if (
      !Number.isFinite(positionAt) ||
      nowMs - positionAt > config.gpsFreshSeconds * 1000 ||
      positionAt > nowMs + 30_000
    ) {
      return reject(driver.id, 'DRIVER_GPS_STALE', deliveryDistanceKm);
    }
    const activeStops = Math.max(0, Math.floor(driver.activeStops));
    const maxCapacity = Math.max(0, Math.floor(driver.maxCapacity));
    if (activeStops + 1 > maxCapacity) {
      return reject(driver.id, 'DRIVER_CAPACITY_EXCEEDED', deliveryDistanceKm);
    }

    const driverToPickupDistanceKm = haversineApproxKm(
      { lat: Number(driver.position.lat), lng: Number(driver.position.lng) },
      { lat: Number(order.pickup.lat), lng: Number(order.pickup.lng) },
    );
    const speedKmh = driver.vehicle === 'car' ? config.carSpeedKmh : config.bikeSpeedKmh;
    const driverToPickupMinutes = (driverToPickupDistanceKm / speedKmh) * 60;
    const pickupToDropoffMinutes = (deliveryDistanceKm / speedKmh) * 60;
    const serviceMinutes = config.pickupServiceMinutes + config.dropoffServiceMinutes;
    const travelAndServiceMinutes =
      driverToPickupMinutes + pickupToDropoffMinutes + serviceMinutes;
    const estimatedCompletionMs = nowMs + travelAndServiceMinutes * 60_000;
    const deadlineSlackMinutes = Number.isFinite(deadlineMs)
      ? ((deadlineMs as number) - estimatedCompletionMs) / 60_000
      : null;
    if (
      deadlineSlackMinutes != null &&
      deadlineSlackMinutes < config.deadlineSafetyMinutes
    ) {
      return reject(
        driver.id,
        'DEADLINE_INFEASIBLE',
        deliveryDistanceKm,
        driverToPickupDistanceKm,
      );
    }

    const workloadPenaltyMinutes = activeStops * config.workloadPenaltyMinutes;
    const lastAssignedMs = driver.lastAssignedAt
      ? new Date(driver.lastAssignedAt).getTime()
      : Number.NaN;
    const recentRecencyPenalty =
      Number.isFinite(lastAssignedMs) &&
      nowMs - lastAssignedMs < config.recentAssignmentWindowMinutes * 60_000
        ? config.recentAssignmentPenaltyMinutes
        : 0;
    const fairnessPenaltyMinutes =
      Math.max(0, Math.floor(driver.assignmentsLastHour)) *
        config.recentAssignmentPenaltyMinutes +
      recentRecencyPenalty;
    const totalScore =
      travelAndServiceMinutes + workloadPenaltyMinutes + fairnessPenaltyMinutes;

    return {
      driverId: driver.id,
      eligible: true,
      reasonCodes: ['ELIGIBLE'],
      deliveryDistanceKm,
      driverToPickupDistanceKm,
      estimatedCompletionAt: new Date(estimatedCompletionMs).toISOString(),
      score: {
        driverToPickupMinutes,
        pickupToDropoffMinutes,
        serviceMinutes,
        workloadPenaltyMinutes,
        fairnessPenaltyMinutes,
        deadlineSlackMinutes,
        totalScore,
      },
    };
  });

  const winner = base.candidates
    .filter((candidate) => candidate.eligible && candidate.score)
    .sort((a, b) => {
      const scoreDelta = a.score!.totalScore - b.score!.totalScore;
      return Math.abs(scoreDelta) > 1e-9
        ? scoreDelta
        : a.driverId.localeCompare(b.driverId);
    })[0];
  base.winnerDriverId = winner?.driverId ?? null;
  return base;
}
