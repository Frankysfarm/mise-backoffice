/**
 * lib/delivery/tour-analytics.ts
 *
 * Tour Performance Analytics & Bundle Learning Engine — Phase 115.
 *
 * Records completed tour snapshots and surfaces efficiency insights
 * to drive continuous improvement of the bundling algorithm.
 *
 * Workflow:
 *  1. recordTourPerformance()        — fire-and-forget when tour → delivered
 *  2. getTourAnalyticsDashboard()    — admin dashboard: summary + trend + zones
 *  3. scanAndRecordCompletedTours()  — cron batch for backfill / catch-up
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourPerformanceSnapshot {
  id: string;
  locationId: string;
  batchId: string;
  driverId: string | null;
  bundleSize: number;
  plannedStops: number;
  actualStops: number;
  vehicleType: string;
  plannedEtaMin: number | null;
  actualDeliveryMin: number | null;
  foodTransitMin: number | null;
  onTimeStops: number;
  lateStops: number;
  totalRouteKm: number | null;
  avgDetourKm: number | null;
  bundleEfficiencyScore: number | null;
  zoneAStops: number;
  zoneBStops: number;
  zoneCStops: number;
  zoneDStops: number;
  firstPickupAt: string | null;
  lastDeliveryAt: string | null;
  completedAt: string;
}

export interface TourTrendDay {
  dayBerlin: string;
  totalTours: number;
  avgBundleSize: number | null;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  avgPlannedEtaMin: number | null;
  totalOnTime: number;
  totalLate: number;
  onTimePct: number | null;
  avgRouteKm: number | null;
  avgDetourKm: number | null;
}

export interface ZoneEfficiency {
  zone: string;
  totalStops: number;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

export interface AnalyticsSummary {
  totalTours30d: number;
  avgBundleSize: number | null;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  avgDetourKm: number | null;
  maxBundleSeen: number;
  multiStopTours: number;
  bundleRatePct: number | null;
}

export interface BundleRecommendations {
  optimalBundleSize: number;
  suggestedMaxDetourKm: number;
  worstZone: string | null;
  bestZone: string | null;
  insight: string;
}

export interface TourAnalyticsDashboard {
  summary: AnalyticsSummary | null;
  trend: TourTrendDay[];
  zoneEfficiency: ZoneEfficiency[];
  recommendations: BundleRecommendations;
  lastUpdated: string;
}

// ─── Score calculation ────────────────────────────────────────────────────────

/**
 * Computes a bundle efficiency score 0–100 for a completed tour.
 *
 * Components:
 *  40% SLA  — on_time_stops / total_stops
 *  30% ETA  — how close actual was to planned (capped ±30 min)
 *  30% Load — stops completed vs planned (waste reduction)
 */
function computeBundleEfficiencyScore(opts: {
  onTimeStops: number;
  totalStops: number;
  plannedEtaMin: number | null;
  actualDeliveryMin: number | null;
  plannedStops: number;
  actualStops: number;
}): number {
  const { onTimeStops, totalStops, plannedEtaMin, actualDeliveryMin, plannedStops, actualStops } =
    opts;

  const slaPct = totalStops > 0 ? onTimeStops / totalStops : 0;
  const slaScore = slaPct * 40;

  let etaScore = 30;
  if (plannedEtaMin != null && actualDeliveryMin != null) {
    const diffMin = actualDeliveryMin - plannedEtaMin;
    // +30 for on-time, sliding down to 0 at 30 min late
    etaScore = Math.max(0, 30 - Math.max(0, diffMin));
  }

  const loadPct = plannedStops > 0 ? Math.min(1, actualStops / plannedStops) : 1;
  const loadScore = loadPct * 30;

  return Math.round(slaScore + etaScore + loadScore);
}

// ─── recordTourPerformance ────────────────────────────────────────────────────

/**
 * Records a completed tour's performance snapshot.
 * Call fire-and-forget from the tour status update handler.
 */
