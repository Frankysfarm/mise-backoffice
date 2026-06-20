/**
 * lib/delivery/tour-heatmap.ts — Phase 346
 *
 * Tour Heatmap Engine
 *
 * Aggregiert abgeschlossene Tour-Stops (customer_orders mit mise_batch_id)
 * in 0.01°-Gitter-Kacheln (~1 km) und erkennt unterversorgte Zonen.
 *
 * Öffentliche API:
 *   computeHeatmapForLocation(locationId) — Kacheln berechnen + in DB schreiben
 *   computeHeatmapAllLocations()           — Cron-Batch
 *   detectUnderservedZones(locationId)    — Unterversorgte Zonen ermitteln
 *   getHeatmapDashboard(locationId)       — Dashboard-Daten
 *   getHeatmapTiles(locationId, days)     — Rohe Kacheln für Kartendarstellung
 *   getUnderservedZones(locationId)       — Aktuelle Unterversorgungs-Liste
 *   pruneOldTiles(daysToKeep)            — Cleanup via SQL-Funktion
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface HeatmapConfig {
  lookbackDays: number;
  gridResolution: number;
  lateThresholdMin: number;
  underservedMinStops: number;
  underservedLateRatePct: number;
  enabled: boolean;
  lastComputed: string | null;
}

export interface HeatmapTile {
  gridLat: number;
  gridLng: number;
  dateBucket: string;
  tourCount: number;
  stopCount: number;
  avgDeliveryMin: number | null;
  lateStops: number;
  zoneLabel: string | null;
  lateRate: number | null;
}

export interface UnderservedZone {
  id: string;
  gridLat: number;
  gridLng: number;
  zoneLabel: string | null;
  avgDeliveryMin: number | null;
  stopCount: number;
  lateRate: number | null;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
}

export interface HeatmapSummary {
  tilesTotal: number;
  stopsCovered: number;
  underservedCount: number;
  underservedHigh: number;
  avgDeliveryMin: number | null;
  lateRateOverall: number | null;
  lastComputed: string | null;
}

export interface ComputeResult {
  locationId: string;
  tilesUpserted: number;
  ordersAnalyzed: number;
  underservedUpserted: number;
}

export interface HeatmapDashboard {
  config: HeatmapConfig;
  summary: HeatmapSummary;
  tiles: HeatmapTile[];
  underservedZones: UnderservedZone[];
  tilesByZone: Array<{ zone: string; stopCount: number; avgDeliveryMin: number | null; lateRate: number | null }>;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function snapToGrid(coord: number, resolution: number): number {
  return Math.round(coord / resolution) * resolution;
}

function roundToDecimals(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ── Config laden/speichern ────────────────────────────────────────────────────

export async function getConfig(locationId: string): Promise<HeatmapConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tour_heatmap_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      lookbackDays: 30,
      gridResolution: 0.010,
      lateThresholdMin: 45,
      underservedMinStops: 3,
      underservedLateRatePct: 40,
      enabled: true,
      lastComputed: null,
    };
  }

  return {
    lookbackDays: data.lookback_days as number,
    gridResolution: Number(data.grid_resolution),
    lateThresholdMin: data.late_threshold_min as number,
    underservedMinStops: data.underserved_min_stops as number,
    underservedLateRatePct: Number(data.underserved_late_rate_pct),
    enabled: data.enabled as boolean,
    lastComputed: data.last_computed as string | null,
  };
}

export async function upsertConfig(
  locationId: string,
  patch: Partial<Omit<HeatmapConfig, 'lastComputed'>>,
): Promise<void> {
  const sb = createServiceClient();
  await sb.from('tour_heatmap_config').upsert(
    {
      location_id: locationId,
      ...(patch.lookbackDays !== undefined && { lookback_days: patch.lookbackDays }),
      ...(patch.gridResolution !== undefined && { grid_resolution: patch.gridResolution }),
      ...(patch.lateThresholdMin !== undefined && { late_threshold_min: patch.lateThresholdMin }),
      ...(patch.underservedMinStops !== undefined && { underserved_min_stops: patch.underservedMinStops }),
      ...(patch.underservedLateRatePct !== undefined && { underserved_late_rate_pct: patch.underservedLateRatePct }),
      ...(patch.enabled !== undefined && { enabled: patch.enabled }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'location_id' },
  );
}

// ── Heatmap-Berechnung ────────────────────────────────────────────────────────

export async function computeHeatmapForLocation(locationId: string): Promise<ComputeResult> {
  const sb = createServiceClient();
  const config = await getConfig(locationId);

  if (!config.enabled) {
    return { locationId, tilesUpserted: 0, ordersAnalyzed: 0, underservedUpserted: 0 };
  }

  const since = new Date();
  since.setDate(since.getDate() - config.lookbackDays);

  // Abgeschlossene Lieferungen mit Koordinaten aus customer_orders + mise_batches
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, kunde_lat, kunde_lng, delivery_zone, fertig_am, created_at, mise_batch_id')
    .eq('location_id', locationId)
    .eq('status', 'delivered')
    .not('mise_batch_id', 'is', null)
    .not('kunde_lat', 'is', null)
    .not('kunde_lng', 'is', null)
    .gte('fertig_am', since.toISOString())
    .limit(5000);

  if (!orders || orders.length === 0) {
    return { locationId, tilesUpserted: 0, ordersAnalyzed: 0, underservedUpserted: 0 };
  }

  const res = config.gridResolution;
  const lateMins = config.lateThresholdMin;

  // Gruppiere nach Gitter-Kachel + Datum
  interface TileAcc {
    tours: Set<string>;
    stops: number;
    lateStops: number;
    deliveryMins: number[];
    zone: string | null;
  }
  const tileMap = new Map<string, TileAcc>();

  for (const o of orders) {
    const lat = roundToDecimals(snapToGrid(o.kunde_lat as number, res), 3);
    const lng = roundToDecimals(snapToGrid(o.kunde_lng as number, res), 3);
    const bucket = (o.fertig_am as string).slice(0, 10);
    const key = `${lat}|${lng}|${bucket}`;

    let acc = tileMap.get(key);
    if (!acc) {
      acc = { tours: new Set(), stops: 0, lateStops: 0, deliveryMins: [], zone: null };
      tileMap.set(key, acc);
    }

    acc.tours.add(o.mise_batch_id as string);
    acc.stops += 1;
    if (o.delivery_zone) acc.zone = o.delivery_zone as string;

    if (o.fertig_am && o.created_at) {
      const diffMin = (new Date(o.fertig_am as string).getTime() - new Date(o.created_at as string).getTime()) / 60000;
      if (diffMin > 0 && diffMin < 300) {
        acc.deliveryMins.push(diffMin);
        if (diffMin > lateMins) acc.lateStops += 1;
      }
    }
  }

  // Upsert Kacheln
  const rows = Array.from(tileMap.entries()).map(([key, acc]) => {
    const [lat, lng, bucket] = key.split('|');
    const avgMin = acc.deliveryMins.length > 0
      ? acc.deliveryMins.reduce((s, v) => s + v, 0) / acc.deliveryMins.length
      : null;
    return {
      location_id: locationId,
      grid_lat: parseFloat(lat),
      grid_lng: parseFloat(lng),
      date_bucket: bucket,
      tour_count: acc.tours.size,
      stop_count: acc.stops,
      avg_delivery_min: avgMin != null ? Math.round(avgMin * 10) / 10 : null,
      late_stops: acc.lateStops,
      zone_label: acc.zone,
    };
  });

  let tilesUpserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from('tour_heatmap_tiles')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'location_id,grid_lat,grid_lng,date_bucket' });
    if (!error) tilesUpserted += Math.min(CHUNK, rows.length - i);
  }

  // Unterversorgte Zonen erkennen
  const underservedCount = await detectUnderservedZones(locationId, config);

  // Config last_computed aktualisieren
  await sb
    .from('tour_heatmap_config')
    .upsert(
      { location_id: locationId, last_computed: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'location_id' },
    );

  return {
    locationId,
    tilesUpserted,
    ordersAnalyzed: orders.length,
    underservedUpserted: underservedCount,
  };
}

export async function detectUnderservedZones(
  locationId: string,
  config?: HeatmapConfig,
): Promise<number> {
  const sb = createServiceClient();
  const cfg = config ?? (await getConfig(locationId));

  const since = new Date();
  since.setDate(since.getDate() - cfg.lookbackDays);

  // Aggregiere Kacheln über lookback-Zeitraum
  const { data: tiles } = await sb
    .from('tour_heatmap_tiles')
    .select('grid_lat, grid_lng, zone_label, stop_count, late_stops, avg_delivery_min')
    .eq('location_id', locationId)
    .gte('date_bucket', since.toISOString().slice(0, 10));

  if (!tiles || tiles.length === 0) return 0;

  // Aggregiere pro Zelle über alle Tage
  interface CellAcc {
    stops: number;
    lateStops: number;
    deliveryMins: number[];
    zone: string | null;
  }
  const cellMap = new Map<string, CellAcc>();

  for (const t of tiles) {
    const key = `${t.grid_lat}|${t.grid_lng}`;
    let acc = cellMap.get(key);
    if (!acc) {
      acc = { stops: 0, lateStops: 0, deliveryMins: [], zone: null };
      cellMap.set(key, acc);
    }
    acc.stops += t.stop_count as number;
    acc.lateStops += t.late_stops as number;
    if (t.zone_label) acc.zone = t.zone_label as string;
    if (t.avg_delivery_min != null) acc.deliveryMins.push(Number(t.avg_delivery_min));
  }

  // Gesamt-Ø Lieferzeit als Benchmark
  const allMins = Array.from(cellMap.values()).flatMap((c) => c.deliveryMins);
  const globalAvg = allMins.length > 0 ? allMins.reduce((s, v) => s + v, 0) / allMins.length : null;

  const rows: Array<{
    location_id: string;
    grid_lat: number;
    grid_lng: number;
    zone_label: string | null;
    avg_delivery_min: number | null;
    stop_count: number;
    late_rate: number | null;
    severity: 'low' | 'medium' | 'high';
    detected_at: string;
    updated_at: string;
  }> = [];

  for (const [key, acc] of cellMap.entries()) {
    if (acc.stops < cfg.underservedMinStops) continue;
    const lateRate = acc.stops > 0 ? (acc.lateStops / acc.stops) * 100 : 0;
    if (lateRate < cfg.underservedLateRatePct) continue;

    const avgMin = acc.deliveryMins.length > 0
      ? acc.deliveryMins.reduce((s, v) => s + v, 0) / acc.deliveryMins.length
      : null;

    let severity: 'low' | 'medium' | 'high' = 'low';
    if (lateRate >= 70) severity = 'high';
    else if (lateRate >= 55) severity = 'medium';

    // Prüfe ob deutlich über Gesamt-Ø
    if (globalAvg != null && avgMin != null && avgMin > globalAvg * 1.3) {
      if (severity === 'low') severity = 'medium';
    }

    const [lat, lng] = key.split('|').map(Number);
    rows.push({
      location_id: locationId,
      grid_lat: lat,
      grid_lng: lng,
      zone_label: acc.zone,
      avg_delivery_min: avgMin != null ? Math.round(avgMin * 10) / 10 : null,
      stop_count: acc.stops,
      late_rate: Math.round(lateRate * 10) / 10,
      severity,
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return 0;

  await sb
    .from('tour_heatmap_underserved')
    .upsert(rows, { onConflict: 'location_id,grid_lat,grid_lng' });

  // Alte Einträge entfernen die jetzt nicht mehr auffällig sind
  const activeKeys = new Set(rows.map((r) => `${r.grid_lat}|${r.grid_lng}`));
  const { data: existing } = await sb
    .from('tour_heatmap_underserved')
    .select('id, grid_lat, grid_lng')
    .eq('location_id', locationId);

  const toDelete = (existing ?? [])
    .filter((e) => !activeKeys.has(`${e.grid_lat}|${e.grid_lng}`))
    .map((e) => e.id as string);

  if (toDelete.length > 0) {
    await sb.from('tour_heatmap_underserved').delete().in('id', toDelete);
  }

  return rows.length;
}

// ── Cron-Batch ────────────────────────────────────────────────────────────────

export interface BatchResult {
  locations: number;
  tilesUpserted: number;
  ordersAnalyzed: number;
  underservedUpserted: number;
  errors: number;
}

export async function computeHeatmapAllLocations(): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(20);

  const result: BatchResult = { locations: 0, tilesUpserted: 0, ordersAnalyzed: 0, underservedUpserted: 0, errors: 0 };

  for (const loc of locs ?? []) {
    try {
      const r = await computeHeatmapForLocation(loc.id as string);
      result.locations += 1;
      result.tilesUpserted += r.tilesUpserted;
      result.ordersAnalyzed += r.ordersAnalyzed;
      result.underservedUpserted += r.underservedUpserted;
    } catch {
      result.errors += 1;
    }
  }

  return result;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getHeatmapDashboard(locationId: string): Promise<HeatmapDashboard> {
  const sb = createServiceClient();

  const [config, tilesRaw, underservedRaw] = await Promise.all([
    getConfig(locationId),
    sb
      .from('tour_heatmap_tiles')
      .select('grid_lat, grid_lng, date_bucket, tour_count, stop_count, avg_delivery_min, late_stops, zone_label')
      .eq('location_id', locationId)
      .gte('date_bucket', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
      .order('date_bucket', { ascending: false })
      .limit(1000),
    sb
      .from('tour_heatmap_underserved')
      .select('id, grid_lat, grid_lng, zone_label, avg_delivery_min, stop_count, late_rate, severity, detected_at')
      .eq('location_id', locationId)
      .order('severity', { ascending: false })
      .limit(50),
  ]);

  const tiles: HeatmapTile[] = (tilesRaw.data ?? []).map((t) => ({
    gridLat: Number(t.grid_lat),
    gridLng: Number(t.grid_lng),
    dateBucket: t.date_bucket as string,
    tourCount: t.tour_count as number,
    stopCount: t.stop_count as number,
    avgDeliveryMin: t.avg_delivery_min != null ? Number(t.avg_delivery_min) : null,
    lateStops: t.late_stops as number,
    zoneLabel: t.zone_label as string | null,
    lateRate: t.stop_count > 0 ? Math.round((t.late_stops as number) / (t.stop_count as number) * 1000) / 10 : null,
  }));

  const underservedZones: UnderservedZone[] = (underservedRaw.data ?? []).map((u) => ({
    id: u.id as string,
    gridLat: Number(u.grid_lat),
    gridLng: Number(u.grid_lng),
    zoneLabel: u.zone_label as string | null,
    avgDeliveryMin: u.avg_delivery_min != null ? Number(u.avg_delivery_min) : null,
    stopCount: u.stop_count as number,
    lateRate: u.late_rate != null ? Number(u.late_rate) : null,
    severity: u.severity as 'low' | 'medium' | 'high',
    detectedAt: u.detected_at as string,
  }));

  // Summary
  const totalStops = tiles.reduce((s, t) => s + t.stopCount, 0);
  const totalLate = tiles.reduce((s, t) => s + t.lateStops, 0);
  const allMins = tiles.filter((t) => t.avgDeliveryMin != null).map((t) => t.avgDeliveryMin as number);
  const avgDeliveryMin = allMins.length > 0 ? Math.round(allMins.reduce((s, v) => s + v, 0) / allMins.length) : null;
  const lateRate = totalStops > 0 ? Math.round((totalLate / totalStops) * 1000) / 10 : null;

  // Aggregiere nach Zone
  const zoneMap = new Map<string, { stops: number; lateStops: number; mins: number[] }>();
  for (const t of tiles) {
    const z = t.zoneLabel ?? 'Unbekannt';
    let acc = zoneMap.get(z);
    if (!acc) { acc = { stops: 0, lateStops: 0, mins: [] }; zoneMap.set(z, acc); }
    acc.stops += t.stopCount;
    acc.lateStops += t.lateStops;
    if (t.avgDeliveryMin != null) acc.mins.push(t.avgDeliveryMin);
  }
  const tilesByZone = Array.from(zoneMap.entries()).map(([zone, acc]) => ({
    zone,
    stopCount: acc.stops,
    avgDeliveryMin: acc.mins.length > 0 ? Math.round(acc.mins.reduce((s, v) => s + v, 0) / acc.mins.length) : null,
    lateRate: acc.stops > 0 ? Math.round((acc.lateStops / acc.stops) * 1000) / 10 : null,
  })).sort((a, b) => b.stopCount - a.stopCount);

  const uniqueTiles = new Set(tiles.map((t) => `${t.gridLat}|${t.gridLng}`)).size;

  const summary: HeatmapSummary = {
    tilesTotal: uniqueTiles,
    stopsCovered: totalStops,
    underservedCount: underservedZones.length,
    underservedHigh: underservedZones.filter((u) => u.severity === 'high').length,
    avgDeliveryMin,
    lateRateOverall: lateRate,
    lastComputed: config.lastComputed,
  };

  return { config, summary, tiles, underservedZones, tilesByZone };
}

export async function getHeatmapTiles(locationId: string, days = 7): Promise<HeatmapTile[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data } = await sb
    .from('tour_heatmap_tiles')
    .select('grid_lat, grid_lng, date_bucket, tour_count, stop_count, avg_delivery_min, late_stops, zone_label')
    .eq('location_id', locationId)
    .gte('date_bucket', since)
    .order('stop_count', { ascending: false })
    .limit(500);

  return (data ?? []).map((t) => ({
    gridLat: Number(t.grid_lat),
    gridLng: Number(t.grid_lng),
    dateBucket: t.date_bucket as string,
    tourCount: t.tour_count as number,
    stopCount: t.stop_count as number,
    avgDeliveryMin: t.avg_delivery_min != null ? Number(t.avg_delivery_min) : null,
    lateStops: t.late_stops as number,
    zoneLabel: t.zone_label as string | null,
    lateRate: t.stop_count > 0 ? Math.round((t.late_stops as number) / (t.stop_count as number) * 1000) / 10 : null,
  }));
}

export async function getUnderservedZones(locationId: string): Promise<UnderservedZone[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tour_heatmap_underserved')
    .select('id, grid_lat, grid_lng, zone_label, avg_delivery_min, stop_count, late_rate, severity, detected_at')
    .eq('location_id', locationId)
    .order('severity', { ascending: false })
    .limit(50);

  return (data ?? []).map((u) => ({
    id: u.id as string,
    gridLat: Number(u.grid_lat),
    gridLng: Number(u.grid_lng),
    zoneLabel: u.zone_label as string | null,
    avgDeliveryMin: u.avg_delivery_min != null ? Number(u.avg_delivery_min) : null,
    stopCount: u.stop_count as number,
    lateRate: u.late_rate != null ? Number(u.late_rate) : null,
    severity: u.severity as 'low' | 'medium' | 'high',
    detectedAt: u.detected_at as string,
  }));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldTiles(daysToKeep = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_tour_heatmap_tiles', { days_old: daysToKeep });
  return (data as number | null) ?? 0;
}
