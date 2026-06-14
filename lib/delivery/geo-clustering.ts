/**
 * lib/delivery/geo-clustering.ts
 *
 * Fahrer-Geo-Clustering Engine — Phase 173
 *
 * Analysiert historische Liefer-Endpunkte via K-Means Clustering.
 * Ergebnis: Hotspot-Cluster mit Demand-Score für optimales Vorpositionieren.
 *
 * Algorithmus: Lloyd's K-Means, 15 Iterationen, K-Means++ Init.
 * Koordinaten WGS84 lat/lng; Distanzen via haversineKm.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface GeoCluster {
  id: string;
  location_id: string;
  cluster_idx: number;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  order_count: number;
  peak_hour: number | null;
  avg_hour: number | null;
  label: string | null;
  demand_score: number;
  created_at: string;
  updated_at: string;
}

export interface GeoClusterConfig {
  k_clusters: number;
  lookback_days: number;
  min_orders: number;
  enabled: boolean;
  last_computed: string | null;
}

export interface ClusterDashboard {
  config: GeoClusterConfig;
  clusters: GeoCluster[];
  stats: {
    total_clusters: number;
    total_orders_analyzed: number;
    avg_demand_score: number;
    top_cluster_orders: number;
    last_computed: string | null;
  };
}

export interface ComputeResult {
  location_id: string;
  clusters_upserted: number;
  orders_analyzed: number;
  k: number;
  iterations: number;
}

// ─── Hilfsfunktionen K-Means ────────────────────────────────────────────────

interface Point {
  lat: number;
  lng: number;
  hour: number;
}

/** Haversine-Distanz zwischen zwei Punkten in km. */
function dist(a: Point, b: { lat: number; lng: number }): number {
  return haversineKm({ lat: a.lat, lng: a.lng }, b);
}

/** Wählt nächsten Cluster-Center zu einem Punkt. */
function nearestCenter(
  p: Point,
  centers: Array<{ lat: number; lng: number }>,
): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const d = dist(p, centers[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** K-Means++ Initialisierung: erste Center zufällig, weitere nach Distanz-Wahrscheinlichkeit. */
function kmeansppInit(
  points: Point[],
  k: number,
  seed: number,
): Array<{ lat: number; lng: number }> {
  // Einfacher LCG-Pseudo-RNG (deterministisch)
  let rng = seed;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  };

  const centers: Array<{ lat: number; lng: number }> = [];
  const first = Math.floor(rand() * points.length);
  centers.push({ lat: points[first].lat, lng: points[first].lng });

  for (let c = 1; c < k; c++) {
    const dists = points.map((p) => {
      const d = dist(p, centers[nearestCenter(p, centers)]);
      return d * d;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = rand() * total;
    let chosen = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centers.push({ lat: points[chosen].lat, lng: points[chosen].lng });
  }
  return centers;
}

/** Berechnet mittlere Koordinate einer Punktmenge. */
function centroid(pts: Point[]): { lat: number; lng: number } {
  const n = pts.length;
  if (n === 0) return { lat: 0, lng: 0 };
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / n,
    lng: pts.reduce((s, p) => s + p.lng, 0) / n,
  };
}

/** Berechnet den Modus (häufigster Wert 0–23) einer Stunden-Liste. */
function hourMode(pts: Point[]): number | null {
  if (pts.length === 0) return null;
  const counts = new Array<number>(24).fill(0);
  for (const p of pts) counts[p.hour]++;
  return counts.indexOf(Math.max(...counts));
}

/** Berechnet den Durchschnitt der Stunden (zirkulär 0–23). */
function hourAvg(pts: Point[]): number | null {
  if (pts.length === 0) return null;
  // Zirkulärer Durchschnitt via sin/cos
  const sinSum = pts.reduce((s, p) => s + Math.sin((p.hour / 24) * 2 * Math.PI), 0);
  const cosSum = pts.reduce((s, p) => s + Math.cos((p.hour / 24) * 2 * Math.PI), 0);
  const angle = Math.atan2(sinSum / pts.length, cosSum / pts.length);
  const h = ((angle / (2 * Math.PI)) * 24 + 24) % 24;
  return Math.round(h * 10) / 10;
}

/** Berechnet maximale Distanz vom Center in einem Cluster (Radius). */
function clusterRadius(pts: Point[], center: { lat: number; lng: number }): number {
  if (pts.length === 0) return 0.5;
  const maxD = Math.max(...pts.map((p) => dist(p, center)));
  return Math.max(0.3, Math.round(maxD * 10) / 10);
}

/** Lloyd's K-Means: läuft maxIter Iterationen, gibt Cluster-Assignments zurück. */
function kmeans(
  points: Point[],
  k: number,
  maxIter: number = 15,
): { centers: Array<{ lat: number; lng: number }>; assignments: number[]; iters: number } {
  if (points.length === 0) return { centers: [], assignments: [], iters: 0 };
  const effectiveK = Math.min(k, points.length);
  let centers = kmeansppInit(points, effectiveK, points.length * 31 + 7);
  let assignments = new Array<number>(points.length).fill(0);
  let iters = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iters++;
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      const c = nearestCenter(points[i], centers);
      if (c !== assignments[i]) { assignments[i] = c; changed = true; }
    }
    if (!changed && iter > 0) break;

    for (let c = 0; c < effectiveK; c++) {
      const clusterPts = points.filter((_, i) => assignments[i] === c);
      if (clusterPts.length > 0) centers[c] = centroid(clusterPts);
    }
  }
  return { centers, assignments, iters };
}

