import { gpsEligibleForNewAssignment, type DispatchGpsCandidate } from './gps-dispatch-eligibility';
import { haversineApproxKm } from './intelligent-dispatch';

export const DETERMINISTIC_DISPATCH_VERSION = 'deterministic-baseline-v1';

export type DispatchExclusion =
  | 'TENANT_MEMBERSHIP_INACTIVE'
  | 'SHIFT_INACTIVE'
  | 'DRIVER_INACTIVE'
  | 'DRIVER_STATE_INELIGIBLE'
  | 'BLOCKING_EXCEPTION'
  | 'GPS_MISSING'
  | 'GPS_STALE'
  | 'GPS_UNTRUSTED'
  | 'CAPACITY_EXCEEDED'
  | 'ACTIVE_ROUTE_REQUIRES_T08'
  | 'VEHICLE_UNSUPPORTED'
  | 'PICKUP_OUTSIDE_DRIVER_RADIUS'
  | 'ORDER_OUTSIDE_DELIVERY_RADIUS'
  | 'DEADLINE_MISSING'
  | 'DEADLINE_INFEASIBLE';

export type DeterministicOrderSnapshot = {
  id: string;
  tenantId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  deliveryDeadlineAt: string | null;
};

export type DeterministicDriverSnapshot = {
  id: string;
  tenantMembershipActive: boolean;
  shiftActive: boolean;
  active: boolean;
  state: string;
  vehicle: 'bike' | 'car' | string;
  maxRadiusKm: number;
  currentCapacity: number;
  maxCapacity: number;
  activeRouteStops: number;
  blockingException: boolean;
  assignmentsLastHour: number;
  lastAssignedAt: string | null;
  gps: (DispatchGpsCandidate & { latitude: number; longitude: number }) | null;
};

export type DeterministicDispatchConfig = {
  maxDeliveryKm: number;
  idleGpsStaleSeconds: number;
  maxGpsAccuracyM: number;
  bikeSpeedKmh: number;
  carSpeedKmh: number;
  pickupServiceMinutes: number;
  dropoffServiceMinutes: number;
  deadlineSafetyMinutes: number;
  workloadMinutesPerStop: number;
  fairnessMinutesPerAssignment: number;
  recentAssignmentMinutes: number;
  recentAssignmentWindowMinutes: number;
};

export const DEFAULT_DETERMINISTIC_DISPATCH_CONFIG: DeterministicDispatchConfig = {
  maxDeliveryKm: 20,
  idleGpsStaleSeconds: 180,
  maxGpsAccuracyM: 200,
  bikeSpeedKmh: 18,
  carSpeedKmh: 35,
  pickupServiceMinutes: 3,
  dropoffServiceMinutes: 3,
  deadlineSafetyMinutes: 5,
  workloadMinutesPerStop: 8,
  fairnessMinutesPerAssignment: 0.25,
  recentAssignmentMinutes: 0.25,
  recentAssignmentWindowMinutes: 15,
};

export type CandidateAudit = {
  driverId: string;
  eligible: boolean;
  exclusions: DispatchExclusion[];
  components: null | {
    driverToPickupMinutes: number;
    pickupToDropoffMinutes: number;
    serviceMinutes: number;
    workloadMinutes: number;
    fairnessMinutes: number;
    deadlineSlackMinutes: number;
    totalMinutes: number;
  };
};

