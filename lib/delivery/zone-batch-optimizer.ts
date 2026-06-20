/**
 * lib/delivery/zone-batch-optimizer.ts — Phase 349
 *
 * Zone-based Multi-Stop Batch Optimizer V2
 *
 * Findet automatisch Bestellungen, die sich für gemeinsame Liefertouren eignen,
 * berechnet Haversine-Routeneinsparungen und schlägt optimierte Batches vor.
 *
 * Öffentliche API:
 *   getConfig(locationId)                — Konfiguration laden
 *   upsertConfig(locationId, input)      — Konfiguration speichern
 *   generateBatchSuggestions(locationId) — Haupt-Engine: scan → cluster → score → upsert
 *   generateAllLocations()               — Cron-Batch
 *   applyBatchSuggestion(id, empId?)     — Vorschlag annehmen
 *   rejectBatchSuggestion(id, empId?)    — Vorschlag ablehnen
 *   expireStaleSuggestions(locationId)   — Veraltete als 'expired' markieren
 *   getDashboard(locationId)             — KPIs + Pending + Verlauf
 *   pruneOldSuggestions(daysToKeep?)     — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ZoneBatchConfig {
  id: string;
  locationId: string;
  isEnabled: boolean;
  maxStops: number;
  maxRadiusKm: number;
  autoApplyMinScore: number;
  minKmSavingsPct: number;
  scanIntervalMin: number;
}

export interface BatchStopCandidate {
  orderId: string;
  lat: number;
  lng: number;
  address: string | null;
  gesamtbetrag: number;
  eta_latest: string | null;
}

export interface ZoneBatchSuggestion {
  id: string;
  locationId: string;
  stops: BatchStopCandidate[];
  totalOrders: number;
  routeKm: number;
  individualKm: number;
  kmSavings: number;
  kmSavingsPct: number;
  score: number;
  status: 'pending' | 'applied' | 'rejected' | 'expired' | 'auto_applied';
  driverId: string | null;
  batchId: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ZoneBatchDashboard {
  locationId: string;
  config: ZoneBatchConfig;
  stats: {
    pendingCount: number;
    appliedToday: number;
    autoAppliedToday: number;
    rejectedToday: number;
    expiredToday: number;
    avgKmSavingsPct: number | null;
    avgScore: number | null;
    totalKmSaved: number;
  };
  pendingSuggestions: ZoneBatchSuggestion[];
  recentHistory: ZoneBatchSuggestion[];
}

// ── Interne Helpers ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<ZoneBatchConfig, 'id' | 'locationId'> = {
  isEnabled: true,
  maxStops: 3,
  maxRadiusKm: 2.5,
  autoApplyMinScore: 85,
  minKmSavingsPct: 15.0,
  scanIntervalMin: 3,
};

function dbToConfig(row: Record<string, unknown>): ZoneBatchConfig {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    isEnabled: row.is_enabled as boolean,
    maxStops: row.max_stops as number,
    maxRadiusKm: Number(row.max_radius_km),
    autoApplyMinScore: row.auto_apply_min_score as number,
    minKmSavingsPct: Number(row.min_km_savings_pct),
    scanIntervalMin: row.scan_interval_min as number,
  };
}

function dbToSuggestion(row: Record<string, unknown>): ZoneBatchSuggestion {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    stops: (row.stops as BatchStopCandidate[]) ?? [],
    totalOrders: row.total_orders as number,
    routeKm: Number(row.route_km),
    individualKm: Number(row.individual_km),
    kmSavings: Number(row.km_savings),
    kmSavingsPct: Number(row.km_savings_pct),
    score: row.score as number,
    status: row.status as ZoneBatchSuggestion['status'],
    driverId: (row.driver_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    resolvedBy: (row.resolved_by as string | null) ?? null,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
  };
}

/**
 * Greedy nearest-neighbour route distance from a virtual depot at centroid.
 * Returns total km for visiting all stops.
 */
function greedyRouteKm(stops: BatchStopCandidate[]): number {
  if (stops.length === 0) return 0;
  if (stops.length === 1) return 0;

  // Start from centroid (approximates kitchen/pickup point)
  const centLat = stops.reduce((s, o) => s + o.lat, 0) / stops.length;
  const centLng = stops.reduce((s, o) => s + o.lng, 0) / stops.length;

  let totalKm = 0;
  let curLat = centLat;
  let curLng = centLng;
  const remaining = [...stops];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    totalKm += bestDist;
    const next = remaining.splice(bestIdx, 1)[0];
    curLat = next.lat;
    curLng = next.lng;
  }
  return totalKm;
}

