/**
 * lib/delivery/driver-retention.ts — Phase 223
 *
 * Smart Driver Retention Score Engine
 *
 * Berechnet täglich einen Retention-Score (0–100) pro Fahrer aus 5 Faktoren:
 *   shift_freq   (25%): Schicht-Buchungsfrequenz 30d vs. Vorperiode
 *   tip_trend    (20%): Trinkgeld-Trend 14d vs. Vorperiode
 *   incentive    (20%): Incentive-Einnahmen der letzten 30 Tage
 *   ontime_trend (20%): Pünktlichkeits-Trend 14d vs. Vorperiode
 *   noshow       (15%): No-Shows + offene Review-Flags in 14d
 *
 * Tier-Schwellen: stable ≥ 75 | monitor 55–74 | at_risk 35–54 | churning < 35
 *
 * Cron: snapshotAllLocations() täglich 03:15 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { issueManualBonus } from './driver-bonus';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type RetentionTier = 'stable' | 'monitor' | 'at_risk' | 'churning';
export type RetentionActionType = 'bonus_sent' | 'message_sent' | 'manual_check' | 'none';

export interface RetentionScore {
  id: string;
  locationId: string;
  driverId: string;
  scoreDate: string;
  retentionScore: number;
  retentionTier: RetentionTier;
  shiftFreqScore: number;
  tipTrendScore: number;
  incentiveScore: number;
  ontimeTrendScore: number;
  noshowScore: number;
  shiftsLast30d: number;
  shiftsPrev30d: number;
  tipEurLast14d: number;
  tipEurPrev14d: number;
  incentiveEur30d: number;
  ontimeRateLast14d: number;
  ontimeRatePrev14d: number;
  reviewFlagsOpen: number;
  noshowCount14d: number;
  actionTaken: RetentionActionType | null;
  actionTakenAt: string | null;
  creditEur: number | null;
}

export interface RetentionDriverRow extends RetentionScore {
  driverName: string | null;
  driverPhone: string | null;
  vehicleType: string | null;
  driverState: string | null;
}

export interface RetentionOverview {
  locationId: string;
  scoreDate: string;
  driversScored: number;
  countStable: number;
  countMonitor: number;
  countAtRisk: number;
  countChurning: number;
  avgScore: number | null;
  actionsTaken: number;
}

export interface RetentionDashboard {
  overview: RetentionOverview | null;
  atRiskDrivers: RetentionDriverRow[];
  recentActions: RetentionScore[];
  trend7d: Array<{ scoreDate: string; avgScore: number; atRisk: number; churning: number }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function tierFromScore(score: number): RetentionTier {
  if (score >= 75) return 'stable';
  if (score >= 55) return 'monitor';
  if (score >= 35) return 'at_risk';
  return 'churning';
}

// ────────────────────────────────────────────────────────────────────────────
// Score computation
// ────────────────────────────────────────────────────────────────────────────

interface RawSignals {
  shiftsLast30d: number;
  shiftsPrev30d: number;
  tipEurLast14d: number;
  tipEurPrev14d: number;
  incentiveEur30d: number;
  ontimeRateLast14d: number;
  ontimeRatePrev14d: number;
  reviewFlagsOpen: number;
  noshowCount14d: number;
}

function computeComponents(s: RawSignals): {
  shiftFreqScore: number;
  tipTrendScore: number;
  incentiveScore: number;
  ontimeTrendScore: number;
  noshowScore: number;
  retentionScore: number;
  retentionTier: RetentionTier;
} {
  // ── shift_freq (25%) ──
  // Perfect: same or more shifts. Zero shifts last 30d → 0.
  let shiftFreqScore: number;
  if (s.shiftsLast30d === 0 && s.shiftsPrev30d === 0) {
    shiftFreqScore = 60; // new driver, neutral
  } else if (s.shiftsPrev30d === 0) {
    shiftFreqScore = 100; // no prev data, assume good
  } else {
    const ratio = s.shiftsLast30d / s.shiftsPrev30d;
    // ratio 1.0 → 100, ratio 0.5 → 50, ratio 0 → 0
    shiftFreqScore = clamp(ratio * 100);
  }

  // ── tip_trend (20%) ──
  // Compare tip per delivery: if tips collapsed → low score
  let tipTrendScore: number;
  if (s.tipEurPrev14d <= 0 && s.tipEurLast14d <= 0) {
    tipTrendScore = 60; // no tips at all, neutral
  } else if (s.tipEurPrev14d <= 0) {
    tipTrendScore = 80; // only recent data
  } else {
    const tipRatio = s.tipEurLast14d / s.tipEurPrev14d;
    tipTrendScore = clamp(tipRatio * 100);
  }

  // ── incentive (20%) ──
  // Absolute scale: €0 → 0, €50+ → 100
  const incentiveScore = clamp((s.incentiveEur30d / 50) * 100);

  // ── ontime_trend (20%) ──
  // 0–1 ratio trend
  let ontimeTrendScore: number;
  if (s.ontimeRatePrev14d <= 0) {
    ontimeTrendScore = s.ontimeRateLast14d > 0 ? clamp(s.ontimeRateLast14d * 100) : 60;
  } else {
    const ontimeRatio = s.ontimeRateLast14d / s.ontimeRatePrev14d;
    // Also factor in the absolute value
    const absoluteFactor = clamp(s.ontimeRateLast14d * 100);
    ontimeTrendScore = clamp((ontimeRatio * 60) + (absoluteFactor * 0.4));
  }

  // ── noshow (15%) ──
  // Each no-show or open flag costs 20 pts from 100
  const noshowPenalty = (s.noshowCount14d * 20) + (s.reviewFlagsOpen * 15);
  const noshowScore = clamp(100 - noshowPenalty);

  // ── Weighted sum ──
  const retentionScore = clamp(
    shiftFreqScore   * 0.25 +
    tipTrendScore    * 0.20 +
    incentiveScore   * 0.20 +
    ontimeTrendScore * 0.20 +
    noshowScore      * 0.15
  );

  return {
    shiftFreqScore:   Math.round(shiftFreqScore * 100) / 100,
    tipTrendScore:    Math.round(tipTrendScore * 100) / 100,
    incentiveScore:   Math.round(incentiveScore * 100) / 100,
    ontimeTrendScore: Math.round(ontimeTrendScore * 100) / 100,
    noshowScore:      Math.round(noshowScore * 100) / 100,
    retentionScore:   Math.round(retentionScore * 100) / 100,
    retentionTier:    tierFromScore(retentionScore),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main: compute + upsert one driver
// ────────────────────────────────────────────────────────────────────────────

export async function computeRetentionScore(
  driverId: string,
  locationId: string,
): Promise<RetentionScore | null> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // date helpers
  const d30ago  = new Date(now); d30ago.setDate(d30ago.getDate() - 30);
  const d60ago  = new Date(now); d60ago.setDate(d60ago.getDate() - 60);
  const d14ago  = new Date(now); d14ago.setDate(d14ago.getDate() - 14);
  const d28ago  = new Date(now); d28ago.setDate(d28ago.getDate() - 28);

  const iso30  = d30ago.toISOString().slice(0, 10);
  const iso60  = d60ago.toISOString().slice(0, 10);
  const iso14  = d14ago.toISOString().slice(0, 10);
  const iso28  = d28ago.toISOString().slice(0, 10);

  // ── parallel queries ─────────────────────────────────────────────────────
  const [
    shiftsRes,
    tipsRes,
    incentivesRes,
    perfRes,
    flagsRes,
  ] = await Promise.all([
    // shifts last 30d vs prev 30d
    svc.from('mise_delivery_shifts')
      .select('id, start_time')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('start_time', iso60)
      .lte('start_time', today),

    // tips last 28d (split into 2 × 14d)
    svc.from('driver_tip_snapshots')
      .select('snapshot_date, total_eur')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('snapshot_date', iso28)
      .lte('snapshot_date', today),

    // incentives last 30d
    svc.from('driver_incentive_events')
      .select('amount_eur')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .in('status', ['approved', 'paid'])
      .gte('created_at', d30ago.toISOString()),

    // on-time rate last 28d from driver_performance_snapshots
    svc.from('driver_performance_snapshots')
      .select('snapshot_date, on_time_rate')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('snapshot_date', iso28)
      .lte('snapshot_date', today),

    // open review flags + no-shows in last 14d
    svc.from('driver_review_flags')
      .select('id, review_status, created_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .in('review_status', ['open', 'in_review']),
  ]);

  // ── aggregate signals ─────────────────────────────────────────────────────
  const shifts = shiftsRes.data ?? [];
  const shiftsLast30d = shifts.filter(s => s.start_time >= iso30).length;
  const shiftsPrev30d = shifts.filter(s => s.start_time >= iso60 && s.start_time < iso30).length;

  const tips = tipsRes.data ?? [];
  const tipEurLast14d = tips
    .filter(t => t.snapshot_date >= iso14)
    .reduce((sum, t) => sum + Number(t.total_eur ?? 0), 0);
  const tipEurPrev14d = tips
    .filter(t => t.snapshot_date >= iso28 && t.snapshot_date < iso14)
    .reduce((sum, t) => sum + Number(t.total_eur ?? 0), 0);

  const incentiveEur30d = (incentivesRes.data ?? [])
    .reduce((sum, e) => sum + Number(e.amount_eur ?? 0), 0);

  const perfs = perfRes.data ?? [];
  const perfLast14 = perfs.filter(p => p.snapshot_date >= iso14);
  const perfPrev14 = perfs.filter(p => p.snapshot_date >= iso28 && p.snapshot_date < iso14);
  const avgOntime = (arr: typeof perfLast14) =>
    arr.length > 0
      ? arr.reduce((s, p) => s + Number(p.on_time_rate ?? 0), 0) / arr.length
      : 0;
  const ontimeRateLast14d = avgOntime(perfLast14);
  const ontimeRatePrev14d = avgOntime(perfPrev14);

  const flags = flagsRes.data ?? [];
  const reviewFlagsOpen = flags.length;
  // no-shows tracked as review flags with reason no_show created in last 14d
  const noshowCount14d = flags.filter(f => {
    const d = new Date(f.created_at as string);
    return d >= d14ago;
  }).length;

  const signals: RawSignals = {
    shiftsLast30d,
    shiftsPrev30d,
    tipEurLast14d,
    tipEurPrev14d,
    incentiveEur30d,
    ontimeRateLast14d,
    ontimeRatePrev14d,
    reviewFlagsOpen,
    noshowCount14d,
  };

  const components = computeComponents(signals);

  // ── upsert ───────────────────────────────────────────────────────────────
  const { data, error } = await svc
    .from('driver_retention_scores')
    .upsert({
      location_id:          locationId,
      driver_id:            driverId,
      score_date:           today,
      retention_score:      components.retentionScore,
      retention_tier:       components.retentionTier,
      shift_freq_score:     components.shiftFreqScore,
      tip_trend_score:      components.tipTrendScore,
      incentive_score:      components.incentiveScore,
      ontime_trend_score:   components.ontimeTrendScore,
      noshow_score:         components.noshowScore,
      shifts_last_30d:      shiftsLast30d,
      shifts_prev_30d:      shiftsPrev30d,
      tip_eur_last_14d:     tipEurLast14d,
      tip_eur_prev_14d:     tipEurPrev14d,
      incentive_eur_30d:    incentiveEur30d,
      ontime_rate_last_14d: ontimeRateLast14d,
      ontime_rate_prev_14d: ontimeRatePrev14d,
      review_flags_open:    reviewFlagsOpen,
      noshow_count_14d:     noshowCount14d,
    }, { onConflict: 'location_id,driver_id,score_date' })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  return {
    id:                   data.id as string,
    locationId:           data.location_id as string,
    driverId:             data.driver_id as string,
    scoreDate:            data.score_date as string,
    retentionScore:       Number(data.retention_score),
    retentionTier:        data.retention_tier as RetentionTier,
    shiftFreqScore:       Number(data.shift_freq_score),
    tipTrendScore:        Number(data.tip_trend_score),
    incentiveScore:       Number(data.incentive_score),
    ontimeTrendScore:     Number(data.ontime_trend_score),
    noshowScore:          Number(data.noshow_score),
    shiftsLast30d:        Number(data.shifts_last_30d),
    shiftsPrev30d:        Number(data.shifts_prev_30d),
    tipEurLast14d:        Number(data.tip_eur_last_14d),
    tipEurPrev14d:        Number(data.tip_eur_prev_14d),
    incentiveEur30d:      Number(data.incentive_eur_30d),
    ontimeRateLast14d:    Number(data.ontime_rate_last_14d),
    ontimeRatePrev14d:    Number(data.ontime_rate_prev_14d),
    reviewFlagsOpen:      Number(data.review_flags_open),
    noshowCount14d:       Number(data.noshow_count_14d),
    actionTaken:          (data.action_taken as RetentionActionType | null) ?? null,
    actionTakenAt:        (data.action_taken_at as string | null) ?? null,
    creditEur:            data.credit_eur != null ? Number(data.credit_eur) : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Batch: all drivers for one location
// ────────────────────────────────────────────────────────────────────────────

export async function snapshotAllDriversForLocation(locationId: string): Promise<{
  scored: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId);

  if (!drivers?.length) return { scored: 0, errors: 0 };

  let scored = 0;
  let errors = 0;
  for (const d of drivers) {
    const result = await computeRetentionScore(d.id as string, locationId);
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

export async function getRetentionDashboard(locationId: string): Promise<RetentionDashboard> {
  const svc = createServiceClient();

  const [overviewRes, atRiskRes, actionsRes, trendRes] = await Promise.all([
    svc
      .from('v_retention_overview')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    svc
      .from('v_drivers_retention_risk')
      .select('*')
      .eq('location_id', locationId)
      .order('retention_score', { ascending: true })
      .limit(30),

    svc
      .from('driver_retention_scores')
      .select('*')
      .eq('location_id', locationId)
      .not('action_taken', 'is', null)
      .neq('action_taken', 'none')
      .order('action_taken_at', { ascending: false })
      .limit(20),

    svc
      .from('driver_retention_scores')
      .select('score_date, retention_score, retention_tier')
      .eq('location_id', locationId)
      .gte('score_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .order('score_date', { ascending: true }),
  ]);

  // aggregate trend by date
  const trendMap = new Map<string, { scores: number[]; atRisk: number; churning: number }>();
  for (const row of trendRes.data ?? []) {
    const d = row.score_date as string;
    if (!trendMap.has(d)) trendMap.set(d, { scores: [], atRisk: 0, churning: 0 });
    const entry = trendMap.get(d)!;
    entry.scores.push(Number(row.retention_score));
    if (row.retention_tier === 'at_risk') entry.atRisk++;
    if (row.retention_tier === 'churning') entry.churning++;
  }
  const trend7d = Array.from(trendMap.entries()).map(([scoreDate, e]) => ({
    scoreDate,
    avgScore: Math.round((e.scores.reduce((a, b) => a + b, 0) / e.scores.length) * 10) / 10,
    atRisk: e.atRisk,
    churning: e.churning,
  }));

  const ov = overviewRes.data;
  const overview: RetentionOverview | null = ov
    ? {
        locationId:    ov.location_id as string,
        scoreDate:     ov.score_date as string,
        driversScored: Number(ov.drivers_scored ?? 0),
        countStable:   Number(ov.count_stable ?? 0),
        countMonitor:  Number(ov.count_monitor ?? 0),
        countAtRisk:   Number(ov.count_at_risk ?? 0),
        countChurning: Number(ov.count_churning ?? 0),
        avgScore:      ov.avg_score != null ? Number(ov.avg_score) : null,
        actionsTaken:  Number(ov.actions_taken ?? 0),
      }
    : null;

  const mapRow = (row: Record<string, unknown>): RetentionDriverRow => ({
    id:                   row.id as string,
    locationId:           row.location_id as string,
    driverId:             row.driver_id as string,
    scoreDate:            row.score_date as string,
    retentionScore:       Number(row.retention_score),
    retentionTier:        row.retention_tier as RetentionTier,
    shiftFreqScore:       Number(row.shift_freq_score),
    tipTrendScore:        Number(row.tip_trend_score),
    incentiveScore:       Number(row.incentive_score),
    ontimeTrendScore:     Number(row.ontime_trend_score),
    noshowScore:          Number(row.noshow_score),
    shiftsLast30d:        Number(row.shifts_last_30d),
    shiftsPrev30d:        Number(row.shifts_prev_30d),
    tipEurLast14d:        Number(row.tip_eur_last_14d),
    tipEurPrev14d:        Number(row.tip_eur_prev_14d),
    incentiveEur30d:      Number(row.incentive_eur_30d),
    ontimeRateLast14d:    Number(row.ontime_rate_last_14d),
    ontimeRatePrev14d:    Number(row.ontime_rate_prev_14d),
    reviewFlagsOpen:      Number(row.review_flags_open),
    noshowCount14d:       Number(row.noshow_count_14d),
    actionTaken:          (row.action_taken as RetentionActionType | null) ?? null,
    actionTakenAt:        (row.action_taken_at as string | null) ?? null,
    creditEur:            row.credit_eur != null ? Number(row.credit_eur) : null,
    driverName:           (row.driver_name as string | null) ?? null,
    driverPhone:          (row.driver_phone as string | null) ?? null,
    vehicleType:          (row.vehicle_type as string | null) ?? null,
    driverState:          (row.driver_state as string | null) ?? null,
  });

  const mapScoreRow = (row: Record<string, unknown>): RetentionScore => ({
    id:                   row.id as string,
    locationId:           row.location_id as string,
    driverId:             row.driver_id as string,
    scoreDate:            row.score_date as string,
    retentionScore:       Number(row.retention_score),
    retentionTier:        row.retention_tier as RetentionTier,
    shiftFreqScore:       Number(row.shift_freq_score),
    tipTrendScore:        Number(row.tip_trend_score),
    incentiveScore:       Number(row.incentive_score),
    ontimeTrendScore:     Number(row.ontime_trend_score),
    noshowScore:          Number(row.noshow_score),
    shiftsLast30d:        Number(row.shifts_last_30d),
    shiftsPrev30d:        Number(row.shifts_prev_30d),
    tipEurLast14d:        Number(row.tip_eur_last_14d),
    tipEurPrev14d:        Number(row.tip_eur_prev_14d),
    incentiveEur30d:      Number(row.incentive_eur_30d),
    ontimeRateLast14d:    Number(row.ontime_rate_last_14d),
    ontimeRatePrev14d:    Number(row.ontime_rate_prev_14d),
    reviewFlagsOpen:      Number(row.review_flags_open),
    noshowCount14d:       Number(row.noshow_count_14d),
    actionTaken:          (row.action_taken as RetentionActionType | null) ?? null,
    actionTakenAt:        (row.action_taken_at as string | null) ?? null,
    creditEur:            row.credit_eur != null ? Number(row.credit_eur) : null,
  });

  return {
    overview,
    atRiskDrivers: (atRiskRes.data ?? []).map(r => mapRow(r as Record<string, unknown>)),
    recentActions: (actionsRes.data ?? []).map(r => mapScoreRow(r as Record<string, unknown>)),
    trend7d,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Action: bonus or message
// ────────────────────────────────────────────────────────────────────────────

export async function takeRetentionAction(opts: {
  scoreId:      string;
  driverId:     string;
  locationId:   string;
  actionType:   RetentionActionType;
  bonusEur?:    number;
  takenBy?:     string;
}): Promise<{ ok: boolean; creditId?: string }> {
  const svc = createServiceClient();

  let creditId: string | undefined;
  let creditEur: number | undefined;

  if (opts.actionType === 'bonus_sent' && opts.bonusEur && opts.bonusEur > 0) {
    try {
      const bonus = await issueManualBonus({
        locationId:     opts.locationId,
        driverId:       opts.driverId,
        bonusAmountEur: opts.bonusEur,
        notes:          'Fahrer-Retention Bonus (automatisch)',
      });
      creditId = bonus.id;
      creditEur = opts.bonusEur;
    } catch {
      // non-fatal: still mark action taken
    }
  }

  const { error } = await svc
    .from('driver_retention_scores')
    .update({
      action_taken:    opts.actionType,
      action_taken_at: new Date().toISOString(),
      action_taken_by: opts.takenBy ?? null,
      ...(creditId ? { credit_id: creditId, credit_eur: creditEur } : {}),
    })
    .eq('id', opts.scoreId)
    .eq('location_id', opts.locationId);

  return { ok: !error, creditId };
}

// ────────────────────────────────────────────────────────────────────────────
// Prune
// ────────────────────────────────────────────────────────────────────────────

export async function pruneOldRetentionScores(daysToKeep = 90): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_retention_scores', { days_to_keep: daysToKeep });
  return Number(data ?? 0);
}
