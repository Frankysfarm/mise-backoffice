/**
 * lib/delivery/geo-heatmap.ts — Phase 244
 *
 * Smart Delivery Geo-Heatmap Pro
 *
 * Stündliche Dichte-Snapshots aller Liefer-Koordinaten nach 0.01°-Gitter (≈1 km).
 * Ermöglicht Echtzeit-Heatmap, Zonen-Auslastung pro Stunde und GeoJSON-Export.
 *
 * Öffentliche API:
 *   snapshotCurrentDeliveries(locationId) — Snapshot abgeschlossener Lieferungen → DB
 *   snapshotAllLocations()                — Cron-Batch alle aktiven Locations
 *   getLiveHeatmap(locationId)            — Echtzeit: aktive Orders + Fahrer
 *   getZoneHourlyUtilization(locationId)  — Stunden-Zonen-Auslastung (30 Tage)
 *   getHistoricalHeatmap(locationId,days) — Historische Heatmap aus Snapshots
 *   exportGeoJSON(locationId, opts)       — RFC 7946 FeatureCollection
 *   getDashboard(locationId)              — Kombinierter Dashboard-Response
 *   pruneOldSnapshots(days)              — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  zone: string | null;
}

export interface LiveDriverPoint {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  status: string;
  zone: string | null;
}

export interface LiveHeatmap {
  orderPoints: HeatmapPoint[];
  driverPoints: LiveDriverPoint[];
  totalActiveOrders: number;
  totalOnlineDrivers: number;
  snappedAt: string;
}

export interface ZoneHourCell {
  zone: string;
  hourOfDay: number;
  dayOfWeek: number;
  snapCount: number;
  totalOrders: number;
  avgPerSnap: number;
  peakOrders: number;
}

export interface HistoricalHeatmapCell {
  lat: number;
  lng: number;
  zone: string | null;
  totalOrders: number;
  activeDays: number;
  avgPerSnap: number;
  peakCount: number;
}

export interface SnapshotResult {
  locations: number;
  snapped: number;
  cells: number;
  errors: number;
}

// GeoJSON types (RFC 7946)
interface GeoJSONGeometry {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  metadata?: Record<string, unknown>;
}

export interface GeoHeatmapDashboard {
  totalSnaps: number;
  totalCells: number;
  oldestBucket: string | null;
  newestBucket: string | null;
  topZone: string | null;
  topCells: HistoricalHeatmapCell[];
  liveHeatmap: LiveHeatmap;
  zoneUtilization: ZoneHourCell[];
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function snapToGrid(v: number, step = 0.01): number {
  return Math.round(v / step) * step;
}

function currentDateBucket(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString();
}

// ── Snapshot ───────────────────────────────────────────────────────────────────

/**
 * Snapshot aller Lieferungen der letzten 2 Stunden (geliefert oder unterwegs)
 * nach 0.01°-Gitterzellen. Upsert in heatmap_snapshots.
 */