export async function recordTourPerformance(batchId: string): Promise<void> {
  try {
    const sb = createServiceClient();

    // Load batch with stops
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select(
        `id, location_id, driver_id, state, created_at,
         mise_batch_stops(
           id, state, order_id, stop_type,
           eta_min, arrived_at, completed_at, lat, lng,
           customer_orders(
             id, delivery_zone, eta_earliest, eta_latest,
             fahrer_abgeholt_am, geliefert_am
           )
         ),
         delivery_drivers(vehicle)`,
      )
      .eq('id', batchId)
      .maybeSingle();

    if (!batch) return;

    type Stop = {
      id: string;
      state: string;
      stop_type: string;
      eta_min: number | null;
      arrived_at: string | null;
      completed_at: string | null;
      lat: number | null;
      lng: number | null;
      customer_orders: {
        id: string;
        delivery_zone: string | null;
        eta_earliest: string | null;
        eta_latest: string | null;
        fahrer_abgeholt_am: string | null;
        geliefert_am: string | null;
      } | null;
    };

    const stops: Stop[] = Array.isArray(batch.mise_batch_stops)
      ? (batch.mise_batch_stops as Stop[])
      : [];

    const dropoffStops = stops.filter((s) => s.stop_type === 'dropoff');
    const completedDropoffs = dropoffStops.filter((s) => s.state === 'delivered');
    const pickupStops = stops.filter((s) => s.stop_type === 'pickup');

    // Timestamps
    const pickupTimes = pickupStops
      .map((s) => s.arrived_at ?? s.completed_at)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    const firstPickupAt = pickupTimes.length > 0 ? new Date(Math.min(...pickupTimes)) : null;

    const deliveryTimes = completedDropoffs
      .map((s) => s.completed_at)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    const lastDeliveryAt = deliveryTimes.length > 0 ? new Date(Math.max(...deliveryTimes)) : null;

    const actualDeliveryMin =
      firstPickupAt && lastDeliveryAt
        ? (lastDeliveryAt.getTime() - firstPickupAt.getTime()) / 60_000
        : null;

    // ETA accuracy — compare actual delivery to eta_latest of last dropoff
    let plannedEtaMin: number | null = null;
    const batchCreatedAt = new Date(batch.created_at as string);
    const etaLatests = completedDropoffs
      .map((s) => s.customer_orders?.eta_latest)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    if (etaLatests.length > 0 && firstPickupAt) {
      const latestEta = Math.max(...etaLatests);
      plannedEtaMin = (latestEta - batchCreatedAt.getTime()) / 60_000;
    }

    // SLA — on time if delivered before eta_latest
    let onTimeStops = 0;
    let lateStops = 0;
    for (const stop of completedDropoffs) {
      const etaLatest = stop.customer_orders?.eta_latest;
      const deliveredAt = stop.completed_at;
      if (etaLatest && deliveredAt) {
        if (new Date(deliveredAt) <= new Date(etaLatest)) onTimeStops++;
        else lateStops++;
      }
    }

    // Zone breakdown
    let zA = 0, zB = 0, zC = 0, zD = 0;
    for (const stop of completedDropoffs) {
      const zone = stop.customer_orders?.delivery_zone;
      if (zone === 'A') zA++;
      else if (zone === 'B') zB++;
      else if (zone === 'C') zC++;
      else if (zone === 'D') zD++;
    }

    // Route km — sum haversine between consecutive stop coordinates
    const orderedStops = [...stops].sort((a, b) => {
      const ta = a.arrived_at ?? a.completed_at ?? '';
      const tb = b.arrived_at ?? b.completed_at ?? '';
      return ta.localeCompare(tb);
    });

    let totalRouteKm = 0;
    for (let i = 1; i < orderedStops.length; i++) {
      const prev = orderedStops[i - 1];
      const curr = orderedStops[i];
      if (prev.lat != null && prev.lng != null && curr.lat != null && curr.lng != null) {
        totalRouteKm += haversineKm(
          { lat: prev.lat, lng: prev.lng },
          { lat: curr.lat, lng: curr.lng },
        );
      }
    }

    // Avg detour: difference between route km per stop and direct km
    const avgDetourKm =
      completedDropoffs.length > 0 && totalRouteKm > 0
        ? totalRouteKm / completedDropoffs.length - (totalRouteKm / (stops.length || 1))
        : null;

    const vehicle = (
      Array.isArray(batch.delivery_drivers)
        ? (batch.delivery_drivers as { vehicle: string }[])[0]?.vehicle
        : (batch.delivery_drivers as { vehicle: string } | null)?.vehicle
    ) ?? 'car';

    const bundleSize = dropoffStops.length || 1;
    const plannedStops = dropoffStops.length;
    const actualStops = completedDropoffs.length;

    const bundleEfficiencyScore = computeBundleEfficiencyScore({
      onTimeStops,
      totalStops: actualStops || 1,
      plannedEtaMin,
      actualDeliveryMin,
      plannedStops,
      actualStops,
    });

    await sb.from('tour_performance_snapshots').upsert(
      {
        location_id: batch.location_id,
        batch_id: batchId,
        driver_id: batch.driver_id ?? null,
        bundle_size: bundleSize,
        planned_stops: plannedStops,
        actual_stops: actualStops,
        vehicle_type: vehicle,
        planned_eta_min: plannedEtaMin != null ? Math.round(plannedEtaMin * 10) / 10 : null,
        actual_delivery_min:
          actualDeliveryMin != null ? Math.round(actualDeliveryMin * 10) / 10 : null,
        food_transit_min:
          actualDeliveryMin != null ? Math.round(actualDeliveryMin * 10) / 10 : null,
        on_time_stops: onTimeStops,
        late_stops: lateStops,
        total_route_km: Math.round(totalRouteKm * 100) / 100,
        avg_detour_km: avgDetourKm != null ? Math.round(avgDetourKm * 100) / 100 : null,
        bundle_efficiency_score: bundleEfficiencyScore,
        zone_a_stops: zA,
        zone_b_stops: zB,
        zone_c_stops: zC,
        zone_d_stops: zD,
        first_pickup_at: firstPickupAt?.toISOString() ?? null,
        last_delivery_at: lastDeliveryAt?.toISOString() ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'batch_id' },
    );
  } catch {
    // fire-and-forget — never block the request
  }
}

