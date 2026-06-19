/**
 * lib/delivery/performance-score.ts
 *
 * Phase 250: Delivery Performance Score Engine
 *
 * Täglicher aggregierter Standort-Score (0–100) aus 4 Dimensionen:
 *   35% Pünktlichkeit   (on_time_score)   — fertig_am ≤ eta_earliest
 *   30% Zufriedenheit   (satisfaction_score) — Ø Kundenbewertung 1–5 → 0–100
 *   20% Fahrerauslastung(utilization_score) — stops_completed / max_capacity_day
 *   15% Marge           (margin_score)    — aus delivery_profitability_snapshots
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceScoreSnapshot {
  locationId:         string;
  locationName?:      string;
  scoreDate:          string;
  onTimeScore:        number;
  onTimeRatePct:      number | null;
  totalDeliveries:    number;
  onTimeDeliveries:   number;
  satisfactionScore:  number;
  avgRating:          number | null;
  ratedOrders:        number;
  utilizationScore:   number;
  avgUtilizationPct:  number | null;
  activeDrivers:      number;
  marginScore:        number;
  avgMarginPct:       number | null;
  totalRevenueEur:    number;
  overallScore:       number;
  grade:              string;
  weakestDimension:   string | null;
}

export interface PerformanceTrendRow {
  scoreDate:    string;
  overallScore: number;
  grade:        string;
  onTimeScore:  number;
  satScore:     number;
  utilScore:    number;
  marginScore:  number;
}

export interface PerformanceDashboard {
  latest:       PerformanceScoreSnapshot | null;
  trend:        PerformanceTrendRow[];
  ranking:      { locationId: string; locationName: string; overallScore: number; grade: string; liveRank: number; totalLocations: number }[];
  recommendations: string[];
}

// ─── Grade helper ─────────────────────────────────────────────────────────────

function toGrade(score: number): string {
  if (score >= 92) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ─── Score computation ────────────────────────────────────────────────────────

export async function computePerformanceScore(locationId: string, targetDate?: string): Promise<PerformanceScoreSnapshot> {
  const sb = createServiceClient();
  const date = targetDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // yesterday
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  // ── Dimension 1: Pünktlichkeit ──────────────────────────────────────────────
  const { data: deliveries } = await sb
    .from('customer_orders')
    .select('fertig_am, eta_earliest, created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .not('fertig_am', 'is', null)
    .gte('fertig_am', dayStart)
    .lte('fertig_am', dayEnd);

  const totalDeliveries = deliveries?.length ?? 0;
  let onTimeDeliveries  = 0;
  let onTimeRatePct: number | null = null;

  if (totalDeliveries > 0) {
    onTimeDeliveries = (deliveries ?? []).filter(d => {
      if (!d.fertig_am || !d.eta_earliest) return false;
      return new Date(d.fertig_am) <= new Date(d.eta_earliest);
    }).length;
    onTimeRatePct = Math.round((onTimeDeliveries / totalDeliveries) * 10000) / 100;
  }

  // on_time_score: 0–100 (100 = 100% pünktlich, 0 = 0% pünktlich; linear)
  const onTimeScore = onTimeRatePct !== null ? Math.round(onTimeRatePct) : 0;

  // ── Dimension 2: Kundenzufriedenheit ────────────────────────────────────────
  const { data: ratings } = await sb
    .from('customer_orders')
    .select('rating')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('rating', 'is', null)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const ratedOrders = ratings?.length ?? 0;
  let avgRating: number | null = null;
  if (ratedOrders > 0) {
    const sum = (ratings ?? []).reduce((acc, r) => acc + (r.rating as number), 0);
    avgRating = Math.round((sum / ratedOrders) * 100) / 100;
  }

  // satisfaction_score: rating 1–5 mapped to 0–100 (linear: 1→0, 5→100)
  const satisfactionScore = avgRating !== null
    ? Math.max(0, Math.min(100, Math.round(((avgRating - 1) / 4) * 100)))
    : 0;

  // ── Dimension 3: Fahrerauslastung ────────────────────────────────────────────
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, current_capacity, max_capacity')
    .eq('active', true);

  // Count drivers who had at least one delivery on that day for this location
  const { data: activeOnDay } = await sb
    .from('customer_orders')
    .select('mise_driver_id')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('mise_driver_id', 'is', null)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const activeDriverIds = new Set((activeOnDay ?? []).map(o => o.mise_driver_id));
  const activeDrivers   = activeDriverIds.size;

  // Utilization = (actual deliveries per active driver) vs target (10 stops/day baseline)
  const TARGET_STOPS_PER_DRIVER = 10;
  let avgUtilizationPct: number | null = null;
  if (activeDrivers > 0) {
    const stopsPerDriver = totalDeliveries / activeDrivers;
    avgUtilizationPct = Math.round((stopsPerDriver / TARGET_STOPS_PER_DRIVER) * 10000) / 100;
  }

  // utilization_score: capped at 100 (over-utilized is still max 100)
  const utilizationScore = avgUtilizationPct !== null
    ? Math.min(100, Math.round(avgUtilizationPct))
    : 0;

  // ── Dimension 4: Marge ──────────────────────────────────────────────────────
  const { data: profSnap } = await sb
    .from('delivery_profitability_snapshots')
    .select('margin_pct, total_revenue_eur')
    .eq('location_id', locationId)
    .eq('snap_date', date)
    .maybeSingle();

  const avgMarginPct:    number | null = profSnap?.margin_pct ?? null;
  const totalRevenueEur: number        = profSnap?.total_revenue_eur ?? 0;

  // margin_score: target 35% margin = 100 points; 0% = 0 points; negative = 0
  const MARGIN_TARGET_PCT = 35;
  const marginScore = avgMarginPct !== null
    ? Math.max(0, Math.min(100, Math.round((avgMarginPct / MARGIN_TARGET_PCT) * 100)))
    : 0;

  // ── Gesamt-Score (gewichtet) ────────────────────────────────────────────────
  const overallScore = Math.round(
    onTimeScore        * 0.35 +
    satisfactionScore  * 0.30 +
    utilizationScore   * 0.20 +
    marginScore        * 0.15
  );

  const grade = toGrade(overallScore);

  // Schwächste Dimension
  const dims = [
    { key: 'on_time',      score: onTimeScore },
    { key: 'satisfaction', score: satisfactionScore },
    { key: 'utilization',  score: utilizationScore },
    { key: 'margin',       score: marginScore },
  ] as const;
  const weakestDimension = dims.reduce((a, b) => a.score <= b.score ? a : b).key;

  return {
    locationId,
    scoreDate:          date,
    onTimeScore,
    onTimeRatePct,
    totalDeliveries,
    onTimeDeliveries,
    satisfactionScore,
    avgRating,
    ratedOrders,
    utilizationScore,
    avgUtilizationPct,
    activeDrivers,
    marginScore,
    avgMarginPct,
    totalRevenueEur,
    overallScore,
    grade,
    weakestDimension,
  };
}

// ── Persist snapshot ──────────────────────────────────────────────────────────

export async function snapshotPerformanceScore(locationId: string, targetDate?: string): Promise<PerformanceScoreSnapshot> {
  const sb   = createServiceClient();
  const snap = await computePerformanceScore(locationId, targetDate);

  await sb.from('delivery_performance_scores').upsert({
    location_id:        snap.locationId,
    score_date:         snap.scoreDate,
    on_time_score:      snap.onTimeScore,
    on_time_rate_pct:   snap.onTimeRatePct,
    total_deliveries:   snap.totalDeliveries,
    on_time_deliveries: snap.onTimeDeliveries,
    satisfaction_score: snap.satisfactionScore,
    avg_rating:         snap.avgRating,
    rated_orders:       snap.ratedOrders,
    utilization_score:  snap.utilizationScore,
    avg_utilization_pct: snap.avgUtilizationPct,
    active_drivers:     snap.activeDrivers,
    margin_score:       snap.marginScore,
    avg_margin_pct:     snap.avgMarginPct,
    total_revenue_eur:  snap.totalRevenueEur,
    overall_score:      snap.overallScore,
    grade:              snap.grade,
    weakest_dimension:  snap.weakestDimension,
  }, { onConflict: 'location_id,score_date' });

  return snap;
}

// ── Cron batch ────────────────────────────────────────────────────────────────

export async function snapshotAllLocations(targetDate?: string): Promise<{
  locations: number; snapshots: number; errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let snapshots = 0;
  let errors    = 0;
  const ids = [...new Set((locs ?? []).map(l => l.id))];

  await Promise.all(ids.map(async id => {
    try {
      await snapshotPerformanceScore(id, targetDate);
      snapshots++;
    } catch {
      errors++;
    }
  }));

  return { locations: ids.length, snapshots, errors };
}

// ── Dashboard query ───────────────────────────────────────────────────────────

export async function getPerformanceDashboard(locationId: string): Promise<PerformanceDashboard> {
  const sb = createServiceClient();

  const [latestRes, trendRes, rankRes] = await Promise.all([
    // Latest snapshot
    sb.from('delivery_performance_scores')
      .select('*')
      .eq('location_id', locationId)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 30-day trend
    sb.from('delivery_performance_scores')
      .select('score_date, overall_score, grade, on_time_score, satisfaction_score, utilization_score, margin_score')
      .eq('location_id', locationId)
      .gte('score_date', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
      .order('score_date', { ascending: true }),

    // Ranking across all locations
    sb.from('v_performance_score_ranking')
      .select('location_id, location_name, overall_score, grade, live_rank, total_locations')
      .order('live_rank', { ascending: true }),
  ]);

  const latest = latestRes.data ? rowToSnapshot(latestRes.data) : null;
  const trend: PerformanceTrendRow[] = (trendRes.data ?? []).map(r => ({
    scoreDate:    r.score_date,
    overallScore: Number(r.overall_score),
    grade:        r.grade,
    onTimeScore:  Number(r.on_time_score),
    satScore:     Number(r.satisfaction_score),
    utilScore:    Number(r.utilization_score),
    marginScore:  Number(r.margin_score),
  }));

  const ranking = (rankRes.data ?? []).map(r => ({
    locationId:     r.location_id,
    locationName:   r.location_name ?? r.location_id,
    overallScore:   Number(r.overall_score),
    grade:          r.grade,
    liveRank:       Number(r.live_rank),
    totalLocations: Number(r.total_locations),
  }));

  const recommendations = buildRecommendations(latest);

  return { latest, trend, ranking, recommendations };
}

// ── Historical trend ──────────────────────────────────────────────────────────

export async function getPerformanceTrend(locationId: string, days = 30): Promise<PerformanceTrendRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data } = await sb
    .from('delivery_performance_scores')
    .select('score_date, overall_score, grade, on_time_score, satisfaction_score, utilization_score, margin_score')
    .eq('location_id', locationId)
    .gte('score_date', since)
    .order('score_date', { ascending: true });

  return (data ?? []).map(r => ({
    scoreDate:    r.score_date,
    overallScore: Number(r.overall_score),
    grade:        r.grade,
    onTimeScore:  Number(r.on_time_score),
    satScore:     Number(r.satisfaction_score),
    utilScore:    Number(r.utilization_score),
    marginScore:  Number(r.margin_score),
  }));
}

// ── Prune old snapshots ───────────────────────────────────────────────────────

export async function pruneOldPerformanceScores(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_performance_scores', { days_to_keep: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function rowToSnapshot(r: Record<string, unknown>): PerformanceScoreSnapshot {
  return {
    locationId:         r.location_id as string,
    locationName:       r.location_name as string | undefined,
    scoreDate:          r.score_date as string,
    onTimeScore:        Number(r.on_time_score),
    onTimeRatePct:      r.on_time_rate_pct != null ? Number(r.on_time_rate_pct) : null,
    totalDeliveries:    Number(r.total_deliveries ?? 0),
    onTimeDeliveries:   Number(r.on_time_deliveries ?? 0),
    satisfactionScore:  Number(r.satisfaction_score),
    avgRating:          r.avg_rating != null ? Number(r.avg_rating) : null,
    ratedOrders:        Number(r.rated_orders ?? 0),
    utilizationScore:   Number(r.utilization_score),
    avgUtilizationPct:  r.avg_utilization_pct != null ? Number(r.avg_utilization_pct) : null,
    activeDrivers:      Number(r.active_drivers ?? 0),
    marginScore:        Number(r.margin_score),
    avgMarginPct:       r.avg_margin_pct != null ? Number(r.avg_margin_pct) : null,
    totalRevenueEur:    Number(r.total_revenue_eur ?? 0),
    overallScore:       Number(r.overall_score),
    grade:              r.grade as string,
    weakestDimension:   r.weakest_dimension as string | null,
  };
}

function buildRecommendations(snap: PerformanceScoreSnapshot | null): string[] {
  if (!snap) return [];
  const recs: string[] = [];

  if (snap.onTimeScore < 70) {
    recs.push(`Pünktlichkeit verbessern: Nur ${snap.onTimeRatePct?.toFixed(1) ?? '?'}% der Lieferungen waren pünktlich. Küchen-Timing und Routen-Optimierung prüfen.`);
  }
  if (snap.satisfactionScore < 70) {
    const r = snap.avgRating?.toFixed(2) ?? '?';
    recs.push(`Kundenzufriedenheit steigern: Ø ${r}/5 Sterne. Fahrerschulungen und Feedback-Analyse anstoßen.`);
  }
  if (snap.utilizationScore < 60) {
    recs.push(`Fahrerauslastung optimieren: Durchschnittlich ${snap.avgUtilizationPct?.toFixed(1) ?? '?'}% der Zielauslastung. Schichtplanung und Bündelung überprüfen.`);
  }
  if (snap.marginScore < 60) {
    const m = snap.avgMarginPct?.toFixed(1) ?? '?';
    recs.push(`Marge erhöhen: Aktuelle Marge ${m}% (Ziel 35%). Liefergebühren oder Kosten optimieren.`);
  }
  if (recs.length === 0) {
    recs.push('Starke Performance! Alle Dimensionen im grünen Bereich. Weiter so!');
  }
  return recs;
}