export async function snapshotCurrentDeliveries(locationId: string): Promise<{ cells: number }> {
  const svc = createServiceClient();
  const bucket = currentDateBucket();
  const now = new Date();
  const hourOfDay = now.getUTCHours();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0=Mo

  // Lade gelieferte Bestellungen der letzten 2h mit Koordinaten
  const { data: orders } = await svc
    .from('customer_orders')
    .select('kunde_lat, kunde_lng, delivery_zone')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'unterwegs'])
    .not('kunde_lat', 'is', null)
    .not('kunde_lng', 'is', null)
    .gte('created_at', new Date(Date.now() - 2 * 3600_000).toISOString())
    .limit(2000);

  if (!orders?.length) return { cells: 0 };

  // Aggregiere nach Gitterzelle
  const cellMap = new Map<
    string,
    { lat: number; lng: number; count: number; zone: string | null }
  >();

  for (const o of orders) {
    const lat = snapToGrid(o.kunde_lat as number);
    const lng = snapToGrid(o.kunde_lng as number);
    const key = `${lat},${lng}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      cellMap.set(key, {
        lat,
        lng,
        count: 1,
        zone: (o.delivery_zone as string | null) ?? null,
      });
    }
  }

  const rows = Array.from(cellMap.values()).map((c) => ({
    location_id: locationId,
    date_bucket: bucket,
    hour_of_day: hourOfDay,
    day_of_week: dayOfWeek,
    grid_lat: c.lat,
    grid_lng: c.lng,
    order_count: c.count,
    zone: c.zone,
  }));

  await svc
    .from('heatmap_snapshots')
    .upsert(rows, {
      onConflict: 'location_id,date_bucket,grid_lat,grid_lng',
      ignoreDuplicates: false,
    });

  return { cells: rows.length };
}

/**
 * Cron-Batch: Snapshot alle aktiven Locations.
 */
export async function snapshotAllLocations(): Promise<SnapshotResult> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, snapped: 0, cells: 0, errors: 0 };

  let snapped = 0;
  let totalCells = 0;
  let errors = 0;

  for (const loc of locations) {
    try {
      const result = await snapshotCurrentDeliveries(loc.id as string);
      snapped += 1;
      totalCells += result.cells;
    } catch {
      errors += 1;
    }
  }

  return { locations: locations.length, snapped, cells: totalCells, errors };
}

// ── Live Heatmap ────────────────────────────────────────────────────────────────

/**
 * Echtzeit-Heatmap: aktive Bestellungen + Online-Fahrer.
 */
export async function getLiveHeatmap(locationId: string): Promise<LiveHeatmap> {
  const svc = createServiceClient();

  const [ordersRes, driversRes] = await Promise.all([
    svc
      .from('customer_orders')
      .select('kunde_lat, kunde_lng, delivery_zone')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['offen', 'angenommen', 'zubereitung', 'bereit', 'unterwegs'])
      .not('kunde_lat', 'is', null)
      .not('kunde_lng', 'is', null)
      .limit(500),
    svc
      .from('mise_drivers')
      .select('id, name, current_lat, current_lng, status, zone')
      .eq('location_id', locationId)
      .in('status', ['online', 'active', 'returning'])
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)
      .limit(50),
  ]);

  // Aggregiere Bestellungen nach Gitterzellen
  const cellMap = new Map<string, HeatmapPoint>();
  for (const o of ordersRes.data ?? []) {
    const lat = snapToGrid(o.kunde_lat as number);
    const lng = snapToGrid(o.kunde_lng as number);
    const key = `${lat},${lng}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      cellMap.set(key, {
        lat,
        lng,
        weight: 1,
        zone: (o.delivery_zone as string | null) ?? null,
      });
    }
  }

  const driverPoints: LiveDriverPoint[] = (driversRes.data ?? []).map((d) => ({
    driverId: d.id as string,
    driverName: (d.name as string | null) ?? 'Fahrer',
    lat: d.current_lat as number,
    lng: d.current_lng as number,
    status: (d.status as string) ?? 'online',
    zone: (d.zone as string | null) ?? null,
  }));

  return {
    orderPoints: Array.from(cellMap.values()),
    driverPoints,
    totalActiveOrders: ordersRes.data?.length ?? 0,
    totalOnlineDrivers: driverPoints.length,
    snappedAt: new Date().toISOString(),
  };
}

// ── Historische Heatmap ────────────────────────────────────────────────────────

/**
 * Aggregierte historische Heatmap aus Snapshots (N Tage).
 */