// ─── getTourAnalyticsDashboard ────────────────────────────────────────────────

export async function getTourAnalyticsDashboard(
  locationId: string,
): Promise<TourAnalyticsDashboard> {
  const sb = createServiceClient();

  const [summaryRes, trendRes, zoneRes] = await Promise.all([
    sb
      .from('v_tour_analytics_summary')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('v_tour_performance_trend')
      .select('*')
      .eq('location_id', locationId)
      .order('day_berlin', { ascending: false })
      .limit(14),
    sb
      .from('v_bundle_efficiency_by_zone')
      .select('*')
      .eq('location_id', locationId),
  ]);

  const raw = summaryRes.data as Record<string, unknown> | null;
  const summary: AnalyticsSummary | null = raw
    ? {
        totalTours30d: Number(raw.total_tours_30d ?? 0),
        avgBundleSize: raw.avg_bundle_size != null ? Number(raw.avg_bundle_size) : null,
        avgEfficiencyScore:
          raw.avg_efficiency_score != null ? Number(raw.avg_efficiency_score) : null,
        avgDeliveryMin: raw.avg_delivery_min != null ? Number(raw.avg_delivery_min) : null,
        onTimePct: raw.on_time_pct != null ? Number(raw.on_time_pct) : null,
        avgDetourKm: raw.avg_detour_km != null ? Number(raw.avg_detour_km) : null,
        maxBundleSeen: Number(raw.max_bundle_seen ?? 1),
        multiStopTours: Number(raw.multi_stop_tours ?? 0),
        bundleRatePct: raw.bundle_rate_pct != null ? Number(raw.bundle_rate_pct) : null,
      }
    : null;

  const trend: TourTrendDay[] = (
    (trendRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    dayBerlin: r.day_berlin as string,
    totalTours: Number(r.total_tours ?? 0),
    avgBundleSize: r.avg_bundle_size != null ? Number(r.avg_bundle_size) : null,
    avgEfficiencyScore: r.avg_efficiency_score != null ? Number(r.avg_efficiency_score) : null,
    avgDeliveryMin: r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    avgPlannedEtaMin: r.avg_planned_eta_min != null ? Number(r.avg_planned_eta_min) : null,
    totalOnTime: Number(r.total_on_time ?? 0),
    totalLate: Number(r.total_late ?? 0),
    onTimePct: r.on_time_pct != null ? Number(r.on_time_pct) : null,
    avgRouteKm: r.avg_route_km != null ? Number(r.avg_route_km) : null,
    avgDetourKm: r.avg_detour_km != null ? Number(r.avg_detour_km) : null,
  }));

  const zoneEfficiency: ZoneEfficiency[] = (
    (zoneRes.data as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    zone: r.zone as string,
    totalStops: Number(r.total_stops ?? 0),
    avgEfficiencyScore: r.avg_efficiency_score != null ? Number(r.avg_efficiency_score) : null,
    avgDeliveryMin: r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    onTimePct: r.on_time_pct != null ? Number(r.on_time_pct) : null,
  }));

  const recommendations = buildRecommendations(summary, zoneEfficiency, trend);

  return {
    summary,
    trend,
    zoneEfficiency,
    recommendations,
    lastUpdated: new Date().toISOString(),
  };
}

