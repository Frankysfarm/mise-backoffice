/**
 * lib/delivery/benchmarking.ts
 *
 * Phase 215: Smart Delivery Benchmarking Engine
 *
 * Daily multi-dimensional benchmark snapshot per location.
 * Composite score from 5 dimensions:
 *   35% quality_score  (from delivery_quality_scores)
 *   25% sla_score      (on-time SLA compliance)
 *   20% throughput_score (orders per active driver-hour)
 *   10% carbon_score   (eco-efficiency)
 *   10% efficiency_score (avg delivery time vs 35-min target)
 *
 * Public API:
 *   computeBenchmark(locationId)       — compute dimensions for yesterday
 *   snapshotBenchmark(locationId)      — persist to delivery_benchmarks
 *   snapshotAllLocations()             — cron batch (all active locations, fills ranks)
 *   getBenchmarkDashboard(locationId)  — KPI + ranking + trend + best-practice
 *   getBenchmarkRanking()              — all locations ranked (latest snapshot)
 *   exportBestPractices(locationId)    — JSON export of top-performing location
 *   pruneOldBenchmarks(daysToKeep)     — cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkDimensions {
  qualityScore:     number;
  slaScore:         number;
  carbonScore:      number;
  throughputScore:  number;
  efficiencyScore:  number;
}

export interface BenchmarkSnapshot {
  locationId:           string;
  benchDate:            string;
  qualityScore:         number;
  slaScore:             number;
  carbonScore:          number;
  throughputScore:      number;
  efficiencyScore:      number;
  overallScore:         number;
  grade:                string;
  totalOrders:          number;
  completedDeliveries:  number;
  onTimeDeliveries:     number;
  avgDeliveryMin:       number | null;
  activeDriverHours:    number | null;
  totalDistanceKm:      number | null;
  ecoTourPct:           number | null;
  slaBreachCount:       number;
  locationRank:         number | null;
  totalLocations:       number | null;
  weakestDimension:     string | null;
}

export interface BenchmarkRankRow {
  locationId:       string;
  locationName:     string;
  benchDate:        string;
  overallScore:     number;
  grade:            string;
  liveRank:         number;
  liveTotal:        number;
  qualityScore:     number;
  slaScore:         number;
  carbonScore:      number;
  throughputScore:  number;
  efficiencyScore:  number;
  totalOrders:      number;
  avgDeliveryMin:   number | null;
  weakestDimension: string | null;
}

export interface BenchmarkTrendRow {
  benchDate:       string;
  overallScore:    number;
  grade:           string;
  qualityScore:    number;
  slaScore:        number;
  carbonScore:     number;
  throughputScore: number;
  efficiencyScore: number;
  locationRank:    number | null;
  totalLocations:  number | null;
  totalOrders:     number;
  avgDeliveryMin:  number | null;
}

export interface BestPracticeExport {
  locationId:   string;
  locationName: string;
  exportedAt:   string;
  snapshot:     BenchmarkRankRow;
  insights:     { dimension: string; score: number; tip: string }[];
}

export interface BenchmarkDashboard {
  today:      BenchmarkSnapshot | null;
  yesterday:  BenchmarkSnapshot | null;
  weeklyAvg:  number;
  trend:      BenchmarkTrendRow[];
  ranking:    BenchmarkRankRow[];
  bestPractice: BestPracticeExport | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_DELIVERY_MIN = 35;
const MIN_ORDERS_FOR_SCORE = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}

function weakest(dims: BenchmarkDimensions): string {
  const entries: [string, number][] = [
    ['quality', dims.qualityScore],
    ['sla', dims.slaScore],
    ['throughput', dims.throughputScore],
    ['carbon', dims.carbonScore],
    ['efficiency', dims.efficiencyScore],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

const DIMENSION_TIPS: Record<string, string> = {
  quality:     'Kundenzufriedenheit verbessern: Genauigkeit prüfen, Beschwerden analysieren',
  sla:         'SLA-Breaches reduzieren: Dispatcher-Priorität für älteste Bestellungen erhöhen',
  throughput:  'Mehr Bestellungen pro Schicht: Zonen enger schneiden, Touren früher bündeln',
  carbon:      'CO₂ senken: Fahrräder/E-Bikes priorisieren, kurze Routen optimieren',
  efficiency:  'Lieferzeiten verkürzen: Küchen-Sync-Timing anpassen, Touren kleiner halten',
};

// ─── Compute ──────────────────────────────────────────────────────────────────

export async function computeBenchmark(locationId: string): Promise<{
  dims: BenchmarkDimensions;
  raw: {
    totalOrders: number;
    completedDeliveries: number;
    onTimeDeliveries: number;
    avgDeliveryMin: number | null;
    activeDriverHours: number | null;
    totalDistanceKm: number | null;
    ecoTourPct: number | null;
    slaBreachCount: number;
  };
}> {
  const svc = createServiceClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd   = `${dateStr}T23:59:59.999Z`;

  // 1. Quality score from delivery_quality_scores (yesterday)
  const [qualSnap, orderStats, slaData, carbonSnap, shiftData] = await Promise.allSettled([
    svc.from('delivery_quality_scores')
      .select('overall_score')
      .eq('location_id', locationId)
      .eq('score_date', dateStr)
      .maybeSingle(),

    svc.from('customer_orders')
      .select('id, fertig_am, created_at, typ')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),

    svc.from('sla_breaches')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),

    svc.from('delivery_carbon_snapshots')
      .select('eco_tour_pct, total_distance_km')
      .eq('location_id', locationId)
      .eq('snapshot_date', dateStr)
      .maybeSingle(),

    svc.from('driver_shift_snapshots')
      .select('active_minutes')
      .eq('location_id', locationId)
      .gte('snapshot_date', dateStr)
      .lte('snapshot_date', dateStr),
  ]);

  // Quality score dimension
  const qualScore = qualSnap.status === 'fulfilled' && qualSnap.value.data?.overall_score != null
    ? Number(qualSnap.value.data.overall_score)
    : 70;

  // Orders & SLA
  const orders = orderSnap(orderStats);
  const totalOrders = orders.length;
  const completedDeliveries = orders.filter((o) => o.fertig_am != null).length;

  // On-time: fertig_am within 45 min of created_at
  const onTimeDeliveries = orders.filter((o) => {
    if (!o.fertig_am || !o.created_at) return false;
    const diffMin = (new Date(o.fertig_am as string).getTime() - new Date(o.created_at as string).getTime()) / 60000;
    return diffMin <= 45;
  }).length;

  const deliveryTimes = orders
    .filter((o) => o.fertig_am && o.created_at)
    .map((o) => (new Date(o.fertig_am as string).getTime() - new Date(o.created_at as string).getTime()) / 60000)
    .filter((m) => m > 0 && m < 240);

  const avgDeliveryMin = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length * 10) / 10
    : null;

  const slaBreachCount = slaData.status === 'fulfilled' ? (slaData.value.data?.length ?? 0) : 0;

  // SLA score: based on on-time rate (penalised by sla_breaches)
  const onTimePct = completedDeliveries > 0
    ? (onTimeDeliveries / completedDeliveries) * 100
    : 0;
  const slaScore = totalOrders >= MIN_ORDERS_FOR_SCORE
    ? clamp(onTimePct - slaBreachCount * 2)
    : 70;

  // Carbon score
  const ecoTourPct = carbonSnap.status === 'fulfilled' && carbonSnap.value.data?.eco_tour_pct != null
    ? Number(carbonSnap.value.data.eco_tour_pct)
    : null;
  const totalDistanceKm = carbonSnap.status === 'fulfilled' && carbonSnap.value.data?.total_distance_km != null
    ? Number(carbonSnap.value.data.total_distance_km)
    : null;
  const carbonScore = ecoTourPct != null ? clamp(ecoTourPct) : 50;

  // Throughput score
  const shiftRows = shiftData.status === 'fulfilled' ? (shiftData.value.data ?? []) : [];
  const totalActiveMin = shiftRows.reduce((acc, r) => acc + (Number(r.active_minutes) || 0), 0);
  const activeDriverHours = totalActiveMin > 0 ? Math.round(totalActiveMin / 60 * 10) / 10 : null;
  const ordersPerHour = activeDriverHours && activeDriverHours > 0
    ? totalOrders / activeDriverHours
    : null;
  // 0→0 score, 5+ orders/hour → 100 score (linear capped)
  const throughputScore = ordersPerHour != null
    ? clamp(ordersPerHour * 20)
    : totalOrders >= MIN_ORDERS_FOR_SCORE ? 50 : 50;

  // Efficiency score: avg delivery time vs TARGET_DELIVERY_MIN
  // 100 = ≤25 min, 0 = ≥60 min, linear in between
  const efficiencyScore = avgDeliveryMin != null && totalOrders >= MIN_ORDERS_FOR_SCORE
    ? clamp(((60 - avgDeliveryMin) / (60 - TARGET_DELIVERY_MIN)) * 100)
    : 70;

  const dims: BenchmarkDimensions = {
    qualityScore:    Math.round(qualScore * 100) / 100,
    slaScore:        Math.round(slaScore  * 100) / 100,
    carbonScore:     Math.round(carbonScore * 100) / 100,
    throughputScore: Math.round(throughputScore * 100) / 100,
    efficiencyScore: Math.round(efficiencyScore * 100) / 100,
  };

  return {
    dims,
    raw: {
      totalOrders,
      completedDeliveries,
      onTimeDeliveries,
      avgDeliveryMin,
      activeDriverHours,
      totalDistanceKm,
      ecoTourPct,
      slaBreachCount,
    },
  };
}

function orderSnap(
  result: PromiseSettledResult<{ data: { id: string; fertig_am: string | null; created_at: string | null; typ: string }[] | null; error: unknown }>
): { id: string; fertig_am: string | null; created_at: string | null; typ: string }[] {
  if (result.status !== 'fulfilled') return [];
  return result.value.data ?? [];
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export async function snapshotBenchmark(locationId: string): Promise<BenchmarkSnapshot> {
  const svc = createServiceClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const { dims, raw } = await computeBenchmark(locationId);
  const overall = clamp(
    dims.qualityScore    * 0.35 +
    dims.slaScore        * 0.25 +
    dims.throughputScore * 0.20 +
    dims.carbonScore     * 0.10 +
    dims.efficiencyScore * 0.10
  );

  const grade =
    overall >= 90 ? 'A' :
    overall >= 75 ? 'B' :
    overall >= 60 ? 'C' :
    overall >= 45 ? 'D' : 'F';

  const row = {
    location_id:          locationId,
    bench_date:           dateStr,
    quality_score:        dims.qualityScore,
    sla_score:            dims.slaScore,
    carbon_score:         dims.carbonScore,
    throughput_score:     dims.throughputScore,
    efficiency_score:     dims.efficiencyScore,
    total_orders:         raw.totalOrders,
    completed_deliveries: raw.completedDeliveries,
    on_time_deliveries:   raw.onTimeDeliveries,
    avg_delivery_min:     raw.avgDeliveryMin,
    active_driver_hours:  raw.activeDriverHours,
    total_distance_km:    raw.totalDistanceKm,
    eco_tour_pct:         raw.ecoTourPct,
    sla_breach_count:     raw.slaBreachCount,
    weakest_dimension:    weakest(dims),
  };

  const { error } = await svc
    .from('delivery_benchmarks')
    .upsert(row, { onConflict: 'location_id,bench_date' });

  if (error) throw new Error(`snapshotBenchmark: ${error.message}`);

  return {
    locationId,
    benchDate:           dateStr,
    qualityScore:        dims.qualityScore,
    slaScore:            dims.slaScore,
    carbonScore:         dims.carbonScore,
    throughputScore:     dims.throughputScore,
    efficiencyScore:     dims.efficiencyScore,
    overallScore:        Math.round(overall * 100) / 100,
    grade,
    totalOrders:         raw.totalOrders,
    completedDeliveries: raw.completedDeliveries,
    onTimeDeliveries:    raw.onTimeDeliveries,
    avgDeliveryMin:      raw.avgDeliveryMin,
    activeDriverHours:   raw.activeDriverHours,
    totalDistanceKm:     raw.totalDistanceKm,
    ecoTourPct:          raw.ecoTourPct,
    slaBreachCount:      raw.slaBreachCount,
    locationRank:        null,
    totalLocations:      null,
    weakestDimension:    weakest(dims),
  };
}

// ─── Batch ────────────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const { data: locs } = await svc
    .from('tenants')
    .select('id')
    .eq('active', true);

  const locationIds = (locs ?? []).map((l) => l.id as string);
  let snapshots = 0;
  let errors = 0;

  await Promise.allSettled(
    locationIds.map(async (id) => {
      try {
        await snapshotBenchmark(id);
        snapshots++;
      } catch {
        errors++;
      }
    })
  );

  // Backfill ranks after all snapshots are written
  if (snapshots > 0) {
    try {
      await svc.rpc('prune_old_benchmarks', { days_to_keep: 90 });
    } catch {
      // non-critical
    }
    // Re-read and rank today's snapshots
    const { data: todayRows } = await svc
      .from('delivery_benchmarks')
      .select('id, overall_score')
      .eq('bench_date', dateStr)
      .order('overall_score', { ascending: false });

    if (todayRows && todayRows.length > 0) {
      const total = todayRows.length;
      await Promise.allSettled(
        todayRows.map((r, idx) =>
          svc
            .from('delivery_benchmarks')
            .update({ location_rank: idx + 1, total_locations: total })
            .eq('id', r.id as string)
        )
      );
    }
  }

  return { locations: locationIds.length, snapshots, errors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getBenchmarkDashboard(locationId: string): Promise<BenchmarkDashboard> {
  const svc = createServiceClient();

  const [todaySnap, ySnap, trendRows, rankRows] = await Promise.allSettled([
    svc.from('delivery_benchmarks')
      .select('*')
      .eq('location_id', locationId)
      .order('bench_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    svc.from('delivery_benchmarks')
      .select('*')
      .eq('location_id', locationId)
      .order('bench_date', { ascending: false })
      .limit(2),

    svc.from('delivery_benchmarks')
      .select('bench_date,overall_score,grade,quality_score,sla_score,carbon_score,throughput_score,efficiency_score,location_rank,total_locations,total_orders,avg_delivery_min')
      .eq('location_id', locationId)
      .gte('bench_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .order('bench_date', { ascending: false }),

    svc.from('v_benchmark_ranking')
      .select('*')
      .order('live_rank', { ascending: true }),
  ]);

  const todayRow = todaySnap.status === 'fulfilled' ? todaySnap.value.data : null;
  const histRows = ySnap.status === 'fulfilled' ? (ySnap.value.data ?? []) : [];
  const yesterdayRow = histRows.length > 1 ? histRows[1] : null;
  const trend = trendRows.status === 'fulfilled' ? (trendRows.value.data ?? []) : [];
  const rankData = rankRows.status === 'fulfilled' ? (rankRows.value.data ?? []) : [];

  const weeklyScores = trend.slice(0, 7).map((r) => Number(r.overall_score));
  const weeklyAvg = weeklyScores.length > 0
    ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length * 10) / 10
    : 0;

  const mapRow = (r: Record<string, unknown> | null): BenchmarkSnapshot | null => {
    if (!r) return null;
    return {
      locationId:          r.location_id as string,
      benchDate:           r.bench_date as string,
      qualityScore:        Number(r.quality_score),
      slaScore:            Number(r.sla_score),
      carbonScore:         Number(r.carbon_score),
      throughputScore:     Number(r.throughput_score),
      efficiencyScore:     Number(r.efficiency_score),
      overallScore:        Number(r.overall_score),
      grade:               r.grade as string,
      totalOrders:         Number(r.total_orders),
      completedDeliveries: Number(r.completed_deliveries),
      onTimeDeliveries:    Number(r.on_time_deliveries),
      avgDeliveryMin:      r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
      activeDriverHours:   r.active_driver_hours != null ? Number(r.active_driver_hours) : null,
      totalDistanceKm:     r.total_distance_km != null ? Number(r.total_distance_km) : null,
      ecoTourPct:          r.eco_tour_pct != null ? Number(r.eco_tour_pct) : null,
      slaBreachCount:      Number(r.sla_breach_count ?? 0),
      locationRank:        r.location_rank != null ? Number(r.location_rank) : null,
      totalLocations:      r.total_locations != null ? Number(r.total_locations) : null,
      weakestDimension:    r.weakest_dimension as string | null,
    };
  };

  const ranking: BenchmarkRankRow[] = rankData.map((r) => ({
    locationId:      r.location_id as string,
    locationName:    r.location_name as string,
    benchDate:       r.bench_date as string,
    overallScore:    Number(r.overall_score),
    grade:           r.grade as string,
    liveRank:        Number(r.live_rank),
    liveTotal:       Number(r.live_total),
    qualityScore:    Number(r.quality_score),
    slaScore:        Number(r.sla_score),
    carbonScore:     Number(r.carbon_score),
    throughputScore: Number(r.throughput_score),
    efficiencyScore: Number(r.efficiency_score),
    totalOrders:     Number(r.total_orders),
    avgDeliveryMin:  r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    weakestDimension: r.weakest_dimension as string | null,
  }));

  // Best practice = #1 ranked location
  const top = ranking[0] ?? null;
  let bestPractice: BestPracticeExport | null = null;
  if (top) {
    const insights = (['quality', 'sla', 'throughput', 'carbon', 'efficiency'] as const).map((dim) => {
      const scores: Record<string, number> = {
        quality:     top.qualityScore,
        sla:         top.slaScore,
        throughput:  top.throughputScore,
        carbon:      top.carbonScore,
        efficiency:  top.efficiencyScore,
      };
      return {
        dimension: dim,
        score:     Math.round(scores[dim] * 10) / 10,
        tip:       DIMENSION_TIPS[dim],
      };
    });
    bestPractice = {
      locationId:   top.locationId,
      locationName: top.locationName,
      exportedAt:   new Date().toISOString(),
      snapshot:     top,
      insights,
    };
  }

  const trendMapped: BenchmarkTrendRow[] = trend.map((r) => ({
    benchDate:       r.bench_date as string,
    overallScore:    Number(r.overall_score),
    grade:           r.grade as string,
    qualityScore:    Number(r.quality_score),
    slaScore:        Number(r.sla_score),
    carbonScore:     Number(r.carbon_score),
    throughputScore: Number(r.throughput_score),
    efficiencyScore: Number(r.efficiency_score),
    locationRank:    r.location_rank != null ? Number(r.location_rank) : null,
    totalLocations:  r.total_locations != null ? Number(r.total_locations) : null,
    totalOrders:     Number(r.total_orders),
    avgDeliveryMin:  r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
  }));

  return {
    today:       mapRow(todayRow as Record<string, unknown> | null),
    yesterday:   mapRow(yesterdayRow as Record<string, unknown> | null),
    weeklyAvg,
    trend:       trendMapped,
    ranking,
    bestPractice,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportBestPractices(locationId: string): Promise<BestPracticeExport | null> {
  const dash = await getBenchmarkDashboard(locationId);
  return dash.bestPractice;
}

// ─── Prune ────────────────────────────────────────────────────────────────────

export async function pruneOldBenchmarks(daysToKeep = 90): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_benchmarks', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
