import {
  captureAdaptiveDispatchRuntimeShadow,
  type PersistedDispatchObservation,
  type RuntimeDispatchSnapshot,
  type RuntimeShadowCapture,
  type RuntimeStop,
} from './adaptive-dispatch-runtime-shadow';
import type { Point } from './adaptive-dispatch-optimizer';

/**
 * Read-only SQL executor injected by the caller. The module never creates a
 * database client, opens a network connection or registers a provider
 * callback; it only issues SELECT statements through this seam.
 */
export type ShadowSqlExecutor = (sql: string) => Promise<Record<string, unknown>[]>;

export type DbShadowOptions = {
  captureId: string;
  evaluatedAt: string;
  maxBundleOrders: number;
  /**
   * Scopes the shadow to one store's dispatch decision: only active
   * assignments whose orders belong to this location are read back, and only
   * idle drivers plus the drivers holding those assignments are candidates.
   */
  locationId?: string;
  vehicleSpeedsKmh?: { bike: number; car: number };
  stopServiceMinutes?: number;
  fallbackDeadlineMinutes?: number;
  endangeredWindowMinutes?: number;
};

export type DbShadowResult = {
  capture: RuntimeShadowCapture;
  loaded: {
    assignmentRows: number;
    stopRows: number;
    orderRows: number;
    driverRows: number;
    gpsRows: number;
  };
};

const ACTIVE_ASSIGNMENT_STATES = "('offered','accepted','assigned','picked_up','in_progress')";

const defaults = {
  vehicleSpeedsKmh: { bike: 18, car: 30 },
  stopServiceMinutes: 3,
  fallbackDeadlineMinutes: 45,
  endangeredWindowMinutes: 10,
} as const;

function guardReadOnly(sql: string): string {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith('select')) throw new Error('DB_SHADOW_WRITE_REJECTED');
  if (/;\s*\S/.test(sql)) throw new Error('DB_SHADOW_MULTI_STATEMENT_REJECTED');
  return sql;
}

const rad = (n: number) => (n * Math.PI) / 180;
function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function num(value: unknown, context: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`DB_SHADOW_NUMERIC_INVALID:${context}`);
  return parsed;
}

function str(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`DB_SHADOW_TEXT_INVALID:${context}`);
  return value;
}

type LoadedOrder = {
  id: string; storeId: string; pickup: Point; dropoff: Point;
  readyAt: string; deadlineAt: string;
};
type LoadedDriver = {
  id: string; vehicle: 'bike' | 'car'; gps: Point | null;
  gpsAgeSeconds: number; gpsAccuracyM: number; radiusKm: number;
};

function routeMinutes(points: readonly Point[], speedKmh: number, serviceMinutes: number): number {
  let km = 0;
  for (let index = 1; index < points.length; index += 1) km += distanceKm(points[index - 1], points[index]);
  return (km / speedKmh) * 60 + serviceMinutes * Math.max(0, points.length - 1);
}

/**
 * Deterministic candidate stop shape: every pickup at the store first
 * (ordered by order id), then dropoffs by nearest-neighbor from the store.
 * Single-order routes collapse to pickup then dropoff, which is exactly the
 * shape the Atomic-v2 writer persists today.
 */
function canonicalStops(storeId: string, orders: readonly LoadedOrder[]): RuntimeStop[] {
  const sorted = [...orders].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const stops: RuntimeStop[] = sorted.map((order, index) => ({
    kind: 'pickup', orderId: order.id, storeId, sequence: index + 1,
  }));
  const remaining = [...sorted];
  let cursor = sorted[0]?.pickup;
  while (remaining.length > 0 && cursor) {
    remaining.sort((a, b) =>
      distanceKm(cursor!, a.dropoff) - distanceKm(cursor!, b.dropoff) || a.id.localeCompare(b.id, 'en'));
    const next = remaining.shift()!;
    stops.push({ kind: 'dropoff', orderId: next.id, storeId, sequence: stops.length + 1 });
    cursor = next.dropoff;
  }
  return stops;
}

