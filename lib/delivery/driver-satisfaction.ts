/**
 * lib/delivery/driver-satisfaction.ts — Phase 225
 *
 * Live Driver Satisfaction Score
 *
 * Berechnet einen kombinierten Zufriedenheits-Index (0–100) pro Fahrer aus:
 *   retention_component  (30%): Retention Score des heutigen Tages
 *   incentive_component  (25%): Incentive-Einnahmen der letzten 7d (€25 = 100)
 *   rating_component     (25%): Ø Bewertung der letzten 30d (1-5 Sterne → 0-100)
 *   ontime_component     (20%): Pünktlichkeitsrate der letzten 14d
 *
 * Tier-Schwellen: excellent ≥85 | good 70-84 | fair 55-69 | poor <55
 *
 * Cron: snapshotAllLocations() täglich 03:45 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type SatisfactionTier = 'excellent' | 'good' | 'fair' | 'poor';

export interface SatisfactionScore {
  id: string;
  locationId: string;
  driverId: string;
  scoreDate: string;
  satisfactionScore: number;
  satisfactionTier: SatisfactionTier;
  retentionComponent: number;
  incentiveComponent: number;
  ratingComponent: number;
  ontimeComponent: number;
  retentionScoreRaw: number | null;
  incentiveEur7d: number;
  avgRating30d: number | null;
  ontimeRate14d: number;
  deliveries7d: number;
}

export interface SatisfactionLeaderboardRow extends SatisfactionScore {
  driverName: string | null;
  driverPhone: string | null;
  vehicleType: string | null;
  rankPosition: number;
}

export interface SatisfactionOverview {
  locationId: string;
  totalDrivers: number;
  excellentCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  avgSatisfaction: number | null;
  latestScoreDate: string | null;
}

export interface SatisfactionDashboard {
  overview: SatisfactionOverview | null;
  leaderboard: SatisfactionLeaderboardRow[];
  trend7d: Array<{ scoreDate: string; avgScore: number }>;
  tierCounts: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function tierFromScore(score: number): SatisfactionTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'poor';
}

// ────────────────────────────────────────────────────────────────────────────
// Core: compute + upsert one driver
// ────────────────────────────────────────────────────────────────────────────

export async function computeSatisfactionScore(
  locationId: string,
  driverId: string,
): Promise<SatisfactionScore | null> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const d7ago  = new Date(now); d7ago.setDate(d7ago.getDate() - 7);
  const d14ago = new Date(now); d14ago.setDate(d14ago.getDate() - 14);
  const d30ago = new Date(now); d30ago.setDate(d30ago.getDate() - 30);

  const iso7  = d7ago.toISOString().slice(0, 10);
  const iso14 = d14ago.toISOString().slice(0, 10);
  const iso30 = d30ago.toISOString().slice(0, 10);

  // 3 parallel queries
  const [retentionRes, incentiveRes, ordersRes] = await Promise.all([
    // (1) Latest retention score
    svc
      .from('driver_retention_scores')
      .select('retention_score')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // (2) Incentive sum last 7d
    svc
      .from('driver_incentive_events')
      .select('amount_eur')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .in('status', ['approved', 'paid'])
      .gte('created_at', d7ago.toISOString()),

    // (3) Orders last 30d for rating + last 14d for ontime
    svc
      .from('customer_orders')
      .select('bestellt_am, driver_rating, on_time')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .eq('status', 'zugestellt')
      .gte('bestellt_am', iso30),
  ]);

  const retentionScoreRaw = retentionRes.data?.retention_score != null
    ? Number(retentionRes.data.retention_score)
    : null;

  const incentiveEur7d = (incentiveRes.data ?? [])
    .reduce((sum, e) => sum + Number(e.amount_eur ?? 0), 0);

  const orders = ordersRes.data ?? [];
  const orders30d = orders.filter(o => (o.bestellt_am as string) >= iso30);
  const orders14d = orders.filter(o => (o.bestellt_am as string) >= iso14);
  const orders7d  = orders.filter(o => (o.bestellt_am as string) >= iso7);

  const deliveries7d = orders7d.length;

  // avg_rating_30d: only count orders with a rating
  const ratedOrders = orders30d.filter(o => o.driver_rating != null);
  const avgRating30d = ratedOrders.length > 0
    ? ratedOrders.reduce((s, o) => s + Number(o.driver_rating), 0) / ratedOrders.length
    : null;

  // ontime_rate_14d: orders with on_time = true / total orders with on_time set
  const ontimeOrders = orders14d.filter(o => o.on_time != null);
  const ontimeRate14d = ontimeOrders.length > 0
    ? ontimeOrders.filter(o => o.on_time === true).length / ontimeOrders.length
    : 0;

  // ── component scores ─────────────────────────────────────────────────────
  const retentionComponent = clamp(retentionScoreRaw ?? 50);
  const incentiveComponent = clamp(Math.min(100, (incentiveEur7d / 25) * 100));
  const ratingComponent    = avgRating30d != null
    ? clamp((avgRating30d / 5) * 100)
    : 50;
  const ontimeComponent    = clamp(ontimeRate14d * 100);

  const satisfactionScore = clamp(
    retentionComponent * 0.30 +
    incentiveComponent * 0.25 +
    ratingComponent    * 0.25 +
    ontimeComponent    * 0.20
  );

  const satisfactionTier = tierFromScore(satisfactionScore);

  // ── upsert ───────────────────────────────────────────────────────────────
  const { data, error } = await svc
    .from('driver_satisfaction_scores')
    .upsert({
      location_id:           locationId,
      driver_id:             driverId,
      score_date:            today,
      satisfaction_score:    Math.round(satisfactionScore * 100) / 100,
      satisfaction_tier:     satisfactionTier,
      retention_component:   Math.round(retentionComponent * 100) / 100,
      incentive_component:   Math.round(incentiveComponent * 100) / 100,
      rating_component:      Math.round(ratingComponent * 100) / 100,
      ontime_component:      Math.round(ontimeComponent * 100) / 100,
      retention_score_raw:   retentionScoreRaw,
      incentive_eur_7d:      Math.round(incentiveEur7d * 100) / 100,
      avg_rating_30d:        avgRating30d != null ? Math.round(avgRating30d * 100) / 100 : null,
      ontime_rate_14d:       Math.round(ontimeRate14d * 10000) / 10000,
      deliveries_7d:         deliveries7d,
    }, { onConflict: 'location_id,driver_id,score_date' })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  return mapRow(data as Record<string, unknown>);
}

function mapRow(row: Record<string, unknown>): SatisfactionScore {
  return {
    id:                  row.id as string,
    locationId:          row.location_id as string,
    driverId:            row.driver_id as string,
    scoreDate:           row.score_date as string,
    satisfactionScore:   Number(row.satisfaction_score),
    satisfactionTier:    row.satisfaction_tier as SatisfactionTier,
    retentionComponent:  Number(row.retention_component),
    incentiveComponent:  Number(row.incentive_component),
    ratingComponent:     Number(row.rating_component),
    ontimeComponent:     Number(row.ontime_component),
    retentionScoreRaw:   row.retention_score_raw != null ? Number(row.retention_score_raw) : null,
    incentiveEur7d:      Number(row.incentive_eur_7d),
    avgRating30d:        row.avg_rating_30d != null ? Number(row.avg_rating_30d) : null,
    ontimeRate14d:       Number(row.ontime_rate_14d),
    deliveries7d:        Number(row.deliveries_7d),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Batch: all active drivers for one location
// ────────────────────────────────────────────────────────────────────────────

export async function snapshotAllDriversForLocation(locationId: string): Promise<{
  scored: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('active', true);

  if (!drivers?.length) return { scored: 0, errors: 0 };

  let scored = 0;
  let errors = 0;
  for (const d of drivers) {
    const result = await computeSatisfactionScore(locationId, d.id as string);
    if (result) scored++; else errors++;
  }
  return { scored, errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Cron batch
// ────────────────────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  scored: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('tenants')
    .select('id')
    .eq('is_active', true)
    .eq('module_delivery', true);

  if (!locations?.length) return { locations: 0, scored: 0, errors: 0 };

  let totalScored = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    const res = await snapshotAllDriversForLocation(loc.id as string);
    totalScored += res.scored;
    totalErrors += res.errors;
  }

  return { locations: locations.length, scored: totalScored, errors: totalErrors };
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────

export async function getSatisfactionDashboard(locationId: string): Promise<SatisfactionDashboard> {
  const svc = createServiceClient();

  const [overviewRes, leaderboardRes, trendRes] = await Promise.all([
    svc
      .from('v_driver_satisfaction_overview')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    svc
      .from('v_driver_satisfaction_leaderboard')
      .select('*')
      .eq('location_id', locationId)
      .order('rank_position', { ascending: true })
      .limit(10),

    svc
      .from('driver_satisfaction_scores')
      .select('score_date, satisfaction_score')
      .eq('location_id', locationId)
      .gte('score_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .order('score_date', { ascending: true }),
  ]);

  // Aggregate trend by date
  const trendMap = new Map<string, number[]>();
  for (const row of trendRes.data ?? []) {
    const d = row.score_date as string;
    if (!trendMap.has(d)) trendMap.set(d, []);
    trendMap.get(d)!.push(Number(row.satisfaction_score));
  }
  const trend7d = Array.from(trendMap.entries()).map(([scoreDate, scores]) => ({
    scoreDate,
    avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }));

  const ov = overviewRes.data;
  const overview: SatisfactionOverview | null = ov
    ? {
        locationId:      ov.location_id as string,
        totalDrivers:    Number(ov.total_drivers ?? 0),
        excellentCount:  Number(ov.excellent_count ?? 0),
        goodCount:       Number(ov.good_count ?? 0),
        fairCount:       Number(ov.fair_count ?? 0),
        poorCount:       Number(ov.poor_count ?? 0),
        avgSatisfaction: ov.avg_satisfaction != null ? Number(ov.avg_satisfaction) : null,
        latestScoreDate: (ov.latest_score_date as string | null) ?? null,
      }
    : null;

  const tierCounts = {
    excellent: ov ? Number(ov.excellent_count ?? 0) : 0,
    good:      ov ? Number(ov.good_count ?? 0) : 0,
    fair:      ov ? Number(ov.fair_count ?? 0) : 0,
    poor:      ov ? Number(ov.poor_count ?? 0) : 0,
  };

  const leaderboard: SatisfactionLeaderboardRow[] = (leaderboardRes.data ?? []).map(row => ({
    id:                  row.id as string,
    locationId:          row.location_id as string,
    driverId:            row.driver_id as string,
    scoreDate:           row.score_date as string,
    satisfactionScore:   Number(row.satisfaction_score),
    satisfactionTier:    row.satisfaction_tier as SatisfactionTier,
    retentionComponent:  Number(row.retention_component),
    incentiveComponent:  Number(row.incentive_component),
    ratingComponent:     Number(row.rating_component),
    ontimeComponent:     Number(row.ontime_component),
    retentionScoreRaw:   row.retention_score_raw != null ? Number(row.retention_score_raw) : null,
    incentiveEur7d:      Number(row.incentive_eur_7d),
    avgRating30d:        row.avg_rating_30d != null ? Number(row.avg_rating_30d) : null,
    ontimeRate14d:       Number(row.ontime_rate_14d),
    deliveries7d:        Number(row.deliveries_7d),
    driverName:          (row.driver_name as string | null) ?? null,
    driverPhone:         (row.driver_phone as string | null) ?? null,
    vehicleType:         (row.vehicle_type as string | null) ?? null,
    rankPosition:        Number(row.rank_position),
  }));

  return { overview, leaderboard, trend7d, tierCounts };
}

// ────────────────────────────────────────────────────────────────────────────
// Single driver
// ────────────────────────────────────────────────────────────────────────────

export async function getDriverSatisfaction(
  locationId: string,
  driverId: string,
): Promise<SatisfactionScore | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_satisfaction_scores')
    .select('*')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

// ────────────────────────────────────────────────────────────────────────────
// Prune
// ────────────────────────────────────────────────────────────────────────────

export async function pruneOldScores(daysToKeep = 90): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_satisfaction_scores', { days_to_keep: daysToKeep });
  return Number(data ?? 0);
}
