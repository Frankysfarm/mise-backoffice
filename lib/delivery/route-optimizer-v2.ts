/**
 * lib/delivery/route-optimizer-v2.ts
 *
 * Enhanced Routen-Optimierung mit:
 *  - Distance-Matrix (einmalig berechnet, wiederverwendet)
 *  - 2-opt local search improvement (bis 40% Einsparung typisch)
 *  - Fallback auf Google TSP wenn verfügbar
 *  - Zeitfenster-Berücksichtigung (ETA-Deadlines)
 *  - Logging aller Optimierungsläufe in route_optimization_log
 */
import 'server-only';
import { haversineKm, directions } from '@/lib/google-maps';
import { createServiceClient } from '@/lib/supabase/server';

interface Stop {
  id: string;
  order_id: string;
  type: 'pickup' | 'dropoff';
  sequence: number;
  lat: number;
  lng: number;
  address: string | null;
  eta_latest?: string | null; // ISO timestamp — Deadline für Zeitfenster
}

export interface OptimizationResult {
  batchId: string;
  locationId: string;
  stopsCount: number;
  distanceBeforeKm: number;
  distanceAfterKm: number;
  improvementKm: number;
  improvementPct: number;
  algorithm: 'google_tsp' | 'nearest_neighbor' | 'two_opt';
  durationMs: number;
}

export interface OptimizationDashboard {
  stats: {
    total_optimizations: number;
    avg_improvement_km: number;
    avg_improvement_pct: number;
    best_improvement_km: number;
    best_improvement_pct: number;
    total_km_saved: number;
    google_tsp_count: number;
    two_opt_count: number;
    avg_stops: number;
    last_run_at: string | null;
  } | null;
  history: Array<{
    id: string;
    batch_id: string | null;
    stops_count: number;
    distance_before_km: number;
    distance_after_km: number;
    improvement_km: number;
    improvement_pct: number;
    algorithm: string;
    duration_ms: number;
    created_at: string;
    batch_state: string | null;
  }>;
  pendingBatches: Array<{
    id: string;
    state: string;
    stop_count: number;
    created_at: string;
  }>;
}

// ── Distance Matrix ───────────────────────────────────────────────────────────