// ─── Demand-Score ────────────────────────────────────────────────────────────

/** Normalisiert Cluster-Bestellmengen zu Score 0–100. */
function computeDemandScores(counts: number[]): number[] {
  const max = Math.max(...counts, 1);
  return counts.map((c) => Math.round((c / max) * 100));
}

// ─── DB-Operationen ──────────────────────────────────────────────────────────

export async function getClusterConfig(locationId: string): Promise<GeoClusterConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_geo_cluster_config')
    .select('k_clusters, lookback_days, min_orders, enabled, last_computed')
    .eq('location_id', locationId)
    .maybeSingle();

  return {
    k_clusters:    (data as { k_clusters: number } | null)?.k_clusters    ?? 5,
    lookback_days: (data as { lookback_days: number } | null)?.lookback_days ?? 30,
    min_orders:    (data as { min_orders: number } | null)?.min_orders    ?? 3,
    enabled:       (data as { enabled: boolean } | null)?.enabled         ?? true,
    last_computed: (data as { last_computed: string } | null)?.last_computed ?? null,
  };
}

export async function upsertClusterConfig(
  locationId: string,
  patch: Partial<Omit<GeoClusterConfig, 'last_computed'>>,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('delivery_geo_cluster_config')
    .upsert({ location_id: locationId, ...patch }, { onConflict: 'location_id' });
}

export async function getClusters(locationId: string): Promise<GeoCluster[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_geo_clusters')
    .select('*')
    .eq('location_id', locationId)
    .order('demand_score', { ascending: false });
  return (data ?? []) as GeoCluster[];
}

export async function getClusterDashboard(locationId: string): Promise<ClusterDashboard> {
  const [config, clusters] = await Promise.all([
    getClusterConfig(locationId),
    getClusters(locationId),
  ]);

  const totalOrders = clusters.reduce((s, c) => s + c.order_count, 0);
  const avgScore    = clusters.length > 0
    ? Math.round(clusters.reduce((s, c) => s + c.demand_score, 0) / clusters.length)
    : 0;

  return {
    config,
    clusters,
    stats: {
      total_clusters:       clusters.length,
      total_orders_analyzed: totalOrders,
      avg_demand_score:     avgScore,
      top_cluster_orders:   clusters[0]?.order_count ?? 0,
      last_computed:        config.last_computed,
    },
  };
}

// ─── Clustering-Kern ─────────────────────────────────────────────────────────

