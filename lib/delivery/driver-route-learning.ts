/**
 * lib/delivery/driver-route-learning.ts — Phase 231
 *
 * Smart Driver Route Learning Engine
 *
 * Learns from every completed delivery stop which drivers perform best
 * in which postal code (PLZ) areas. Builds per-driver proficiency profiles
 * used to recommend the optimal driver for incoming orders.
 *
 * Proficiency score (0–100):
 *   speed_score  (50%): avg_delivery_min vs. PLZ population average
 *                       sub-avg → 100, 2× avg → 0
 *   ontime_score (30%): on_time_rate × 100
 *   experience   (20%): log-scale stop count (20 stops → 100)
 *
 * Cron: buildAllLocations() täglich 03:45 UTC
 *       pruneOldObservations(120) täglich isReportTick
 *
 * Public API:
 *   recordTourObservations(locationId, batchId)     → { recorded, skipped }
 *   buildRouteProfiles(locationId)                  → { profiles_upserted, errors }
 *   buildAllLocations()                             → batch result
 *   getDriverRouteSuggestion(locationId, plzList)   → DriverSuggestion[]
 *   getRouteLearningDashboard(locationId)           → RouteLearningDashboard
 *   pruneOldObservations(daysToKeep)                → { pruned }
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteObservation {
  id: string;
  locationId: string;
  driverId: string;
  batchId: string;
  orderId: string | null;
  plz: string;
  deliveryZone: string | null;
  lat: number | null;
  lng: number | null;
  observedAt: string;
  deliveryMin: number | null;
  onTime: boolean | null;
}

export interface RouteProfile {
  id: string;
  locationId: string;
  driverId: string;
  plz: string;
  stopCount: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  proficiencyScore: number;
  lastDeliveryAt: string | null;
  updatedAt: string;
}

export interface RouteProfileWithDriver extends RouteProfile {
  driverName: string | null;
  vehicleType: string | null;
}

export interface DriverSuggestion {
  driverId: string;
  driverName: string | null;
  avgProficiencyScore: number;
  avgDeliveryMin: number | null;
  coveragePct: number;  // % of requested PLZs with a profile
  bestPlz: string | null;
}

export interface PlzStats {
  plz: string;
  deliveryZone: string | null;
  totalStops: number;
  avgDeliveryMin: number | null;
  activeDrivers: number;
  bestDriverId: string | null;
  bestDriverName: string | null;
  bestScore: number;
}

export interface RouteLearningDashboard {
  stats: {
    totalObservations: number;
    totalProfiles: number;
    activeDrivers: number;
    coveredPlzs: number;
    avgProficiencyScore: number | null;
    observationsLast7d: number;
    lastRebuildAt: string | null;
  };
  topProfiles: RouteProfileWithDriver[];
  plzStats: PlzStats[];
  driverSummary: Array<{
    driverId: string;
    driverName: string | null;
    profileCount: number;
    avgScore: number;
    bestPlz: string | null;
    totalStops: number;
  }>;
}

export interface RecordResult {
  recorded: number;
  skipped: number;
  batchId: string;
}

export interface BuildResult {
  locationId: string;
  profilesUpserted: number;
  errors: number;
}

export interface BuildAllResult {
  locations: number;
  profilesUpserted: number;
  errors: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeProficiencyScore(
  avgDeliveryMin: number | null,
  onTimeRate: number | null,
  stopCount: number,
  plzAvgMin: number | null,
): number {
  // speed_score (50%): compare driver avg to PLZ population avg
  let speedScore = 50; // neutral when no benchmark
  if (avgDeliveryMin !== null && plzAvgMin !== null && plzAvgMin > 0) {
    // ratio < 1 → faster than avg → higher score
    const ratio = avgDeliveryMin / plzAvgMin;
    // ratio 0.5 → 100, ratio 1.0 → 75, ratio 2.0 → 0
    speedScore = clamp(Math.round((2 - ratio) * 75));
  }

  // ontime_score (30%): on-time delivery rate
  const ontimeScore = onTimeRate !== null ? clamp(Math.round(onTimeRate * 100)) : 50;

  // experience (20%): log-scale, 1 stop → ~0, 20 stops → ~100
  const expScore = clamp(Math.round((Math.log(stopCount + 1) / Math.log(21)) * 100));

  return clamp(Math.round(speedScore * 0.5 + ontimeScore * 0.3 + expScore * 0.2));
}

// ─── recordTourObservations ───────────────────────────────────────────────────

/**
 * Extracts stop data from a completed batch and records route observations.
 * Safe to call multiple times (UNIQUE constraint on batch_id+order_id).
 */