function buildDistanceMatrix(stops: Stop[]): number[][] {
  const n = stops.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(stops[i], stops[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

function routeDistance(order: number[], matrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += matrix[order[i]][order[i + 1]];
  }
  return total;
}

// ── Nearest-Neighbor Heuristic ────────────────────────────────────────────────

function nearestNeighborOrder(startIdx: number, indices: number[], matrix: number[][]): number[] {
  const remaining = [...indices];
  const result: number[] = [];
  let current = startIdx;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = matrix[current][remaining[i]];
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    result.push(next);
    current = next;
  }
  return result;
}

// ── 2-opt Improvement ─────────────────────────────────────────────────────────

function twoOptImprove(order: number[], matrix: number[][], maxIterations = 100): number[] {
  let best = [...order];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        // 2-opt swap: reverse segment [i+1..j]
        const before =
          matrix[best[i]][best[i + 1]] +
          matrix[best[j]][best[(j + 1) % best.length]];
        const after =
          matrix[best[i]][best[j]] +
          matrix[best[i + 1]][best[(j + 1) % best.length]];

        if (after < before - 0.0001) {
          // Reverse [i+1..j]
          const reversed = best.slice(i + 1, j + 1).reverse();
          best = [...best.slice(0, i + 1), ...reversed, ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return best;
}

// ── Time-window penalty (soft constraint) ─────────────────────────────────────

function scoreWithTimeWindows(order: number[], stops: Stop[], matrix: number[][], speedKmH = 25): number {
  let dist = routeDistance(order, matrix);
  let cumulativeMin = 0;
  let penalty = 0;

  for (let i = 0; i < order.length - 1; i++) {
    const segKm = matrix[order[i]][order[i + 1]];
    cumulativeMin += (segKm / speedKmH) * 60;

    const stop = stops[order[i + 1]];
    if (stop.eta_latest) {
      const deadlineMin = (new Date(stop.eta_latest).getTime() - Date.now()) / 60000;
      if (cumulativeMin > deadlineMin) {
        penalty += (cumulativeMin - deadlineMin) * 0.5; // penalize 0.5 km per overdue minute
      }
    }
  }
  return dist + penalty;
}

// ── Google TSP Optimization ───────────────────────────────────────────────────

async function tryGoogleTsp(pickupStop: Stop, dropoffs: Stop[]): Promise<{
  orderedDropoffs: Stop[];
  totalDistanceKm: number;
  totalEtaMin: number;
  polyline: string | null;
} | null> {
  if (dropoffs.length < 2) return null;
  try {
    const origin = pickupStop;
    const destination = dropoffs[dropoffs.length - 1];
    const waypoints = dropoffs.slice(0, -1).map((s) => ({ lat: s.lat, lng: s.lng }));

    const route = await directions({
      origin:      { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      waypoints,
      optimize: true,
      mode: 'driving',
    });

    const middle = dropoffs.slice(0, -1);
    const reordered = route.optimized_order.map((i) => middle[i]);
    return {
      orderedDropoffs: [...reordered, destination],
      totalDistanceKm: route.total_distance_m / 1000,
      totalEtaMin: Math.round(route.total_duration_s / 60),
      polyline: route.polyline,
    };
  } catch {
    return null;
  }
}

// ── Main optimization function ────────────────────────────────────────────────

export async function optimizeTourV2(
  batchId: string,
  locationId: string,
): Promise<OptimizationResult | null> {
  const t0 = Date.now();
  const sb = createServiceClient();

  // Load stops + order ETA windows
  const { data: rawStops } = await sb
    .from('mise_delivery_batch_stops')
    .select(`
      id, order_id, type, sequence, lat, lng, address,
      customer_orders!inner(eta_latest)
    `)
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  if (!rawStops || rawStops.length < 2) return null;

  const stops: Stop[] = (rawStops as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    order_id: r.order_id as string,
    type: r.type as 'pickup' | 'dropoff',
    sequence: r.sequence as number,
    lat: r.lat as number,
    lng: r.lng as number,
    address: r.address as string | null,
    eta_latest: (r.customer_orders as { eta_latest?: string | null } | null)?.eta_latest ?? null,
  }));

  const pickups  = stops.filter((s) => s.type === 'pickup'  && s.lat != null && s.lng != null);
  const dropoffs = stops.filter((s) => s.type === 'dropoff' && s.lat != null && s.lng != null);

  if (dropoffs.length < 2) return null;

  // Deduplicate pickups (same lat/lng → single stop)
  const seen = new Set<string>();
  const uniquePickups = pickups.filter((p) => {
    const key = `${Math.round(p.lat * 1000)},${Math.round(p.lng * 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Distance before optimization (current sequence)
  const allStops = [...uniquePickups, ...dropoffs];
  const matrix = buildDistanceMatrix(allStops);
  const pickupCount = uniquePickups.length;
  const dropoffIndices = dropoffs.map((_, i) => pickupCount + i);

  const distanceBeforeKm = (() => {
    let d = 0;
    for (let i = 0; i < allStops.length - 1; i++) d += matrix[i][i + 1];
    return Math.round(d * 100) / 100;
  })();

  // Try Google TSP first
  const googleResult = await tryGoogleTsp(uniquePickups[uniquePickups.length - 1] ?? dropoffs[0], dropoffs);

  let orderedDropoffs: Stop[];
  let polyline: string | null = null;
  let totalDistanceKm: number;
  let totalEtaMin: number;
  let algorithm: 'google_tsp' | 'nearest_neighbor' | 'two_opt';

  if (googleResult) {
    orderedDropoffs = googleResult.orderedDropoffs;
    polyline = googleResult.polyline;
    totalDistanceKm = googleResult.totalDistanceKm;
    totalEtaMin = googleResult.totalEtaMin;
    algorithm = 'google_tsp';
  } else {
    // Nearest-neighbor as starting point
    const startIdx = pickupCount - 1; // last pickup
    const nnOrder = nearestNeighborOrder(startIdx, dropoffIndices, matrix);

    // Build the order array: pickups (0..pickupCount-1) + dropoffs in NN order
    const dropoffOrder = nnOrder; // these are indices into allStops
    const twoOptOrder = twoOptImprove(dropoffOrder, matrix);

    // Check which is better (with time-window penalties)
    const nnScore     = scoreWithTimeWindows(nnOrder, allStops, matrix);
    const twoOptScore = scoreWithTimeWindows(twoOptOrder, allStops, matrix);

    const bestOrder = twoOptScore < nnScore ? twoOptOrder : nnOrder;
    orderedDropoffs = bestOrder.map((idx) => allStops[idx]);
    algorithm = twoOptScore < nnScore ? 'two_opt' : 'nearest_neighbor';

    // Compute distance for the best order
    const allOrdered = [...uniquePickups, ...orderedDropoffs];
    const orderedMatrix = buildDistanceMatrix(allOrdered);
    totalDistanceKm = routeDistance(
      allOrdered.map((_, i) => i),
      orderedMatrix,
    );
    totalEtaMin = Math.round((totalDistanceKm / 25) * 60);
  }

  const distanceAfterKm = Math.round(totalDistanceKm * 100) / 100;
  const improvementKm   = Math.round((distanceBeforeKm - distanceAfterKm) * 100) / 100;
  const improvementPct  = distanceBeforeKm > 0
    ? Math.round(((distanceBeforeKm - distanceAfterKm) / distanceBeforeKm) * 10000) / 100
    : 0;

  // Resequence stops in DB
  const resequenced = [
    ...uniquePickups.map((s, i) => ({ ...s, sequence: i })),
    ...orderedDropoffs.map((s, i) => ({ ...s, sequence: uniquePickups.length + i })),
  ];

  for (const s of resequenced) {
    await sb
      .from('mise_delivery_batch_stops')
      .update({ sequence: s.sequence })
      .eq('id', s.id);
  }

  await sb
    .from('mise_delivery_batches')
    .update({
      polyline,
      total_distance_km: distanceAfterKm,
      total_eta_min: totalEtaMin,
      stop_count: resequenced.length,
      optimized: true,
    })
    .eq('id', batchId);

  // Log result
  const durationMs = Date.now() - t0;
  await sb.from('route_optimization_log').insert({
    location_id:       locationId,
    batch_id:          batchId,
    stops_count:       resequenced.length,
    distance_before_km: distanceBeforeKm,
    distance_after_km:  distanceAfterKm,
    algorithm,
    duration_ms:       durationMs,
  });

  return {
    batchId,
    locationId,
    stopsCount:       resequenced.length,
    distanceBeforeKm,
    distanceAfterKm,
    improvementKm,
    improvementPct,
    algorithm,
    durationMs,
  };
}

// ── Batch: optimize all unoptimized pending/active batches ────────────────────

export async function optimizePendingBatches(locationId: string): Promise<{
  processed: number;
  optimized: number;
  totalKmSaved: number;
}> {
  const sb = createServiceClient();

  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, stop_count')
    .eq('location_id', locationId)
    .in('state', ['pending_acceptance', 'accepted', 'en_route'])
    .eq('optimized', false)
    .gte('stop_count', 2)
    .order('created_at', { ascending: true })
    .limit(20);

  if (!batches || batches.length === 0) {
    return { processed: 0, optimized: 0, totalKmSaved: 0 };
  }

  let optimized = 0;
  let totalKmSaved = 0;

  for (const batch of batches as { id: string; stop_count: number }[]) {
    try {
      const result = await optimizeTourV2(batch.id, locationId);
      if (result) {
        optimized++;
        totalKmSaved += result.improvementKm;
      }
    } catch {
      // continue with next batch
    }
  }

  return { processed: batches.length, optimized, totalKmSaved: Math.round(totalKmSaved * 100) / 100 };
}

// ── Cron: run for all locations ───────────────────────────────────────────────

export async function optimizeAllLocations(): Promise<{
  locations: number;
  processed: number;
  optimized: number;
  totalKmSaved: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  if (!locs) return { locations: 0, processed: 0, optimized: 0, totalKmSaved: 0 };

  let totalProcessed = 0;
  let totalOptimized = 0;
  let totalKmSaved = 0;

  for (const loc of locs as { id: string }[]) {
    try {
      const r = await optimizePendingBatches(loc.id);
      totalProcessed += r.processed;
      totalOptimized += r.optimized;
      totalKmSaved   += r.totalKmSaved;
    } catch {
      // continue
    }
  }

  return {
    locations:   locs.length,
    processed:   totalProcessed,
    optimized:   totalOptimized,
    totalKmSaved: Math.round(totalKmSaved * 100) / 100,
  };
}

// ── Dashboard data ────────────────────────────────────────────────────────────

export async function getRouteOptimizationDashboard(locationId: string): Promise<OptimizationDashboard> {
  const sb = createServiceClient();

  const [statsResult, historyResult, pendingResult] = await Promise.all([
    sb
      .from('v_route_optimization_stats')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('v_route_optimization_history')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('mise_delivery_batches')
      .select('id, state, stop_count, created_at')
      .eq('location_id', locationId)
      .in('state', ['pending_acceptance', 'accepted', 'en_route'])
      .eq('optimized', false)
      .gte('stop_count', 2)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    stats:          (statsResult.data as OptimizationDashboard['stats']) ?? null,
    history:        (historyResult.data as OptimizationDashboard['history']) ?? [],
    pendingBatches: (pendingResult.data as OptimizationDashboard['pendingBatches']) ?? [],
  };
}
