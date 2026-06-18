/**
 * lib/delivery/driver-wellbeing.ts — Phase 226
 *
 * Smart Driver Wellbeing Index
 *
 * Berechnet täglich einen Wellbeing-Score (0–100) pro Fahrer aus 4 Faktoren:
 *   fatigue_component      (25%): inverted fatigue score (100 - latest fatigue)
 *   satisfaction_component (35%): Zufriedenheits-Score des Vortages
 *   retention_component    (25%): Retention-Score des Vortages
 *   incentive_component    (15%): Incentive-Einnahmen der letzten 7d (€50=100)
 *
 * Tier-Schwellen: thriving ≥80 | healthy 60–79 | stressed 40–59 | burnout_risk <40
 *
 * Cron: snapshotAllLocations() täglich 04:00 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { issueManualBonus } from './driver-bonus';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type WellbeingTier = 'thriving' | 'healthy' | 'stressed' | 'burnout_risk';
export type InterventionType = 'rest_suggestion' | 'bonus' | 'message';

export interface WellbeingSnapshot {
  id: string;
  locationId: string;
  driverId: string;
  snapshotDate: string;
  wellbeingScore: number;
  wellbeingTier: WellbeingTier;
  fatigueComponent: number;
  satisfactionComponent: number;
  retentionComponent: number;
  incentiveComponent: number;
  latestFatigueScore: number | null;
  latestSatisfactionScore: number | null;
  latestRetentionScore: number | null;
  incentiveEur7d: number | null;
  interventionTriggered: boolean;
  interventionType: InterventionType | null;
  interventionAt: string | null;
  interventionBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WellbeingLeaderboardRow extends WellbeingSnapshot {
  driverName: string | null;
  authUserId: string | null;
  vehicleType: string | null;
  wellbeingRank: number;
}

export interface WellbeingOverview {
  locationId: string;
  totalDrivers: number;
  avgWellbeingScore: number;
  thrivingCount: number;
  healthyCount: number;
  stressedCount: number;
  burnoutRiskCount: number;
  interventionsToday: number;
}

export interface WellbeingTrendPoint {
  snapshotDate: string;
  avgWellbeingScore: number;
  thrivingCount: number;
  burnoutRiskCount: number;
}

export interface WellbeingDashboard {
  overview: WellbeingOverview | null;
  atRisk: WellbeingLeaderboardRow[];
  trend7d: WellbeingTrendPoint[];
  leaderboard: WellbeingLeaderboardRow[];
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function tierFromScore(score: number): WellbeingTier {
  if (score >= 80) return 'thriving';
  if (score >= 60) return 'healthy';
  if (score >= 40) return 'stressed';
  return 'burnout_risk';
}

function mapRow(row: Record<string, unknown>): WellbeingSnapshot {
  return {
    id:                     row.id as string,
    locationId:             row.location_id as string,
    driverId:               row.driver_id as string,
    snapshotDate:           row.snapshot_date as string,
    wellbeingScore:         Number(row.wellbeing_score),
    wellbeingTier:          row.wellbeing_tier as WellbeingTier,
    fatigueComponent:       Number(row.fatigue_component),
    satisfactionComponent:  Number(row.satisfaction_component),
    retentionComponent:     Number(row.retention_component),
    incentiveComponent:     Number(row.incentive_component),
    latestFatigueScore:     row.latest_fatigue_score != null ? Number(row.latest_fatigue_score) : null,
    latestSatisfactionScore:row.latest_satisfaction_score != null ? Number(row.latest_satisfaction_score) : null,
    latestRetentionScore:   row.latest_retention_score != null ? Number(row.latest_retention_score) : null,
    incentiveEur7d:         row.incentive_eur_7d != null ? Number(row.incentive_eur_7d) : null,
    interventionTriggered:  Boolean(row.intervention_triggered),
    interventionType:       (row.intervention_type as InterventionType | null) ?? null,
    interventionAt:         (row.intervention_at as string | null) ?? null,
    interventionBy:         (row.intervention_by as string | null) ?? null,
    createdAt:              row.created_at as string,
    updatedAt:              row.updated_at as string,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Core compute
// ────────────────────────────────────────────────────────────────────────────

export async function computeWellbeingScore(
  locationId: string,
  driverId: string,
): Promise<{
  wellbeingScore: number;
  wellbeingTier: WellbeingTier;
  fatigueComponent: number;
  satisfactionComponent: number;
  retentionComponent: number;
  incentiveComponent: number;
  latestFatigueScore: number | null;
  latestSatisfactionScore: number | null;
  latestRetentionScore: number | null;
  incentiveEur7d: number | null;
}> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // Parallel queries: fatigue, satisfaction, retention, incentives
  const [fatigueRes, satisfactionRes, retentionRes, incentiveRes] = await Promise.all([
    // Latest fatigue snapshot for this driver (any time today or yesterday)
    sb.from('driver_fatigue_snapshots')
      .select('fatigue_score')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .gte('snapshot_at', new Date(Date.now() - 2 * 86_400_000).toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest satisfaction score
    sb.from('driver_satisfaction_scores')
      .select('satisfaction_score')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .lte('score_date', today)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest retention score
    sb.from('driver_retention_scores')
      .select('retention_score')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .lte('score_date', today)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Incentive earnings last 7 days
    sb.from('driver_incentive_events')
      .select('amount_eur')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .eq('status', 'approved')
      .gte('created_at', sevenDaysAgo),
  ]);

  const latestFatigueScore   = fatigueRes.data?.fatigue_score != null ? Number(fatigueRes.data.fatigue_score) : null;
  const latestSatisfaction   = satisfactionRes.data?.satisfaction_score != null ? Number(satisfactionRes.data.satisfaction_score) : null;
  const latestRetention      = retentionRes.data?.retention_score != null ? Number(retentionRes.data.retention_score) : null;
  const incentiveEur7d       = incentiveRes.data
    ? incentiveRes.data.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.amount_eur), 0)
    : null;

  // Component scores (0–100 each)
  // Fatigue: inverted — high fatigue = low wellbeing
  const fatigueComponent = latestFatigueScore != null
    ? clamp(100 - latestFatigueScore)
    : 60; // neutral fallback when no data

  // Satisfaction: direct score (0–100)
  const satisfactionComponent = latestSatisfaction != null
    ? clamp(latestSatisfaction)
    : 60;

  // Retention: direct score (0–100)
  const retentionComponent = latestRetention != null
    ? clamp(latestRetention)
    : 60;

  // Incentive: €0=0, €25=50, €50+=100 (linear)
  const incentiveComponent = incentiveEur7d != null
    ? clamp((incentiveEur7d / 50) * 100)
    : 50;

  // Weighted composite
  const wellbeingScore = clamp(
    Math.round(
      fatigueComponent      * 0.25 +
      satisfactionComponent * 0.35 +
      retentionComponent    * 0.25 +
      incentiveComponent    * 0.15,
    ),
  );

  return {
    wellbeingScore,
    wellbeingTier: tierFromScore(wellbeingScore),
    fatigueComponent:      Math.round(fatigueComponent),
    satisfactionComponent: Math.round(satisfactionComponent),
    retentionComponent:    Math.round(retentionComponent),
    incentiveComponent:    Math.round(incentiveComponent),
    latestFatigueScore,
    latestSatisfactionScore: latestSatisfaction,
    latestRetentionScore:    latestRetention,
    incentiveEur7d,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshot
// ────────────────────────────────────────────────────────────────────────────

export async function snapshotAllDriversForLocation(locationId: string): Promise<{
  scored: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('active', true);

  if (!drivers?.length) return { scored: 0, errors: 0 };

  let scored = 0;
  let errors = 0;

  for (const d of drivers) {
    try {
      const result = await computeWellbeingScore(locationId, d.id as string);

      await sb.from('driver_wellbeing_snapshots').upsert({
        location_id:             locationId,
        driver_id:               d.id,
        snapshot_date:           today,
        wellbeing_score:         result.wellbeingScore,
        fatigue_component:       result.fatigueComponent,
        satisfaction_component:  result.satisfactionComponent,
        retention_component:     result.retentionComponent,
        incentive_component:     result.incentiveComponent,
        latest_fatigue_score:    result.latestFatigueScore,
        latest_satisfaction_score: result.latestSatisfactionScore,
        latest_retention_score:  result.latestRetentionScore,
        incentive_eur_7d:        result.incentiveEur7d,
      }, { onConflict: 'location_id,driver_id,snapshot_date' });

      scored++;
    } catch {
      errors++;
    }
  }

  return { scored, errors };
}

export async function snapshotAllLocations(): Promise<{
  locations: number;
  scored: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, scored: 0, errors: 0 };

  let totalScored = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    try {
      const res = await snapshotAllDriversForLocation(loc.id as string);
      totalScored += res.scored;
      totalErrors += res.errors;
    } catch {
      totalErrors++;
    }
  }

  return { locations: locations.length, scored: totalScored, errors: totalErrors };
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────

export async function getWellbeingDashboard(locationId: string): Promise<WellbeingDashboard> {
  const sb = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [overviewRes, atRiskRes, trendRes, leaderboardRes] = await Promise.all([
    // Overview row
    sb.from('v_driver_wellbeing_overview')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    // At-risk drivers (stressed + burnout_risk, latest snapshot)
    sb.from('v_driver_wellbeing_leaderboard')
      .select('*')
      .eq('location_id', locationId)
      .in('wellbeing_tier', ['stressed', 'burnout_risk'])
      .order('wellbeing_score', { ascending: true })
      .limit(20),

    // 7-day trend
    sb.from('driver_wellbeing_snapshots')
      .select('snapshot_date, wellbeing_score, wellbeing_tier')
      .eq('location_id', locationId)
      .gte('snapshot_date', sevenDaysAgo)
      .order('snapshot_date', { ascending: true }),

    // Full leaderboard (top 15)
    sb.from('v_driver_wellbeing_leaderboard')
      .select('*')
      .eq('location_id', locationId)
      .order('wellbeing_score', { ascending: false })
      .limit(15),
  ]);

  const overview: WellbeingOverview | null = overviewRes.data
    ? {
        locationId:           locationId,
        totalDrivers:         Number(overviewRes.data.total_drivers),
        avgWellbeingScore:    Number(overviewRes.data.avg_wellbeing_score),
        thrivingCount:        Number(overviewRes.data.thriving_count),
        healthyCount:         Number(overviewRes.data.healthy_count),
        stressedCount:        Number(overviewRes.data.stressed_count),
        burnoutRiskCount:     Number(overviewRes.data.burnout_risk_count),
        interventionsToday:   Number(overviewRes.data.interventions_today),
      }
    : null;

  const atRisk: WellbeingLeaderboardRow[] = (atRiskRes.data ?? []).map((row) => ({
    ...mapRow(row as Record<string, unknown>),
    driverName:    (row as Record<string, unknown>).driver_name as string | null,
    authUserId:    (row as Record<string, unknown>).auth_user_id as string | null,
    vehicleType:   (row as Record<string, unknown>).vehicle_type as string | null,
    wellbeingRank: Number((row as Record<string, unknown>).wellbeing_rank),
  }));

  // Aggregate trend by date
  const trendMap = new Map<string, { scores: number[]; thriving: number; burnout: number }>();
  for (const row of trendRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const d = r.snapshot_date as string;
    if (!trendMap.has(d)) trendMap.set(d, { scores: [], thriving: 0, burnout: 0 });
    const entry = trendMap.get(d)!;
    entry.scores.push(Number(r.wellbeing_score));
    if (r.wellbeing_tier === 'thriving') entry.thriving++;
    if (r.wellbeing_tier === 'burnout_risk') entry.burnout++;
  }

  const trend7d: WellbeingTrendPoint[] = Array.from(trendMap.entries()).map(([date, v]) => ({
    snapshotDate:      date,
    avgWellbeingScore: Math.round(v.scores.reduce((a, b) => a + b, 0) / (v.scores.length || 1)),
    thrivingCount:     v.thriving,
    burnoutRiskCount:  v.burnout,
  }));

  const leaderboard: WellbeingLeaderboardRow[] = (leaderboardRes.data ?? []).map((row) => ({
    ...mapRow(row as Record<string, unknown>),
    driverName:    (row as Record<string, unknown>).driver_name as string | null,
    authUserId:    (row as Record<string, unknown>).auth_user_id as string | null,
    vehicleType:   (row as Record<string, unknown>).vehicle_type as string | null,
    wellbeingRank: Number((row as Record<string, unknown>).wellbeing_rank),
  }));

  return { overview, atRisk, trend7d, leaderboard };
}

export async function getDriverWellbeing(
  locationId: string,
  driverId: string,
): Promise<WellbeingLeaderboardRow | null> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_driver_wellbeing_leaderboard')
    .select('*')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .maybeSingle();

  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...mapRow(row),
    driverName:    row.driver_name as string | null,
    authUserId:    row.auth_user_id as string | null,
    vehicleType:   row.vehicle_type as string | null,
    wellbeingRank: Number(row.wellbeing_rank),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Intervention
// ────────────────────────────────────────────────────────────────────────────

export async function triggerIntervention(
  locationId: string,
  driverId: string,
  interventionType: InterventionType,
  byUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Bonus intervention: issue €5 wellbeing bonus via driver-bonus
  if (interventionType === 'bonus') {
    try {
      await issueManualBonus({ locationId, driverId, bonusAmountEur: 5, notes: 'Wellbeing-Bonus (automatisch)' });
    } catch {
      // non-fatal — still mark intervention
    }
  }

  const { error } = await sb
    .from('driver_wellbeing_snapshots')
    .update({
      intervention_triggered: true,
      intervention_type:      interventionType,
      intervention_at:        new Date().toISOString(),
      intervention_by:        byUserId,
    })
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .eq('snapshot_date', today);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Prune
// ────────────────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_wellbeing_snapshots', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