/** Sum of individual delivery distances (from centroid to each stop independently). */
function individualTotalKm(stops: BatchStopCandidate[]): number {
  if (stops.length === 0) return 0;
  const centLat = stops.reduce((s, o) => s + o.lat, 0) / stops.length;
  const centLng = stops.reduce((s, o) => s + o.lng, 0) / stops.length;
  return stops.reduce((sum, stop) => sum + haversineKm(centLat, centLng, stop.lat, stop.lng), 0);
}

/**
 * Score a batch candidate (0–100):
 * - km savings rate: up to 40 pts  (pct/1.5, capped at 40)
 * - stop count bonus: 3+ = 25 pts, 2 = 10 pts
 * - clustering tightness: radius of cluster ≤ 1 km = 20 pts, ≤ 2 km = 10 pts
 * - ETA headroom: all stops have eta_latest > now+35min = 15 pts
 */
function scoreBatch(stops: BatchStopCandidate[], routeKm: number, indivKm: number): number {
  const savingsPct = indivKm > 0 ? ((indivKm - routeKm) / indivKm) * 100 : 0;
  let score = 0;

  // km savings contribution (0-40)
  score += Math.min(40, Math.max(0, Math.round(savingsPct / 1.5)));

  // stop count (0-25)
  score += stops.length >= 3 ? 25 : 10;

  // cluster tightness: max pairwise distance (0-20)
  let maxPairKm = 0;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const d = haversineKm(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng);
      if (d > maxPairKm) maxPairKm = d;
    }
  }
  if (maxPairKm <= 1.0) score += 20;
  else if (maxPairKm <= 2.0) score += 10;
  else score += 5;

  // ETA headroom (0-15)
  const nowMs = Date.now();
  const allHaveHeadroom = stops.every((s) => {
    if (!s.eta_latest) return false;
    return new Date(s.eta_latest).getTime() - nowMs > 35 * 60 * 1000;
  });
  if (allHaveHeadroom) score += 15;

  return Math.min(100, Math.max(0, score));
}

// ── Öffentliche API ────────────────────────────────────────────────────────────

export async function getConfig(locationId: string): Promise<ZoneBatchConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('zone_batch_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      id: '',
      locationId,
      ...DEFAULT_CONFIG,
    };
  }
  return dbToConfig(data as Record<string, unknown>);
}

export async function upsertConfig(
  locationId: string,
  input: Partial<Omit<ZoneBatchConfig, 'id' | 'locationId'>>,
): Promise<ZoneBatchConfig> {
  const sb = createServiceClient();
  const payload: Record<string, unknown> = { location_id: locationId };
  if (input.isEnabled !== undefined) payload.is_enabled = input.isEnabled;
  if (input.maxStops !== undefined) payload.max_stops = Math.min(6, Math.max(2, input.maxStops));
  if (input.maxRadiusKm !== undefined) payload.max_radius_km = Math.max(0.5, input.maxRadiusKm);
  if (input.autoApplyMinScore !== undefined) payload.auto_apply_min_score = Math.min(100, Math.max(50, input.autoApplyMinScore));
  if (input.minKmSavingsPct !== undefined) payload.min_km_savings_pct = Math.max(0, input.minKmSavingsPct);
  if (input.scanIntervalMin !== undefined) payload.scan_interval_min = Math.max(1, input.scanIntervalMin);

  const { data } = await sb
    .from('zone_batch_config')
    .upsert(payload, { onConflict: 'location_id' })
    .select('*')
    .single();

  return dbToConfig(data as Record<string, unknown>);
}