export async function getHistoricalHeatmap(
  locationId: string,
  days = 30,
): Promise<HistoricalHeatmapCell[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await svc
    .from('heatmap_snapshots')
    .select('grid_lat, grid_lng, zone, order_count, date_bucket')
    .eq('location_id', locationId)
    .gte('date_bucket', since)
    .limit(10_000);

  if (!data?.length) return [];

  // Aggregiere clientseitig
  type CellAgg = {
    lat: number;
    lng: number;
    zone: string | null;
    totalOrders: number;
    buckets: Set<string>;
    peakCount: number;
  };

  const cellMap = new Map<string, CellAgg>();
  for (const row of data) {
    const key = `${row.grid_lat},${row.grid_lng}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.totalOrders += row.order_count as number;
      existing.buckets.add(row.date_bucket as string);
      if ((row.order_count as number) > existing.peakCount) {
        existing.peakCount = row.order_count as number;
      }
    } else {
      cellMap.set(key, {
        lat: row.grid_lat as number,
        lng: row.grid_lng as number,
        zone: (row.zone as string | null) ?? null,
        totalOrders: row.order_count as number,
        buckets: new Set([row.date_bucket as string]),
        peakCount: row.order_count as number,
      });
    }
  }

  return Array.from(cellMap.values())
    .map((c) => ({
      lat: c.lat,
      lng: c.lng,
      zone: c.zone,
      totalOrders: c.totalOrders,
      activeDays: c.buckets.size,
      avgPerSnap: Math.round((c.totalOrders / Math.max(1, c.buckets.size)) * 100) / 100,
      peakCount: c.peakCount,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);
}

// ── Zonen-Stunden-Auslastung ───────────────────────────────────────────────────

/**
 * Stündliche Zonen-Auslastung aus v_zone_hour_utilization (30 Tage).
 */
export async function getZoneHourlyUtilization(locationId: string): Promise<ZoneHourCell[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('v_zone_hour_utilization')
    .select('zone, hour_of_day, day_of_week, snap_count, total_orders, avg_orders_per_snap, peak_orders')
    .eq('location_id', locationId)
    .order('zone')
    .order('hour_of_day');

  return (data ?? []).map((r) => ({
    zone: r.zone as string,
    hourOfDay: r.hour_of_day as number,
    dayOfWeek: r.day_of_week as number,
    snapCount: r.snap_count as number,
    totalOrders: r.total_orders as number,
    avgPerSnap: r.avg_orders_per_snap as number,
    peakOrders: r.peak_orders as number,
  }));
}

// ── GeoJSON Export ─────────────────────────────────────────────────────────────

export interface GeoJSONExportOptions {
  days?: number;
  includeLive?: boolean;
  includeDrivers?: boolean;
}

/**
 * Exportiert Heatmap + optionale Live-Daten als RFC 7946 FeatureCollection.
 */
export async function exportGeoJSON(
  locationId: string,
  opts: GeoJSONExportOptions = {},
): Promise<GeoJSONFeatureCollection> {
  const { days = 30, includeLive = true, includeDrivers = false } = opts;

  const [historical, live] = await Promise.all([
    getHistoricalHeatmap(locationId, days),
    includeLive ? getLiveHeatmap(locationId) : null,
  ]);

  const features: GeoJSONFeature[] = [];

  // Historische Heatmap-Zellen
  for (const cell of historical) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
      properties: {
        type: 'historical_cell',
        zone: cell.zone,
        total_orders: cell.totalOrders,
        active_days: cell.activeDays,
        avg_per_snap: cell.avgPerSnap,
        peak_count: cell.peakCount,
      },
    });
  }

  // Live-Bestellpunkte
  if (live) {
    for (const point of live.orderPoints) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
        properties: {
          type: 'live_order',
          zone: point.zone,
          weight: point.weight,
        },
      });
    }

    // Fahrer-Positionen
    if (includeDrivers) {
      for (const driver of live.driverPoints) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [driver.lng, driver.lat] },
          properties: {
            type: 'live_driver',
            driver_id: driver.driverId,
            driver_name: driver.driverName,
            status: driver.status,
            zone: driver.zone,
          },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      location_id: locationId,
      generated_at: new Date().toISOString(),
      historical_days: days,
      include_live: includeLive,
      include_drivers: includeDrivers,
      feature_count: features.length,
    },
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<GeoHeatmapDashboard> {
  const svc = createServiceClient();

  const [statsRes, topCells, live, zoneUtil] = await Promise.all([
    svc
      .from('heatmap_snapshots')
      .select('date_bucket')
      .eq('location_id', locationId)
      .order('date_bucket', { ascending: false })
      .limit(1),
    getHistoricalHeatmap(locationId, 30),
    getLiveHeatmap(locationId),
    getZoneHourlyUtilization(locationId),
  ]);

  const { count: totalSnaps } = await svc
    .from('heatmap_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);

  const { count: totalCells } = await svc
    .from('heatmap_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('date_bucket', new Date(Date.now() - 30 * 86_400_000).toISOString());

  const newestBucket = statsRes.data?.[0]?.date_bucket as string | null ?? null;

  // Top-Zone per Gesamtbestellungen
  const zoneOrderMap = new Map<string, number>();
  for (const cell of topCells) {
    if (cell.zone) {
      zoneOrderMap.set(cell.zone, (zoneOrderMap.get(cell.zone) ?? 0) + cell.totalOrders);
    }
  }
  const topZone =
    zoneOrderMap.size > 0
      ? [...zoneOrderMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    totalSnaps: totalSnaps ?? 0,
    totalCells: totalCells ?? 0,
    oldestBucket: null,
    newestBucket,
    topZone,
    topCells: topCells.slice(0, 50),
    liveHeatmap: live,
    zoneUtilization: zoneUtil,
  };
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 60): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_heatmap_snapshots', {
    days_to_keep: daysToKeep,
  });
  return (data as number | null) ?? 0;
}