function buildRecommendations(
  summary: AnalyticsSummary | null,
  zones: ZoneEfficiency[],
  trend: TourTrendDay[],
): BundleRecommendations {
  // Optimal bundle size: if efficiency stays high (>75) at high bundle sizes, keep it
  const avgBundle = summary?.avgBundleSize ?? 2;
  const avgEff = summary?.avgEfficiencyScore ?? 70;

  let optimalBundleSize = Math.round(avgBundle);
  if (avgEff < 60 && optimalBundleSize > 2) optimalBundleSize--;
  if (avgEff > 85 && optimalBundleSize < 4) optimalBundleSize++;

  // Suggested max detour: current avg + small buffer, capped 0.5–3 km
  const avgDetour = summary?.avgDetourKm ?? 1.5;
  const suggestedMaxDetourKm = Math.min(3.0, Math.max(0.5, Math.round((avgDetour * 1.2) * 10) / 10));

  // Worst and best zone by efficiency
  const zonesWithScore = zones.filter((z) => z.avgEfficiencyScore != null);
  const sortedZones = [...zonesWithScore].sort(
    (a, b) => (a.avgEfficiencyScore ?? 0) - (b.avgEfficiencyScore ?? 0),
  );
  const worstZone = sortedZones[0]?.zone ?? null;
  const bestZone = sortedZones[sortedZones.length - 1]?.zone ?? null;

  // Trend direction
  const recentTrend = trend.slice(0, 7);
  const olderTrend = trend.slice(7, 14);
  const recentAvgEff =
    recentTrend.length > 0
      ? recentTrend.reduce((s, d) => s + (d.avgEfficiencyScore ?? 0), 0) / recentTrend.length
      : null;
  const olderAvgEff =
    olderTrend.length > 0
      ? olderTrend.reduce((s, d) => s + (d.avgEfficiencyScore ?? 0), 0) / olderTrend.length
      : null;

  let insight = 'Nicht genug Daten für Empfehlungen.';
  if (summary && summary.totalTours30d > 5) {
    const effLabel = avgEff >= 80 ? 'sehr gut' : avgEff >= 65 ? 'gut' : 'verbesserungswürdig';
    const trendLabel =
      recentAvgEff != null && olderAvgEff != null
        ? recentAvgEff > olderAvgEff + 3
          ? ' Effizienz steigt (+' + Math.round(recentAvgEff - olderAvgEff) + ' Pkt).'
          : recentAvgEff < olderAvgEff - 3
          ? ' Effizienz sinkt (−' + Math.round(olderAvgEff - recentAvgEff) + ' Pkt).'
          : ' Effizienz stabil.'
        : '';
    const zoneHint =
      worstZone && bestZone && worstZone !== bestZone
        ? ` Zone ${worstZone} zeigt schwächste Performance — Fahrer mit Zone-${worstZone}-Affinität priorisieren.`
        : '';
    insight = `Ø Effizienz ${avgEff}% (${effLabel}).${trendLabel}${zoneHint}`;
  }

  return { optimalBundleSize, suggestedMaxDetourKm, worstZone, bestZone, insight };
}

// ─── Cron batch ───────────────────────────────────────────────────────────────

export interface TourAnalyticsScanResult {
  locations: number;
  toursProcessed: number;
  errors: number;
}

/**
 * Scans all locations for recently completed tours without snapshots
 * and records them. Runs nightly as cron backfill.
 */
export async function scanAndRecordCompletedTours(): Promise<TourAnalyticsScanResult> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // last 25h

  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id')
    .eq('state', 'delivered')
    .gte('updated_at', since)
    .limit(200);

  if (!batches || batches.length === 0) {
    return { locations: 0, toursProcessed: 0, errors: 0 };
  }

  // Find batches without snapshots
  const batchIds = batches.map((b) => b.id as string);
  const { data: existing } = await sb
    .from('tour_performance_snapshots')
    .select('batch_id')
    .in('batch_id', batchIds);

  const existingSet = new Set((existing ?? []).map((e) => e.batch_id as string));
  const missing = batches.filter((b) => !existingSet.has(b.id as string));

  let toursProcessed = 0;
  let errors = 0;
  const locationSet = new Set<string>();

  for (const batch of missing) {
    try {
      await recordTourPerformance(batch.id as string);
      toursProcessed++;
      locationSet.add(batch.location_id as string);
    } catch {
      errors++;
    }
  }

  return { locations: locationSet.size, toursProcessed, errors };
}