/** Pending unassigned orders with customer coordinates for this location. */
async function scanPendingOrders(locationId: string): Promise<BatchStopCandidate[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_orders')
    .select('id, kunde_lat, kunde_lng, lieferadresse, gesamtbetrag, eta_latest')
    .eq('location_id', locationId)
    .eq('status', 'bereit_zur_lieferung')
    .is('mise_batch_id', null)
    .not('kunde_lat', 'is', null)
    .not('kunde_lng', 'is', null)
    .limit(50);

  return (data ?? []).map((row) => ({
    orderId: row.id as string,
    lat: Number(row.kunde_lat),
    lng: Number(row.kunde_lng),
    address: (row.lieferadresse as string | null) ?? null,
    gesamtbetrag: Number(row.gesamtbetrag ?? 0),
    eta_latest: (row.eta_latest as string | null) ?? null,
  }));
}

/** Greedy zone-based clustering: returns candidate groups. */
function clusterOrders(
  orders: BatchStopCandidate[],
  maxRadiusKm: number,
  maxStops: number,
): BatchStopCandidate[][] {
  if (orders.length < 2) return [];

  const clusters: BatchStopCandidate[][] = [];
  const used = new Set<string>();

  for (const seed of orders) {
    if (used.has(seed.orderId)) continue;

    // Find neighbours within maxRadiusKm
    const neighbours: BatchStopCandidate[] = [];
    for (const other of orders) {
      if (other.orderId === seed.orderId) continue;
      if (used.has(other.orderId)) continue;
      if (haversineKm(seed.lat, seed.lng, other.lat, other.lng) <= maxRadiusKm) {
        neighbours.push(other);
      }
    }

    if (neighbours.length === 0) continue;

    // Build cluster: seed + up to (maxStops-1) closest neighbours
    neighbours.sort(
      (a, b) =>
        haversineKm(seed.lat, seed.lng, a.lat, a.lng) -
        haversineKm(seed.lat, seed.lng, b.lat, b.lng),
    );
    const cluster = [seed, ...neighbours.slice(0, maxStops - 1)];
    clusters.push(cluster);
    cluster.forEach((o) => used.add(o.orderId));
  }

  return clusters;
}

/**
 * Core engine: scan pending orders → cluster → score → upsert suggestions.
 * Returns count of new suggestions created.
 */
