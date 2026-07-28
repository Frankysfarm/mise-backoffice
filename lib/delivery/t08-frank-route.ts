import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { directions } from '../google-maps';
import {
  appendOrderToRouteV2,
  claimAtomicWriterV2,
} from './atomic-offer';
import {
  BoundedRouteMatrixCache,
  evaluateBestInsertion,
  routeKey,
  type RouteMatrix,
  type RoutePoint,
  type RouteStop,
} from './route-batching-hold';
import {
  executeRouteAppendDispatch,
  type RouteAppendCandidate,
  type RouteAppendMode,
} from './route-append-dispatch';

export type T08FrankOrder = {
  id: string;
  locationId: string;
  dispatchVersion: number;
  pickupDeadlineAt: string;
  deliveryDeadlineAt: string;
  dropoff: { lat: number; lng: number; address: string };
};

export type T08FrankLocation = {
  tenantId: string;
  id: string;
  lat: number;
  lng: number;
  address: string;
};

const matrixCache = new BoundedRouteMatrixCache(2_000, 300_000);

function configuredMode(config: { enabled?: boolean; shadow_only?: boolean } | null): RouteAppendMode {
  if (!config?.enabled) return 'off';
  return config.shadow_only ? 'shadow' : 'active';
}

async function matrixFor(points: RoutePoint[]): Promise<RouteMatrix> {
  const matrix: Record<string, { distanceKm: number; durationMinutes: number; source: 'road_matrix' }> = {};
  await Promise.all(points.flatMap((from) => points
    .filter((to) => to.id !== from.id)
    .map(async (to) => {
      const cached = matrixCache.get(from, to);
      if (cached) {
        matrix[routeKey(from, to)] = cached as typeof matrix[string];
        return;
      }
      try {
        const route = await directions({
          origin: from,
          destination: to,
          mode: 'driving',
          departure_time: 'now',
        });
        const leg = {
          distanceKm: route.total_distance_m / 1_000,
          durationMinutes: route.total_duration_s / 60,
          source: 'road_matrix' as const,
        };
        matrixCache.set(from, to, leg);
        matrix[routeKey(from, to)] = leg;
      } catch {
        // A missing/partial provider response intentionally remains absent.
        // evaluateBestInsertion marks the conservative Haversine fallback.
      }
    })));
  return matrix;
}