export type DeterministicDispatchDecision = {
  algorithmVersion: typeof DETERMINISTIC_DISPATCH_VERSION;
  orderId: string;
  evaluatedAt: string;
  config: DeterministicDispatchConfig;
  winnerDriverId: string | null;
  reasonCode: 'WINNER_SELECTED' | 'NO_ELIGIBLE_DRIVER';
  candidates: CandidateAudit[];
};

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeDeterministicDispatchConfig(
  value: Partial<DeterministicDispatchConfig>,
): DeterministicDispatchConfig {
  const d = DEFAULT_DETERMINISTIC_DISPATCH_CONFIG;
  return {
    // The backend tenant policy is authoritative. T07 validates that the
    // value is positive/finite but does not invent a client-side distance cap.
    maxDeliveryKm: Math.max(0.1, positive(value.maxDeliveryKm ?? d.maxDeliveryKm, d.maxDeliveryKm)),
    idleGpsStaleSeconds: Math.max(30, positive(value.idleGpsStaleSeconds ?? d.idleGpsStaleSeconds, d.idleGpsStaleSeconds)),
    maxGpsAccuracyM: Math.max(1, positive(value.maxGpsAccuracyM ?? d.maxGpsAccuracyM, d.maxGpsAccuracyM)),
    bikeSpeedKmh: Math.max(1, positive(value.bikeSpeedKmh ?? d.bikeSpeedKmh, d.bikeSpeedKmh)),
    carSpeedKmh: Math.max(1, positive(value.carSpeedKmh ?? d.carSpeedKmh, d.carSpeedKmh)),
    pickupServiceMinutes: positive(value.pickupServiceMinutes ?? d.pickupServiceMinutes, d.pickupServiceMinutes),
    dropoffServiceMinutes: positive(value.dropoffServiceMinutes ?? d.dropoffServiceMinutes, d.dropoffServiceMinutes),
    deadlineSafetyMinutes: positive(value.deadlineSafetyMinutes ?? d.deadlineSafetyMinutes, d.deadlineSafetyMinutes),
    workloadMinutesPerStop: positive(value.workloadMinutesPerStop ?? d.workloadMinutesPerStop, d.workloadMinutesPerStop),
    fairnessMinutesPerAssignment: positive(value.fairnessMinutesPerAssignment ?? d.fairnessMinutesPerAssignment, d.fairnessMinutesPerAssignment),
    recentAssignmentMinutes: positive(value.recentAssignmentMinutes ?? d.recentAssignmentMinutes, d.recentAssignmentMinutes),
    recentAssignmentWindowMinutes: Math.max(1, positive(value.recentAssignmentWindowMinutes ?? d.recentAssignmentWindowMinutes, d.recentAssignmentWindowMinutes)),
  };
}