export async function generateBatchSuggestions(locationId: string): Promise<{
  ordersScanned: number;
  clustersFound: number;
  suggestionsCreated: number;
  autoApplied: number;
}> {
  const cfg = await getConfig(locationId);
  if (!cfg.isEnabled) return { ordersScanned: 0, clustersFound: 0, suggestionsCreated: 0, autoApplied: 0 };

  const orders = await scanPendingOrders(locationId);
  if (orders.length < 2) return { ordersScanned: orders.length, clustersFound: 0, suggestionsCreated: 0, autoApplied: 0 };

  // Expire stale pending suggestions first
  await expireStaleSuggestions(locationId);

  const clusters = clusterOrders(orders, cfg.maxRadiusKm, cfg.maxStops);
  if (clusters.length === 0) return { ordersScanned: orders.length, clustersFound: 0, suggestionsCreated: 0, autoApplied: 0 };

  const sb = createServiceClient();
  let suggestionsCreated = 0;
  let autoApplied = 0;

  for (const cluster of clusters) {
    const routeKm = greedyRouteKm(cluster);
    const indivKm = individualTotalKm(cluster);
    const kmSavings = Math.max(0, indivKm - routeKm);
    const kmSavingsPct = indivKm > 0 ? (kmSavings / indivKm) * 100 : 0;
    const score = scoreBatch(cluster, routeKm, indivKm);

    if (kmSavingsPct < cfg.minKmSavingsPct) continue;
    if (score < 50) continue;

    const orderIds = cluster.map((s) => s.orderId);
    const status: ZoneBatchSuggestion['status'] =
      score >= cfg.autoApplyMinScore ? 'auto_applied' : 'pending';

    // Dedup: skip if any of these orders already in a pending suggestion
    const { count } = await sb
      .from('zone_batch_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .overlaps('stops', orderIds.map((id) => ({ orderId: id })));

    // Simple dedup: check order IDs in stops JSONB
    const { data: existing } = await sb
      .from('zone_batch_suggestions')
      .select('id, stops')
      .eq('location_id', locationId)
      .in('status', ['pending', 'auto_applied'])
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    const alreadyQueued = (existing ?? []).some((s) => {
      const existingIds = ((s.stops as BatchStopCandidate[]) ?? []).map((x) => x.orderId);
      return orderIds.some((id) => existingIds.includes(id));
    });

    if (alreadyQueued) continue;
    void count; // suppress unused warning

    const resolvedAt = status === 'auto_applied' ? new Date().toISOString() : null;
    await sb.from('zone_batch_suggestions').insert({
      location_id: locationId,
      stops: cluster,
      total_orders: cluster.length,
      route_km: Number(routeKm.toFixed(3)),
      individual_km: Number(indivKm.toFixed(3)),
      km_savings: Number(kmSavings.toFixed(3)),
      km_savings_pct: Number(kmSavingsPct.toFixed(2)),
      score,
      status,
      resolved_at: resolvedAt,
    });

    suggestionsCreated++;
    if (status === 'auto_applied') autoApplied++;
  }

  return {
    ordersScanned: orders.length,
    clustersFound: clusters.length,
    suggestionsCreated,
    autoApplied,
  };
}

export async function generateAllLocations(): Promise<{
  locations: number;
  ordersScanned: number;
  suggestionsCreated: number;
  autoApplied: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  let locations = 0, ordersScanned = 0, suggestionsCreated = 0, autoApplied = 0, errors = 0;

  await Promise.all(
    (locs ?? []).map(async (loc) => {
      try {
        const r = await generateBatchSuggestions(loc.id as string);
        locations++;
        ordersScanned += r.ordersScanned;
        suggestionsCreated += r.suggestionsCreated;
        autoApplied += r.autoApplied;
      } catch {
        errors++;
      }
    }),
  );

  return { locations, ordersScanned, suggestionsCreated, autoApplied, errors };
}

export async function applyBatchSuggestion(
  suggestionId: string,
  employeeId?: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  await sb
    .from('zone_batch_suggestions')
    .update({
      status: 'applied',
      resolved_by: employeeId ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('status', 'pending');
  return { ok: true };
}

export async function rejectBatchSuggestion(
  suggestionId: string,
  employeeId?: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  await sb
    .from('zone_batch_suggestions')
    .update({
      status: 'rejected',
      resolved_by: employeeId ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('status', 'pending');
  return { ok: true };
}

export async function expireStaleSuggestions(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('zone_batch_suggestions')
    .update({ status: 'expired', resolved_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id');
  return (data ?? []).length;
}

export async function getDashboard(locationId: string): Promise<ZoneBatchDashboard> {
  const sb = createServiceClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [cfg, pendingRows, historyRows] = await Promise.all([
    getConfig(locationId),
    sb
      .from('zone_batch_suggestions')
      .select('*')
      .eq('location_id', locationId)
      .in('status', ['pending', 'auto_applied'])
      .order('score', { ascending: false })
      .limit(20),
    sb
      .from('zone_batch_suggestions')
      .select('*')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .not('status', 'in', '(pending,auto_applied)')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const today = (historyRows.data ?? []).map((r) => dbToSuggestion(r as Record<string, unknown>));
  const pending = (pendingRows.data ?? []).map((r) => dbToSuggestion(r as Record<string, unknown>));

  const appliedToday = today.filter((s) => s.status === 'applied').length;
  const autoAppliedToday = today.filter((s) => s.status === 'auto_applied').length;
  const rejectedToday = today.filter((s) => s.status === 'rejected').length;
  const expiredToday = today.filter((s) => s.status === 'expired').length;

  const { count: pendingCount } = await sb
    .from('zone_batch_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['pending', 'auto_applied']);

  const resolved = today.filter((s) => s.status === 'applied' || s.status === 'auto_applied');
  const avgKmSavingsPct =
    resolved.length > 0
      ? resolved.reduce((sum, s) => sum + s.kmSavingsPct, 0) / resolved.length
      : null;
  const avgScore =
    today.length > 0 ? today.reduce((sum, s) => sum + s.score, 0) / today.length : null;
  const totalKmSaved = resolved.reduce((sum, s) => sum + s.kmSavings, 0);

  return {
    locationId,
    config: cfg,
    stats: {
      pendingCount: pendingCount ?? 0,
      appliedToday,
      autoAppliedToday,
      rejectedToday,
      expiredToday,
      avgKmSavingsPct,
      avgScore,
      totalKmSaved,
    },
    pendingSuggestions: pending,
    recentHistory: today,
  };
}

export async function pruneOldSuggestions(
  daysToKeep = 30,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_zone_batch_suggestions', { days_old: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