export async function tryT08RouteAppend(
  client: SupabaseClient,
  writerId: string,
  order: T08FrankOrder,
  location: T08FrankLocation,
  audit: (reason: string, driverId: string | null, data: Record<string, unknown>) => Promise<void>,
): Promise<'not_applicable' | 'shadow' | 'appended' | 'conflict'> {
  const { data: config, error: configError } = await client
    .from('dispatch_routing_hold_config_v2')
    .select('enabled,shadow_only,allow_multi_store,max_added_detour_minutes')
    .eq('tenant_id', location.tenantId)
    .maybeSingle();
  if (configError) {
    if (configError.code === '42P01' || configError.code === 'PGRST205') return 'not_applicable';
    throw new Error(`T08_CONFIG_LOAD_FAILED:${configError.code ?? 'unknown'}`);
  }
  const mode = configuredMode(config);
  if (mode === 'off') return 'not_applicable';
  const allowMultiStore = Boolean(config?.allow_multi_store);
  const maxAddedDetourMinutes = Number(config?.max_added_detour_minutes ?? 8);

  const loadCandidates = async (): Promise<RouteAppendCandidate[]> => {
    const { data: gpsConfig, error: gpsConfigError } = await client
      .from('mise_gps_transport_config')
      .select('active_stale_seconds,max_accuracy_m')
      .eq('tenant_id', location.tenantId)
      .maybeSingle();
    const { data: memberships, error: membershipError } = await client
      .from('mise_driver_tenants')
      .select('driver_id,status')
      .eq('tenant_id', location.tenantId)
      .eq('status', 'active')
      .limit(500);
    if (gpsConfigError || membershipError || !gpsConfig) {
      throw new Error('T08_DRIVER_POLICY_LOAD_FAILED');
    }
    const ids = (memberships ?? []).map((row: any) => row.driver_id as string);
    if (!ids.length) return [];
    const [{ data: drivers, error: driverError }, { data: positions, error: positionError },
      { data: batches, error: batchError }] = await Promise.all([
      client.from('mise_drivers')
        .select('id,active,state,vehicle,state_version,current_capacity,max_capacity')
        .in('id', ids).limit(500),
      client.from('mise_driver_position_current')
        .select('driver_id,latitude,longitude,captured_at,accuracy_m,quality_flags,operational_state')
        .eq('tenant_id', location.tenantId).in('driver_id', ids).limit(500),
      client.from('mise_delivery_batches')
        .select('id,driver_id,location_id,route_version,state,delivery_deadline_at')
        .in('driver_id', ids).not('state', 'in', '("completed","cancelled")').limit(500),
    ]);
    if (driverError || positionError || batchError) throw new Error('T08_ROUTE_SNAPSHOT_FAILED');
    const positionByDriver = new Map((positions ?? []).map((row: any) => [row.driver_id, row]));
    const driverById = new Map((drivers ?? []).map((row: any) => [row.id, row]));
    const nowMs = Date.now();
    const candidates: RouteAppendCandidate[] = [];
    for (const batch of batches ?? []) {
      const driver = driverById.get((batch as any).driver_id) as any;
      const position = positionByDriver.get((batch as any).driver_id) as any;
      const capturedMs = Date.parse(position?.captured_at ?? '');
      const rejection = !driver || !driver.active || driver.state === 'offline'
        ? 'DRIVER_OFFLINE'
        : !position ? 'GPS_MISSING'
          : !Number.isFinite(capturedMs) ||
            nowMs - capturedMs > Number(gpsConfig.active_stale_seconds) * 1_000
            ? 'GPS_STALE'
            : Number(position.accuracy_m) > Number(gpsConfig.max_accuracy_m) ||
              (position.quality_flags ?? []).length > 0 ||
              position.operational_state === 'invalid'
              ? 'GPS_UNTRUSTED'
              : Number(driver.current_capacity) >= Number(driver.max_capacity)
                ? 'CAPACITY_EXCEEDED'
                : null;
      if (rejection) {
        candidates.push({
          driverId: (batch as any).driver_id,
          batchId: (batch as any).id,
          expectedDriverVersion: Number(driver?.state_version ?? 0),
          expectedRouteVersion: Number((batch as any).route_version),
          input: {},
          decision: {
            compatible: false, reasonCode: rejection, stops: [],
            totalMinutes: null, addedMinutes: null,
            matrixFallbackUsed: false, arrivals: {},
          },
        });
        continue;
      }
      const { data: rawStops, error: stopError } = await client
        .from('mise_delivery_batch_stops')
        .select('id,order_id,type,lat,lng,address,sequence,state,completed_at')
        .eq('batch_id', (batch as any).id)
        .is('completed_at', null)
        .not('state', 'eq', 'cancelled')
        .order('sequence', { ascending: true })
        .limit(100);
      if (stopError || !rawStops?.length) continue;
      const orderIds = [...new Set(rawStops.map((stop: any) => stop.order_id as string))];
      const { data: deadlines, error: deadlineError } = await client
        .from('customer_orders').select('id,eta_earliest,eta_latest')
        .in('id', orderIds).limit(100);
      if (deadlineError) continue;
      const deadlineByOrder = new Map((deadlines ?? []).map((row: any) => [row.id, row]));
      const existingStops: RouteStop[] = rawStops.map((stop: any) => {
        const deadline = deadlineByOrder.get(stop.order_id) as any;
        return {
          id: stop.id,
          orderId: stop.order_id,
          kind: stop.type,
          point: { id: stop.id, lat: Number(stop.lat), lng: Number(stop.lng) },
          serviceMinutes: 2,
          readyAt: stop.type === 'pickup' ? deadline?.eta_earliest ?? null : null,
          deadlineAt: stop.type === 'dropoff' ? deadline?.eta_latest ?? null : null,
        };
      });
      if (existingStops.some((stop) => !Number.isFinite(stop.point.lat) ||
          !Number.isFinite(stop.point.lng))) continue;
      const pickupStopId = randomUUID();
      const dropoffStopId = randomUUID();
      const pickup: RouteStop = {
        id: pickupStopId, orderId: order.id, kind: 'pickup',
        point: { id: pickupStopId, lat: location.lat, lng: location.lng },
        serviceMinutes: 2, readyAt: order.pickupDeadlineAt,
      };
      const dropoff: RouteStop = {
        id: dropoffStopId, orderId: order.id, kind: 'dropoff',
        point: { id: dropoffStopId, ...order.dropoff },
        serviceMinutes: 2, deadlineAt: order.deliveryDeadlineAt,
      };
      const start = {
        id: `driver:${driver.id}`,
        lat: Number(position.latitude),
        lng: Number(position.longitude),
      };
      const matrix = await matrixFor([start, ...existingStops.map((stop) => stop.point),
        pickup.point, dropoff.point]);
      const decision = evaluateBestInsertion({
        now: new Date().toISOString(),
        start,
        existingStops,
        candidatePickup: pickup,
        candidateDropoff: dropoff,
        existingStoreId: (batch as any).location_id,
        candidateStoreId: location.id,
        matrix,
        config: {
          capacity: Number(driver.max_capacity),
          maxAddedDetourMinutes,
          maxExistingCustomerDelayMinutes: 5,
          deadlineSafetyMinutes: 3,
          allowMultiStore,
        },
      });
      candidates.push({
        driverId: driver.id,
        batchId: (batch as any).id,
        expectedDriverVersion: Number(driver.state_version),
        expectedRouteVersion: Number((batch as any).route_version),
        decision,
        input: { pickupStopId, dropoffStopId, location, order },
      });
    }
    return candidates;
  };

  const lease = mode === 'active'
    ? await claimAtomicWriterV2(client, location.tenantId, writerId)
    : null;
  if (mode === 'active' && (!lease?.ok || lease.writer_epoch == null)) return 'conflict';
  const outcome = await executeRouteAppendDispatch(mode, {
    loadCandidates,
    append: async (candidate) => {
      const input = candidate.input as {
        pickupStopId: string; dropoffStopId: string;
      };
      return appendOrderToRouteV2(client, {
        tenantId: location.tenantId,
        writerId,
        writerEpoch: lease!.writer_epoch!,
        driverId: candidate.driverId,
        expectedDriverVersion: candidate.expectedDriverVersion,
        batchId: candidate.batchId,
        expectedRouteVersion: candidate.expectedRouteVersion,
        orderId: order.id,
        expectedOrderVersion: order.dispatchVersion,
        pickupStopId: input.pickupStopId,
        dropoffStopId: input.dropoffStopId,
        pickup: { lat: location.lat, lng: location.lng, address: location.address },
        dropoff: order.dropoff,
        pickupDeadlineAt: order.pickupDeadlineAt,
        deliveryDeadlineAt: order.deliveryDeadlineAt,
        routeStops: candidate.decision.stops.map((stop) => ({ id: stop.id, kind: stop.kind })),
        arrivals: candidate.decision.arrivals,
        explanation: {
          reason_code: candidate.decision.reasonCode,
          total_minutes: candidate.decision.totalMinutes,
          added_minutes: candidate.decision.addedMinutes,
          expected_driver_version: candidate.expectedDriverVersion,
          expected_route_version: candidate.expectedRouteVersion,
          expected_order_version: order.dispatchVersion,
        },
        matrixFallbackUsed: candidate.decision.matrixFallbackUsed,
        actionId: randomUUID(),
        correlationId: randomUUID(),
      });
    },
    audit: (event) => audit(event.reasonCode, event.winnerDriverId, {
      mode: event.mode,
      candidates: event.candidates,
    }),
  });
  return outcome.outcome;
}