function subsets(ids: readonly string[], max: number): string[][] {
  const out: string[][] = [];
  const walk = (start: number, chosen: string[]) => {
    if (chosen.length) out.push([...chosen]);
    if (chosen.length === max) return;
    for (let index = start; index < ids.length; index += 1) walk(index + 1, [...chosen, ids[index]]);
  };
  walk(0, []);
  return out;
}

/**
 * Default-off, read-only DB shadow. Loads the actual persisted dispatch state
 * (active assignments, their batch stop rows, orders, drivers, latest GPS)
 * through the injected SELECT-only executor, rebuilds a runtime snapshot with
 * deterministic haversine route estimates, and hands both to the existing
 * runtime-shadow seam so persisted assignments and exact stop sequences are
 * validated against the adaptive optimizer decision. No writer, no
 * activation default, no provider callback.
 */
export async function loadAdaptiveDispatchDbShadow(
  enabled: boolean,
  execute: ShadowSqlExecutor,
  options: DbShadowOptions,
): Promise<DbShadowResult> {
  if (!enabled) throw new Error('RUNTIME_CAPTURE_DISABLED');
  const config = { ...defaults, ...options };
  const run = (sql: string) => execute(guardReadOnly(sql));
  const evaluatedMs = Date.parse(config.evaluatedAt);
  if (!Number.isFinite(evaluatedMs)) throw new Error('RUNTIME_CAPTURE_TIME_INVALID');

  const locationFilter = config.locationId
    ? ` and exists (select 1 from customer_orders scope_o where scope_o.id = a.order_id and scope_o.location_id = '${config.locationId.replaceAll("'", '')}')`
    : '';
  const assignmentRows = await run(`
    select a.driver_id, a.order_id, a.batch_id
    from dispatch_offer_assignments a
    where a.state in ${ACTIVE_ASSIGNMENT_STATES}${locationFilter}
    order by a.driver_id, a.order_id`);
  const batchIds = [...new Set(assignmentRows.map((row) => str(row.batch_id, 'batch_id')))];
  const orderIds = [...new Set(assignmentRows.map((row) => str(row.order_id, 'order_id')))];
  const inList = (values: readonly string[]) => values.map((value) => `'${value.replaceAll("'", '')}'`).join(',');

  const stopRows = batchIds.length === 0 ? [] : await run(`
    select s.batch_id, s.order_id, s.type, s.sequence, s.lat, s.lng
    from mise_delivery_batch_stops s
    where s.batch_id in (${inList(batchIds)})
    order by s.batch_id, s.sequence`);
  const orderRows = orderIds.length === 0 ? [] : await run(`
    select o.id, o.location_id, o.kunde_lat, o.kunde_lng, o.fertig_am, o.bestellt_am, o.eta_latest
    from customer_orders o
    where o.id in (${inList(orderIds)})
    order by o.id`);
  const scopedDriverIds = [...new Set(assignmentRows.map((row) => str(row.driver_id, 'driver_id')))];
  const driverScope = config.locationId
    ? ` and (d.state = 'idle'${scopedDriverIds.length > 0 ? ` or d.id in (${inList(scopedDriverIds)})` : ''})`
    : '';
  const driverRows = await run(`
    select d.id, d.vehicle, d.max_radius_km
    from mise_drivers d
    where d.active = true${driverScope}
    order by d.id`);
  const gpsRows = await run(`
    select p.driver_id, p.lat, p.lng, p.accuracy_m, p.recorded_at
    from mise_driver_locations p
    join (
      select driver_id, max(recorded_at) as recorded_at
      from mise_driver_locations group by driver_id
    ) latest on latest.driver_id = p.driver_id and latest.recorded_at = p.recorded_at
    order by p.driver_id`);

  const pickupByOrder = new Map<string, Point>();
  for (const row of stopRows) {
    if (str(row.type, 'stop.type') === 'pickup' && !pickupByOrder.has(str(row.order_id, 'stop.order_id'))) {
      pickupByOrder.set(str(row.order_id, 'stop.order_id'), {
        lat: num(row.lat, 'stop.lat'), lng: num(row.lng, 'stop.lng'),
      });
    }
  }

  const orders: LoadedOrder[] = orderRows.map((row) => {
    const id = str(row.id, 'order.id');
    const pickup = pickupByOrder.get(id);
    if (!pickup) throw new Error(`DB_SHADOW_PICKUP_STOP_MISSING:${id}`);
    const readyAtRaw = row.fertig_am ?? row.bestellt_am;
    const readyAt = new Date(str(readyAtRaw, 'order.readyAt')).toISOString();
    const deadlineAt = row.eta_latest
      ? new Date(str(row.eta_latest, 'order.eta_latest')).toISOString()
      : new Date(Date.parse(readyAt) + config.fallbackDeadlineMinutes * 60_000).toISOString();
    return {
      id,
      storeId: str(row.location_id, 'order.location_id'),
      pickup,
      dropoff: { lat: num(row.kunde_lat, 'order.kunde_lat'), lng: num(row.kunde_lng, 'order.kunde_lng') },
      readyAt,
      deadlineAt,
    };
  });
  const orderById = new Map(orders.map((order) => [order.id, order]));

  const gpsByDriver = new Map(gpsRows.map((row) => [str(row.driver_id, 'gps.driver_id'), row]));
  const drivers: LoadedDriver[] = driverRows.map((row) => {
    const id = str(row.id, 'driver.id');
    const vehicleRaw = str(row.vehicle, 'driver.vehicle');
    if (vehicleRaw !== 'bike' && vehicleRaw !== 'car') throw new Error(`DB_SHADOW_VEHICLE_UNKNOWN:${id}`);
    const gps = gpsByDriver.get(id);
    return {
      id,
      vehicle: vehicleRaw,
      gps: gps ? { lat: num(gps.lat, 'gps.lat'), lng: num(gps.lng, 'gps.lng') } : null,
      gpsAgeSeconds: gps ? Math.max(0, (evaluatedMs - Date.parse(str(gps.recorded_at, 'gps.recorded_at'))) / 1000) : Number.POSITIVE_INFINITY,
      gpsAccuracyM: gps && gps.accuracy_m !== null && gps.accuracy_m !== undefined ? num(gps.accuracy_m, 'gps.accuracy_m') : 50,
      radiusKm: num(row.max_radius_km, 'driver.max_radius_km'),
    };
  });

  const persistedByDriver = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const driverId = str(row.driver_id, 'assignment.driver_id');
    persistedByDriver.set(driverId, [...(persistedByDriver.get(driverId) ?? []), str(row.order_id, 'assignment.order_id')]);
  }

  const estimateFor = (driver: LoadedDriver, bundle: readonly LoadedOrder[]) => {
    if (!driver.gps || bundle.length === 0) return null;
    const storeIds = new Set(bundle.map((order) => order.storeId));
    if (storeIds.size !== 1) return null;
    const stops = canonicalStops(bundle[0].storeId, bundle);
    const points: Point[] = [driver.gps, bundle[0].pickup,
      ...stops.filter(({ kind }) => kind === 'dropoff').map(({ orderId }) => orderById.get(orderId)!.dropoff)];
    const speed = config.vehicleSpeedsKmh[driver.vehicle];
    const travelMinutes = routeMinutes(points, speed, config.stopServiceMinutes);
    const latestReadyMinutes = Math.max(...bundle.map((order) => (Date.parse(order.readyAt) - evaluatedMs) / 60_000));
    const singleSum = bundle.reduce((sum, order) =>
      sum + routeMinutes([driver.gps!, order.pickup, order.dropoff], speed, config.stopServiceMinutes), 0);
    return {
      driverId: driver.id,
      orderIds: bundle.map(({ id }) => id),
      etaMinutes: Math.max(travelMinutes, latestReadyMinutes, 0),
      detourMinutes: Math.max(0, travelMinutes - (bundle.length === 1 ? travelMinutes : singleSum / bundle.length)),
      routeFeasible: true,
      storeId: bundle[0].storeId,
      trafficMatrixVersion: `db-shadow-${config.captureId}`,
      stopSequence: stops,
    };
  };

  const routeEstimates: NonNullable<ReturnType<typeof estimateFor>>[] = [];
  const seen = new Set<string>();
  const pushEstimate = (estimate: ReturnType<typeof estimateFor>) => {
    if (!estimate) return;
    const key = `${estimate.driverId}|${[...estimate.orderIds].sort().join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    routeEstimates.push(estimate);
  };
  const ordersByStore = new Map<string, LoadedOrder[]>();
  for (const order of orders) ordersByStore.set(order.storeId, [...(ordersByStore.get(order.storeId) ?? []), order]);
  for (const driver of drivers) {
    for (const storeOrders of ordersByStore.values()) {
      for (const ids of subsets(storeOrders.map(({ id }) => id), Math.min(config.maxBundleOrders, storeOrders.length))) {
        pushEstimate(estimateFor(driver, ids.map((id) => orderById.get(id)!)));
      }
    }
  }

  const snapshot: RuntimeDispatchSnapshot = {
    captureId: config.captureId,
    evaluatedAt: config.evaluatedAt,
    orders: orders.map((order) => ({
      id: order.id, storeId: order.storeId, pickup: order.pickup, dropoff: order.dropoff,
      readyAt: order.readyAt, deadlineAt: order.deadlineAt,
      serviceMinutes: config.stopServiceMinutes, routeFeasible: true,
      endangered: Date.parse(order.deadlineAt) - evaluatedMs < config.endangeredWindowMinutes * 60_000,
    })),
    drivers: drivers.map((driver) => ({
      id: driver.id, vehicle: driver.vehicle, online: driver.gps !== null, sessionActive: driver.gps !== null,
      gps: driver.gps, gpsAgeSeconds: Math.min(driver.gpsAgeSeconds, 86_400), gpsAccuracyM: driver.gpsAccuracyM,
      load: 0, capacity: driver.vehicle === 'bike' ? 2 : 4, radiusKm: driver.radiusKm,
      routeFeasible: true, batteryPct: null, network: 'good',
      assignmentsLastHour: 0, existingStops: [],
    })),
    routeEstimates,
  };

  const stopRowsByBatch = new Map<string, typeof stopRows>();
  for (const row of stopRows) {
    const batchId = str(row.batch_id, 'stop.batch_id');
    stopRowsByBatch.set(batchId, [...(stopRowsByBatch.get(batchId) ?? []), row]);
  }
  const batchByDriver = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const driverId = str(row.driver_id, 'assignment.driver_id');
    batchByDriver.set(driverId, [...new Set([...(batchByDriver.get(driverId) ?? []), str(row.batch_id, 'assignment.batch_id')])]);
  }
  const persisted: PersistedDispatchObservation = {
    assignments: [...persistedByDriver.entries()].map(([driverId, driverOrderIds]) => {
      const rows = (batchByDriver.get(driverId) ?? []).flatMap((batchId) => stopRowsByBatch.get(batchId) ?? []);
      const stops: RuntimeStop[] = rows
        .map((row) => ({
          kind: str(row.type, 'stop.type') as RuntimeStop['kind'],
          orderId: str(row.order_id, 'stop.order_id'),
          storeId: orderById.get(str(row.order_id, 'stop.order_id'))?.storeId ?? 'unknown-store',
          sequence: num(row.sequence, 'stop.sequence'),
        }))
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop, index) => ({ ...stop, sequence: index + 1 }));
      return { driverId, orderIds: driverOrderIds, stops };
    }),
  };

  const capture = captureAdaptiveDispatchRuntimeShadow(enabled, snapshot, persisted, config.maxBundleOrders);
  return {
    capture,
    loaded: {
      assignmentRows: assignmentRows.length,
      stopRows: stopRows.length,
      orderRows: orderRows.length,
      driverRows: driverRows.length,
      gpsRows: gpsRows.length,
    },
  };
}