export function decideDeterministicDispatch(
  order: DeterministicOrderSnapshot,
  drivers: readonly DeterministicDriverSnapshot[],
  input: Partial<DeterministicDispatchConfig>,
  now: Date,
): DeterministicDispatchDecision {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('INVALID_EVALUATION_TIME');
  const config = normalizeDeterministicDispatchConfig(input);
  const deliveryKm = haversineApproxKm(order.pickup, order.dropoff);
  const deadlineMs = order.deliveryDeadlineAt ? Date.parse(order.deliveryDeadlineAt) : Number.NaN;

  const candidates = [...drivers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((driver): CandidateAudit => {
      const exclusions: DispatchExclusion[] = [];
      if (!driver.tenantMembershipActive) exclusions.push('TENANT_MEMBERSHIP_INACTIVE');
      if (!driver.shiftActive) exclusions.push('SHIFT_INACTIVE');
      if (!driver.active) exclusions.push('DRIVER_INACTIVE');
      if (!['idle', 'available', 'returning'].includes(driver.state)) exclusions.push('DRIVER_STATE_INELIGIBLE');
      if (driver.blockingException) exclusions.push('BLOCKING_EXCEPTION');
      if (driver.vehicle !== 'bike' && driver.vehicle !== 'car') exclusions.push('VEHICLE_UNSUPPORTED');
      if (Math.max(0, driver.currentCapacity) + 1 > Math.max(0, driver.maxCapacity)) exclusions.push('CAPACITY_EXCEEDED');
      // T07 cannot prove insertion geometry for an existing route. Until T08
      // provides road-route/detour feasibility, fail closed instead of creating
      // a second, potentially opposite-direction trip.
      if (Math.max(0, driver.activeRouteStops) > 0) exclusions.push('ACTIVE_ROUTE_REQUIRES_T08');
      if (deliveryKm > config.maxDeliveryKm) exclusions.push('ORDER_OUTSIDE_DELIVERY_RADIUS');
      if (!Number.isFinite(deadlineMs)) exclusions.push('DEADLINE_MISSING');

      const gps = gpsEligibleForNewAssignment(driver.gps, {
        nowMs,
        staleSeconds: config.idleGpsStaleSeconds,
        maxAccuracyM: config.maxGpsAccuracyM,
      });
      if (!gps.eligible) {
        exclusions.push(gps.reason === 'gps_missing' ? 'GPS_MISSING'
          : gps.reason === 'gps_stale' ? 'GPS_STALE' : 'GPS_UNTRUSTED');
      }
      // Trustworthy coordinates and a supported vehicle are prerequisites for
      // route math. Other failed gates do not short-circuit: their candidate
      // audit still records radius and deadline feasibility when computable.
      if (!driver.gps || !gps.eligible || (driver.vehicle !== 'bike' && driver.vehicle !== 'car')) {
        return { driverId: driver.id, eligible: false, exclusions, components: null };
      }

      const pickupKm = haversineApproxKm(
        { lat: driver.gps.latitude, lng: driver.gps.longitude },
        order.pickup,
      );
      if (pickupKm > driver.maxRadiusKm) exclusions.push('PICKUP_OUTSIDE_DRIVER_RADIUS');
      const speed = driver.vehicle === 'car' ? config.carSpeedKmh : config.bikeSpeedKmh;
      const driverToPickupMinutes = pickupKm / speed * 60;
      const pickupToDropoffMinutes = deliveryKm / speed * 60;
      const serviceMinutes = config.pickupServiceMinutes + config.dropoffServiceMinutes;
      const workloadMinutes = Math.max(0, driver.activeRouteStops) * config.workloadMinutesPerStop;
      const recentMs = driver.lastAssignedAt ? Date.parse(driver.lastAssignedAt) : Number.NaN;
      const fairnessMinutes =
        Math.max(0, driver.assignmentsLastHour) * config.fairnessMinutesPerAssignment +
        (Number.isFinite(recentMs) && nowMs - recentMs < config.recentAssignmentWindowMinutes * 60_000
          ? config.recentAssignmentMinutes : 0);
      const completionMinutes =
        driverToPickupMinutes + pickupToDropoffMinutes + serviceMinutes + workloadMinutes;
      const deadlineSlackMinutes = (deadlineMs - (nowMs + completionMinutes * 60_000)) / 60_000;
      if (deadlineSlackMinutes < config.deadlineSafetyMinutes) exclusions.push('DEADLINE_INFEASIBLE');
      // Fairness is intentionally not blended into route/deadline cost. It is
      // consulted only after operational cost ties, so it cannot make a
      // slower or deadline-riskier driver win.
      const totalMinutes = completionMinutes;
      return {
        driverId: driver.id,
        eligible: exclusions.length === 0,
        exclusions,
        components: {
          driverToPickupMinutes, pickupToDropoffMinutes, serviceMinutes,
          workloadMinutes, fairnessMinutes, deadlineSlackMinutes, totalMinutes,
        },
      };
    });

  const winner = candidates.filter((candidate) => candidate.eligible && candidate.components)
    .sort((a, b) => {
      const score = a.components!.totalMinutes - b.components!.totalMinutes;
      if (Math.abs(score) > 1e-9) return score;
      const fairness =
        a.components!.fairnessMinutes - b.components!.fairnessMinutes;
      return Math.abs(fairness) > 1e-9
        ? fairness
        : a.driverId.localeCompare(b.driverId);
    })[0];
  return {
    algorithmVersion: DETERMINISTIC_DISPATCH_VERSION,
    orderId: order.id,
    evaluatedAt: now.toISOString(),
    config,
    winnerDriverId: winner?.driverId ?? null,
    reasonCode: winner ? 'WINNER_SELECTED' : 'NO_ELIGIBLE_DRIVER',
    candidates,
  };
}

export function replayDeterministicDispatch(
  snapshots: readonly {
    order: DeterministicOrderSnapshot;
    drivers: readonly DeterministicDriverSnapshot[];
    config?: Partial<DeterministicDispatchConfig>;
    evaluatedAt: string;
  }[],
) {
  return snapshots.map((snapshot) =>
    decideDeterministicDispatch(
      snapshot.order,
      snapshot.drivers,
      snapshot.config ?? {},
      new Date(snapshot.evaluatedAt),
    ));
}

/**
 * Keeps shadow execution structurally incapable of invoking the canonical
 * mutation callback. Active execution still delegates the write to atomic-v2.
 */
export async function executeDeterministicDecision<T>(
  mode: 'shadow' | 'active',
  decision: DeterministicDispatchDecision,
  atomicWrite: (driverId: string) => Promise<T>,
): Promise<{ mode: 'shadow'; decision: DeterministicDispatchDecision } | {
  mode: 'active'; decision: DeterministicDispatchDecision; result: T | null;
}> {
  if (mode === 'shadow') return { mode, decision };
  return {
    mode,
    decision,
    result: decision.winnerDriverId
      ? await atomicWrite(decision.winnerDriverId)
      : null,
  };
}

export function canonicalShiftEligible(active: boolean, state: string): boolean {
  return active && ['idle', 'available', 'returning'].includes(state);
}

export function deterministicScanStatuses(mode: 'off' | 'shadow' | 'active') {
  return mode === 'active'
    ? ['fertig', 'ready'] as const
    : ['neu', 'in_zubereitung', 'fertig'] as const;
}

export function deterministicModePolicy(mode: 'off' | 'shadow' | 'active') {
  return {
    mode,
    evaluate: mode !== 'off',
    mayInvokeAtomicWriter: mode === 'active',
    continueIncumbent: mode !== 'active',
    scanStatuses: deterministicScanStatuses(mode),
  } as const;
}

export function snapshotPageSaturated(count: number, limit: number): boolean {
  return count >= limit;
}

/** Terminal result for failures that occur before a shadow decision exists. */
export function preDecisionHold(): 'held' {
  return 'held';
}