export async function recordTourObservations(
  locationId: string,
  batchId: string,
): Promise<RecordResult> {
  const sb = createServiceClient();

  type BatchStop = {
    id: string;
    state: string;
    stop_type: string;
    order_id: string | null;
    arrived_at: string | null;
    completed_at: string | null;
    lat: number | null;
    lng: number | null;
    customer_orders: {
      id: string;
      kunde_plz: string | null;
      delivery_zone: string | null;
      kunde_lat: number | null;
      kunde_lng: number | null;
      eta_latest: string | null;
      geliefert_am: string | null;
    } | null;
  };

  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, location_id, driver_id, state, created_at,
      mise_batch_stops(
        id, state, stop_type, order_id,
        arrived_at, completed_at, lat, lng,
        customer_orders(
          id, kunde_plz, delivery_zone,
          kunde_lat, kunde_lng, eta_latest, geliefert_am
        )
      )
    `)
    .eq('id', batchId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!batch || !batch.driver_id) return { recorded: 0, skipped: 0, batchId };

  const stops: BatchStop[] = Array.isArray(batch.mise_batch_stops)
    ? (batch.mise_batch_stops as unknown as BatchStop[])
    : [];

  const deliveredDropoffs = stops.filter(
    (s) => s.stop_type === 'dropoff' && s.state === 'delivered',
  );

  if (deliveredDropoffs.length === 0) return { recorded: 0, skipped: 0, batchId };

  // Determine batch pickup time for per-stop delivery time calculation
  const pickupStops = stops.filter((s) => s.stop_type === 'pickup');
  const pickupTimes = pickupStops
    .map((s) => s.arrived_at ?? s.completed_at)
    .filter((t): t is string => t !== null)
    .map((t) => new Date(t).getTime());
  const pickupEpoch = pickupTimes.length > 0 ? Math.min(...pickupTimes) : null;

  const observations: Array<{
    location_id: string;
    driver_id: string;
    batch_id: string;
    order_id: string | null;
    plz: string;
    delivery_zone: string | null;
    lat: number | null;
    lng: number | null;
    observed_at: string;
    delivery_min: number | null;
    on_time: boolean | null;
  }> = [];

  for (const stop of deliveredDropoffs) {
    const order = stop.customer_orders;
    const plz = order?.kunde_plz?.trim();
    if (!plz) continue;

    const completedEpoch = stop.completed_at ? new Date(stop.completed_at).getTime() : null;
    const deliveryMin =
      pickupEpoch && completedEpoch ? (completedEpoch - pickupEpoch) / 60_000 : null;

    let onTime: boolean | null = null;
    if (order?.eta_latest && stop.completed_at) {
      onTime = new Date(stop.completed_at) <= new Date(order.eta_latest);
    }

    observations.push({
      location_id: locationId,
      driver_id:   batch.driver_id as string,
      batch_id:    batchId,
      order_id:    stop.order_id ?? null,
      plz,
      delivery_zone: order?.delivery_zone ?? null,
      lat:  order?.kunde_lat ?? stop.lat ?? null,
      lng:  order?.kunde_lng ?? stop.lng ?? null,
      observed_at: stop.completed_at ?? new Date().toISOString(),
      delivery_min: deliveryMin,
      on_time: onTime,
    });
  }

  if (observations.length === 0) return { recorded: 0, skipped: deliveredDropoffs.length, batchId };

  const { error, data: inserted } = await sb
    .from('driver_route_observations')
    .upsert(observations, { onConflict: 'batch_id,order_id', ignoreDuplicates: true })
    .select('id');

  if (error) return { recorded: 0, skipped: observations.length, batchId };

  const recorded = inserted?.length ?? observations.length;
  return { recorded, skipped: deliveredDropoffs.length - recorded, batchId };
}

// ─── buildRouteProfiles ───────────────────────────────────────────────────────

/**
 * Rebuilds driver_route_profiles for a location from the last 90 days of observations.
 */
export async function buildRouteProfiles(locationId: string): Promise<BuildResult> {
  const sb = createServiceClient();

  // Fetch all observations from last 90 days
  const since = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const { data: rows } = await sb
    .from('driver_route_observations')
    .select('driver_id, plz, delivery_zone, delivery_min, on_time, observed_at')
    .eq('location_id', locationId)
    .gte('observed_at', since)
    .not('plz', 'is', null);

  if (!rows || rows.length === 0) return { locationId, profilesUpserted: 0, errors: 0 };

  // Compute PLZ population averages (across all drivers)
  const plzTotals = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    if (row.delivery_min == null) continue;
    const existing = plzTotals.get(row.plz) ?? { sum: 0, count: 0 };
    existing.sum += row.delivery_min;
    existing.count++;
    plzTotals.set(row.plz, existing);
  }
  const plzAvg = new Map<string, number>();
  for (const [plz, { sum, count }] of plzTotals.entries()) {
    plzAvg.set(plz, sum / count);
  }

  // Aggregate per driver+plz
  type Key = string; // `${driverId}__${plz}`
  const byKey = new Map<
    Key,
    {
      driverId: string;
      plz: string;
      deliveryZone: string | null;
      deliveryMins: number[];
      onTimeCount: number;
      totalCount: number;
      lastDeliveryAt: string | null;
    }
  >();

  for (const row of rows) {
    const key: Key = `${row.driver_id}__${row.plz}`;
    const entry: {
      driverId: string;
      plz: string;
      deliveryZone: string | null;
      deliveryMins: number[];
      onTimeCount: number;
      totalCount: number;
      lastDeliveryAt: string | null;
    } = byKey.get(key) ?? {
      driverId: row.driver_id as string,
      plz:      row.plz as string,
      deliveryZone: (row.delivery_zone as string | null) ?? null,
      deliveryMins: [] as number[],
      onTimeCount:  0,
      totalCount:   0,
      lastDeliveryAt: null,
    };
    if (row.delivery_min != null) entry.deliveryMins.push(row.delivery_min as number);
    if (row.on_time === true) entry.onTimeCount++;
    entry.totalCount++;
    if (!entry.lastDeliveryAt || row.observed_at > entry.lastDeliveryAt) {
      entry.lastDeliveryAt = row.observed_at;
    }
    byKey.set(key, entry);
  }

  const profiles: Array<{
    location_id: string;
    driver_id: string;
    plz: string;
    stop_count: number;
    avg_delivery_min: number | null;
    on_time_rate: number | null;
    proficiency_score: number;
    last_delivery_at: string | null;
    updated_at: string;
  }> = [];

  for (const entry of byKey.values()) {
    const avgMin =
      entry.deliveryMins.length > 0
        ? entry.deliveryMins.reduce((a, b) => a + b, 0) / entry.deliveryMins.length
        : null;
    const onTimeRate = entry.totalCount > 0 ? entry.onTimeCount / entry.totalCount : null;
    const plzAvgMin = plzAvg.get(entry.plz) ?? null;

    profiles.push({
      location_id:      locationId,
      driver_id:        entry.driverId,
      plz:              entry.plz,
      stop_count:       entry.totalCount,
      avg_delivery_min: avgMin,
      on_time_rate:     onTimeRate,
      proficiency_score: computeProficiencyScore(avgMin, onTimeRate, entry.totalCount, plzAvgMin),
      last_delivery_at: entry.lastDeliveryAt,
      updated_at:       new Date().toISOString(),
    });
  }

  if (profiles.length === 0) return { locationId, profilesUpserted: 0, errors: 0 };

  // Upsert in batches of 200
  const CHUNK = 200;
  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < profiles.length; i += CHUNK) {
    const chunk = profiles.slice(i, i + CHUNK);
    const { error } = await sb
      .from('driver_route_profiles')
      .upsert(chunk, { onConflict: 'location_id,driver_id,plz' });
    if (error) errors++;
    else upserted += chunk.length;
  }

  return { locationId, profilesUpserted: upserted, errors };
}

// ─── buildAllLocations ────────────────────────────────────────────────────────

export async function buildAllLocations(): Promise<BuildAllResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, profilesUpserted: 0, errors: 0 };

  let totalUpserted = 0;
  let totalErrors = 0;
  for (const loc of locations) {
    const result = await buildRouteProfiles(loc.id as string);
    totalUpserted += result.profilesUpserted;
    totalErrors += result.errors;
  }

  return { locations: locations.length, profilesUpserted: totalUpserted, errors: totalErrors };
}

// ─── getDriverRouteSuggestion ─────────────────────────────────────────────────

/**
 * Returns drivers ranked by their proficiency for the given PLZ list.
 * Used by dispatch to prioritize area-familiar drivers.
 */
export async function getDriverRouteSuggestion(
  locationId: string,
  plzList: string[],
): Promise<DriverSuggestion[]> {
  if (plzList.length === 0) return [];
  const sb = createServiceClient();

  const { data: profiles } = await sb
    .from('driver_route_profiles')
    .select('driver_id, plz, proficiency_score, avg_delivery_min')
    .eq('location_id', locationId)
    .in('plz', plzList)
    .order('proficiency_score', { ascending: false });

  if (!profiles?.length) return [];

  // Get driver names
  const driverIds = [...new Set(profiles.map((p) => p.driver_id as string))];
  const { data: drivers } = await sb
    .from('delivery_drivers')
    .select('id, name')
    .in('id', driverIds);

  const nameMap = new Map<string, string | null>();
  for (const d of drivers ?? []) nameMap.set(d.id as string, (d.name as string | null) ?? null);

  // Aggregate per driver
  const byDriver = new Map<
    string,
    { scores: number[]; mins: number[]; matchedPlzs: Set<string>; bestPlz: string | null; bestScore: number }
  >();

  for (const p of profiles) {
    const dId = p.driver_id as string;
    const existing = byDriver.get(dId) ?? {
      scores: [],
      mins: [],
      matchedPlzs: new Set<string>(),
      bestPlz: null,
      bestScore: -1,
    };
    existing.scores.push(p.proficiency_score as number);
    if (p.avg_delivery_min != null) existing.mins.push(p.avg_delivery_min as number);
    existing.matchedPlzs.add(p.plz as string);
    if ((p.proficiency_score as number) > existing.bestScore) {
      existing.bestScore = p.proficiency_score as number;
      existing.bestPlz   = p.plz as string;
    }
    byDriver.set(dId, existing);
  }

  const suggestions: DriverSuggestion[] = [];
  for (const [driverId, agg] of byDriver.entries()) {
    const avgScore = Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length);
    const avgMin   = agg.mins.length > 0 ? agg.mins.reduce((a, b) => a + b, 0) / agg.mins.length : null;
    suggestions.push({
      driverId,
      driverName:         nameMap.get(driverId) ?? null,
      avgProficiencyScore: avgScore,
      avgDeliveryMin:     avgMin,
      coveragePct:        Math.round((agg.matchedPlzs.size / plzList.length) * 100),
      bestPlz:            agg.bestPlz,
    });
  }

  return suggestions.sort((a, b) => b.avgProficiencyScore - a.avgProficiencyScore);
}

// ─── getRouteLearningDashboard ────────────────────────────────────────────────

export async function getRouteLearningDashboard(locationId: string): Promise<RouteLearningDashboard> {
  const sb = createServiceClient();

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [
    { count: totalObs },
    { count: totalProfiles },
    { count: obs7d },
    { data: profileRows },
    { data: topProfiles },
  ] = await Promise.all([
    sb.from('driver_route_observations').select('*', { count: 'exact', head: true }).eq('location_id', locationId),
    sb.from('driver_route_profiles').select('*', { count: 'exact', head: true }).eq('location_id', locationId),
    sb.from('driver_route_observations').select('*', { count: 'exact', head: true }).eq('location_id', locationId).gte('observed_at', since7d),
    sb.from('driver_route_profiles').select('driver_id, plz, stop_count, avg_delivery_min, on_time_rate, proficiency_score, last_delivery_at').eq('location_id', locationId),
    sb.from('driver_route_profiles').select('id, location_id, driver_id, plz, stop_count, avg_delivery_min, on_time_rate, proficiency_score, last_delivery_at, updated_at').eq('location_id', locationId).order('proficiency_score', { ascending: false }).limit(20),
  ]);

  // Driver names
  const allDriverIds = [...new Set((profileRows ?? []).map((r) => r.driver_id as string))];
  const { data: driverRows } = allDriverIds.length > 0
    ? await sb.from('delivery_drivers').select('id, name, vehicle').in('id', allDriverIds)
    : { data: [] };
  const nameMap  = new Map<string, string | null>();
  const vehicleMap = new Map<string, string | null>();
  for (const d of driverRows ?? []) {
    nameMap.set(d.id as string, (d.name as string | null) ?? null);
    vehicleMap.set(d.id as string, (d.vehicle as string | null) ?? null);
  }

  // Build topProfiles with driver info
  const topProfilesWithDriver: RouteProfileWithDriver[] = (topProfiles ?? []).map((p) => ({
    id:              p.id as string,
    locationId:      p.location_id as string,
    driverId:        p.driver_id as string,
    plz:             p.plz as string,
    stopCount:       p.stop_count as number,
    avgDeliveryMin:  p.avg_delivery_min as number | null,
    onTimeRate:      p.on_time_rate as number | null,
    proficiencyScore: p.proficiency_score as number,
    lastDeliveryAt:  p.last_delivery_at as string | null,
    updatedAt:       p.updated_at as string,
    driverName:      nameMap.get(p.driver_id as string) ?? null,
    vehicleType:     vehicleMap.get(p.driver_id as string) ?? null,
  }));

  // PLZ stats
  const plzMap = new Map<string, { plz: string; deliveryZone: string | null; stops: number[]; drivers: Set<string>; bestScore: number; bestDriverId: string | null }>();
  for (const p of profileRows ?? []) {
    const existing = plzMap.get(p.plz as string) ?? {
      plz:          p.plz as string,
      deliveryZone: null,
      stops:        [],
      drivers:      new Set<string>(),
      bestScore:    -1,
      bestDriverId: null,
    };
    existing.drivers.add(p.driver_id as string);
    if (p.avg_delivery_min != null) existing.stops.push(p.avg_delivery_min as number);
    if ((p.proficiency_score as number) > existing.bestScore) {
      existing.bestScore    = p.proficiency_score as number;
      existing.bestDriverId = p.driver_id as string;
    }
    plzMap.set(p.plz as string, existing);
  }

  const plzStats: PlzStats[] = Array.from(plzMap.values())
    .map((e) => ({
      plz:              e.plz,
      deliveryZone:     e.deliveryZone,
      totalStops:       (profileRows ?? []).filter((r) => r.plz === e.plz).reduce((a, r) => a + (r.stop_count as number), 0),
      avgDeliveryMin:   e.stops.length > 0 ? e.stops.reduce((a, b) => a + b, 0) / e.stops.length : null,
      activeDrivers:    e.drivers.size,
      bestDriverId:     e.bestDriverId,
      bestDriverName:   e.bestDriverId ? (nameMap.get(e.bestDriverId) ?? null) : null,
      bestScore:        e.bestScore,
    }))
    .sort((a, b) => b.totalStops - a.totalStops)
    .slice(0, 30);

  // Driver summary
  const driverAgg = new Map<string, { scores: number[]; stopTotal: number; bestPlz: string | null; bestScore: number }>();
  for (const p of profileRows ?? []) {
    const dId = p.driver_id as string;
    const existing = driverAgg.get(dId) ?? { scores: [], stopTotal: 0, bestPlz: null, bestScore: -1 };
    existing.scores.push(p.proficiency_score as number);
    existing.stopTotal += p.stop_count as number;
    if ((p.proficiency_score as number) > existing.bestScore) {
      existing.bestScore = p.proficiency_score as number;
      existing.bestPlz   = p.plz as string;
    }
    driverAgg.set(dId, existing);
  }

  const driverSummary = Array.from(driverAgg.entries())
    .map(([driverId, agg]) => ({
      driverId,
      driverName:   nameMap.get(driverId) ?? null,
      profileCount: agg.scores.length,
      avgScore:     Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length),
      bestPlz:      agg.bestPlz,
      totalStops:   agg.stopTotal,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Overall avg score
  const allScores = (profileRows ?? []).map((r) => r.proficiency_score as number);
  const avgScore  = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

  const lastProfile = (profileRows ?? []).reduce<string | null>((best, r) => {
    const d = r.last_delivery_at as string | null;
    if (!d) return best;
    if (!best || d > best) return d;
    return best;
  }, null);

  return {
    stats: {
      totalObservations:    totalObs ?? 0,
      totalProfiles:        totalProfiles ?? 0,
      activeDrivers:        allDriverIds.length,
      coveredPlzs:          plzMap.size,
      avgProficiencyScore:  avgScore !== null ? Math.round(avgScore) : null,
      observationsLast7d:   obs7d ?? 0,
      lastRebuildAt:        lastProfile,
    },
    topProfiles:    topProfilesWithDriver,
    plzStats,
    driverSummary,
  };
}

// ─── pruneOldObservations ─────────────────────────────────────────────────────

export async function pruneOldObservations(daysToKeep = 120): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_driver_route_observations', { days_to_keep: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