/** Berechnet Cluster für eine einzelne Location und persistiert sie. */
export async function computeClustersForLocation(locationId: string): Promise<ComputeResult> {
  const sb   = createServiceClient();
  const cfg  = await getClusterConfig(locationId);
  const k    = cfg.k_clusters;
  const days = cfg.lookback_days;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('kunde_lat, kunde_lng, bestellt_am')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .not('kunde_lat', 'is', null)
    .not('kunde_lng', 'is', null)
    .gte('bestellt_am', since)
    .limit(2000);

  const points: Point[] = ((orders ?? []) as Array<{
    kunde_lat: number;
    kunde_lng: number;
    bestellt_am: string;
  }>).map((o) => ({
    lat:  o.kunde_lat,
    lng:  o.kunde_lng,
    hour: new Date(o.bestellt_am).getUTCHours(),
  }));

  if (points.length < cfg.min_orders) {
    await sb
      .from('delivery_geo_cluster_config')
      .upsert({ location_id: locationId, last_computed: new Date().toISOString() }, { onConflict: 'location_id' });
    return { location_id: locationId, clusters_upserted: 0, orders_analyzed: points.length, k, iterations: 0 };
  }

  const { centers, assignments, iters } = kmeans(points, k);
  const effectiveK = centers.length;

  // Cluster-Punkte sammeln
  const clusterPoints: Point[][] = Array.from({ length: effectiveK }, () => []);
  for (let i = 0; i < points.length; i++) {
    clusterPoints[assignments[i]].push(points[i]);
  }

  const counts       = clusterPoints.map((pts) => pts.length);
  const scores       = computeDemandScores(counts);
  const upsertRows   = centers.map((c, idx) => {
    const pts     = clusterPoints[idx];
    const radius  = clusterRadius(pts, c);
    const peakH   = hourMode(pts);
    const avgH    = hourAvg(pts);
    return {
      location_id:  locationId,
      cluster_idx:  idx,
      center_lat:   Math.round(c.lat * 1_000_000) / 1_000_000,
      center_lng:   Math.round(c.lng * 1_000_000) / 1_000_000,
      radius_km:    radius,
      order_count:  counts[idx],
      peak_hour:    peakH,
      avg_hour:     avgH,
      demand_score: scores[idx],
      label:        null,
      updated_at:   new Date().toISOString(),
    };
  }).filter((r) => r.order_count >= cfg.min_orders);

  // Alte Cluster löschen, neue einfügen
  await sb.from('delivery_geo_clusters').delete().eq('location_id', locationId);
  if (upsertRows.length > 0) {
    await sb.from('delivery_geo_clusters').insert(upsertRows);
  }

  // Config: last_computed updaten
  await sb
    .from('delivery_geo_cluster_config')
    .upsert({ location_id: locationId, last_computed: new Date().toISOString() }, { onConflict: 'location_id' });

  return {
    location_id:       locationId,
    clusters_upserted: upsertRows.length,
    orders_analyzed:   points.length,
    k,
    iterations:        iters,
  };
}

/** Cron-Batch: alle aktiven Locations. */
export async function computeClustersAllLocations(): Promise<{
  locations: number;
  clusters_upserted: number;
  orders_analyzed: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(30);

  let clustersUpserted = 0;
  let ordersAnalyzed   = 0;
  let errors           = 0;

  for (const loc of (locs ?? []) as Array<{ id: string }>) {
    try {
      const r = await computeClustersForLocation(loc.id);
      clustersUpserted += r.clusters_upserted;
      ordersAnalyzed   += r.orders_analyzed;
    } catch {
      errors++;
    }
  }

  return {
    locations:         (locs ?? []).length,
    clusters_upserted: clustersUpserted,
    orders_analyzed:   ordersAnalyzed,
    errors,
  };
}

/** Gibt für eine Location die Top-N Cluster als Positionierungs-Hotspots zurück. */
export async function getHotspots(
  locationId: string,
  limit: number = 3,
): Promise<Array<{ lat: number; lng: number; demand_score: number; peak_hour: number | null; order_count: number }>> {
  const clusters = await getClusters(locationId);
  return clusters
    .slice(0, limit)
    .map((c) => ({
      lat:          c.center_lat,
      lng:          c.center_lng,
      demand_score: c.demand_score,
      peak_hour:    c.peak_hour,
      order_count:  c.order_count,
    }));
}
