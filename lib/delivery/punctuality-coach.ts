/**
 * lib/delivery/punctuality-coach.ts
 *
 * Phase 268 — Fahrer-Pünktlichkeits-Coach
 *
 * Analyses per-driver delay causes from order_lifecycle_snapshots and
 * generates personalised coaching insights.
 *
 * Delay causes are identified by comparing the driver's stage averages
 * against the location-wide baseline for the same period:
 *   kitchen_prep_min → kitchen bottleneck (not driver's fault, but worth flagging)
 *   pickup_wait_min  → driver arriving late at the kitchen
 *   drive_min        → route/traffic issues
 *
 * Public API:
 *   analyzeDriverDelays(locationId, driverId, days)   → RawDelayAnalysis
 *   snapshotDriverCoaching(locationId, driverId, days) → PunctualityProfile
 *   snapshotAllDriversCoaching(locationId, days)       → BatchResult
 *   getPunctualityCoachDashboard(locationId)           → CoachingDashboard
 *   getDriverCoachingReport(locationId, driverId, days) → DriverCoachingReport
 *   pruneOldProfiles(daysToKeep)                       → { pruned }
 *
 * Cron: snapshotAllDriversCoaching() daily 04:30 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DelayCause = 'kitchen' | 'pickup_wait' | 'driving' | 'none';
export type ScoreTrend = 'improving' | 'stable' | 'declining';

export interface RawDelayAnalysis {
  driverId: string;
  locationId: string;
  ordersAnalyzed: number;
  onTimeCount: number;
  onTimeRate: number | null;
  avgDispatchWaitMin: number | null;
  avgKitchenPrepMin: number | null;
  avgPickupWaitMin: number | null;
  avgDriveMin: number | null;
  avgTotalMin: number | null;
  /** Location-wide baselines for the same period */
  baselineKitchenPrepMin: number | null;
  baselinePickupWaitMin: number | null;
  baselineDriveMin: number | null;
  /** Positive delta = driver is slower than location average */
  deltaKitchenPrepMin: number | null;
  deltaPickupWaitMin: number | null;
  deltaDriveMin: number | null;
  primaryDelayCause: DelayCause;
}

export interface PunctualityProfile {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  vehicleType: string | null;
  periodStart: string;
  periodEnd: string;
  analysisDays: number;
  ordersAnalyzed: number;
  onTimeCount: number;
  onTimeRate: number | null;
  avgDispatchWaitMin: number | null;
  avgKitchenPrepMin: number | null;
  avgPickupWaitMin: number | null;
  avgDriveMin: number | null;
  avgTotalMin: number | null;
  deltaKitchenPrepMin: number | null;
  deltaPickupWaitMin: number | null;
  deltaDriveMin: number | null;
  primaryDelayCause: DelayCause;
  coachingHints: string[];
  coachingScore: number | null;
  scoreTrend: ScoreTrend | null;
  scoreDelta: number | null;
  computedAt: string;
}

export interface CoachingDashboard {
  locationId: string;
  totalDrivers: number;
  driversBelowThreshold: number;
  avgCoachingScore: number | null;
  profiles: PunctualityProfile[];
  topDriver: PunctualityProfile | null;
  needsAttention: PunctualityProfile[];
}

export interface DriverCoachingReport {
  profile: PunctualityProfile;
  history: PunctualityProfile[];
  percentileRank: number | null;
}

export interface BatchResult {
  locationId: string;
  processed: number;
  saved: number;
  errors: number;
}

// ─── Internal DB row shapes ───────────────────────────────────────────────────

interface DbLifecycleRow {
  dispatch_wait_min: number | null;
  kitchen_prep_min: number | null;
  pickup_wait_min: number | null;
  drive_min: number | null;
  total_min: number | null;
  on_time: boolean | null;
}

interface DbBaselineRaw {
  kitchen_prep_min: number | null;
  pickup_wait_min: number | null;
  drive_min: number | null;
}

interface DbProfile {
  id: string;
  location_id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  analysis_days: number;
  orders_analyzed: number;
  on_time_count: number;
  on_time_rate: number | null;
  avg_dispatch_wait_min: number | null;
  avg_kitchen_prep_min: number | null;
  avg_pickup_wait_min: number | null;
  avg_drive_min: number | null;
  avg_total_min: number | null;
  delta_kitchen_prep_min: number | null;
  delta_pickup_wait_min: number | null;
  delta_drive_min: number | null;
  primary_delay_cause: string;
  coaching_hints: string[];
  coaching_score: number | null;
  score_trend: string | null;
  score_delta: number | null;
  computed_at: string;
  driver_name: string | null;
  vehicle_type: string | null;
}

interface DbDriverRow {
  id: string;
  name: string | null;
  fahrzeug: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round2(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100) / 100;
}

function primaryCause(
  deltaKitchen: number | null,
  deltaPickup: number | null,
  deltaDrive: number | null,
): DelayCause {
  const THRESHOLD = 1.5; // minutes above baseline to consider significant
  const candidates: { cause: DelayCause; delta: number }[] = [];
  if ((deltaKitchen ?? 0) > THRESHOLD) candidates.push({ cause: 'kitchen', delta: deltaKitchen! });
  if ((deltaPickup ?? 0) > THRESHOLD)  candidates.push({ cause: 'pickup_wait', delta: deltaPickup! });
  if ((deltaDrive ?? 0) > THRESHOLD)   candidates.push({ cause: 'driving', delta: deltaDrive! });
  if (!candidates.length) return 'none';
  return candidates.sort((a, b) => b.delta - a.delta)[0].cause;
}

function coachingHints(
  cause: DelayCause,
  onTimeRate: number | null,
  deltaPickup: number | null,
  deltaDrive: number | null,
  ordersAnalyzed: number,
): string[] {
  const hints: string[] = [];

  if (ordersAnalyzed < 5) {
    hints.push('Noch zu wenig Daten für eine vollständige Analyse. Bitte mehr Touren fahren.');
    return hints;
  }

  if (cause === 'pickup_wait') {
    hints.push('Du wartest überdurchschnittlich lange auf das Essen. Melde dich direkt beim Eintreffen in der Küche — das beschleunigt die Übergabe.');
    if ((deltaPickup ?? 0) > 4) {
      hints.push('Deine Abholzeit ist mehr als 4 Minuten langsamer als der Standort-Durchschnitt. Versuche, pünktlich zum geschätzten Fertigstellungszeitpunkt in der Küche zu sein.');
    }
  }

  if (cause === 'driving') {
    hints.push('Deine Fahrtzeiten liegen über dem Standort-Durchschnitt. Nutze die Navi-Funktion für die effizienteste Route und vermeide Umwege.');
    if ((deltaDrive ?? 0) > 5) {
      hints.push('Fahrtzeiten sind erheblich länger als der Durchschnitt. Prüfe ob dein Fahrzeug für die Tour-Zone geeignet ist (z. B. Fahrrad in langer Zone C/D).');
    }
  }

  if (cause === 'kitchen') {
    hints.push('Die Küche hat bei deinen Touren längere Vorbereitungszeiten. Das ist nicht dein Fehler — informiere den Dispatcher, damit er die Küche frühzeitig benachrichtigt.');
  }

  if ((onTimeRate ?? 100) < 70) {
    hints.push('Weniger als 70 % deiner Lieferungen waren pünktlich. Konzentriere dich auf den Hauptfaktor oben, um deine Pünktlichkeitsrate zu verbessern.');
  }

  if ((onTimeRate ?? 100) >= 90) {
    hints.push('Sehr gute Pünktlichkeit! Halte dieses Niveau und teile deine Erfahrungen mit neuen Fahrern.');
  }

  if (cause === 'none' && (onTimeRate ?? 0) >= 80) {
    hints.push('Alle Phasen liegen im Normbereich. Weiter so!');
  }

  return hints;
}

function computeScore(onTimeRate: number | null, cause: DelayCause, ordersAnalyzed: number): number | null {
  if (ordersAnalyzed < 3) return null;
  const base = onTimeRate ?? 50;
  const penalty: Record<DelayCause, number> = { none: 0, kitchen: 2, pickup_wait: 8, driving: 10 };
  return Math.max(0, Math.min(100, base - penalty[cause]));
}

function mapProfile(row: DbProfile): PunctualityProfile {
  return {
    id: row.id,
    locationId: row.location_id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleType: row.vehicle_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    analysisDays: row.analysis_days,
    ordersAnalyzed: row.orders_analyzed,
    onTimeCount: row.on_time_count,
    onTimeRate: row.on_time_rate,
    avgDispatchWaitMin: row.avg_dispatch_wait_min,
    avgKitchenPrepMin: row.avg_kitchen_prep_min,
    avgPickupWaitMin: row.avg_pickup_wait_min,
    avgDriveMin: row.avg_drive_min,
    avgTotalMin: row.avg_total_min,
    deltaKitchenPrepMin: row.delta_kitchen_prep_min,
    deltaPickupWaitMin: row.delta_pickup_wait_min,
    deltaDriveMin: row.delta_drive_min,
    primaryDelayCause: row.primary_delay_cause as DelayCause,
    coachingHints: row.coaching_hints ?? [],
    coachingScore: row.coaching_score,
    scoreTrend: row.score_trend as ScoreTrend | null,
    scoreDelta: row.score_delta,
    computedAt: row.computed_at,
  };
}

// ─── Core: Raw delay analysis ─────────────────────────────────────────────────

export async function analyzeDriverDelays(
  locationId: string,
  driverId: string,
  days = 14,
): Promise<RawDelayAnalysis> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Fetch lifecycle rows for orders driven by this driver
  const { data: rows, error } = await sb
    .from('order_lifecycle_snapshots')
    .select(`
      dispatch_wait_min,
      kitchen_prep_min,
      pickup_wait_min,
      drive_min,
      total_min,
      on_time,
      customer_orders!inner(
        mise_delivery_batches!inner(
          driver_id
        )
      )
    `)
    .eq('location_id', locationId)
    .gte('snapped_at', since)
    .not('drive_min', 'is', null)
    .eq('customer_orders.mise_delivery_batches.driver_id', driverId);

  if (error) throw new Error(`analyzeDriverDelays query failed: ${error.message}`);

  const typed = (rows ?? []) as unknown as (DbLifecycleRow & {
    customer_orders: { mise_delivery_batches: { driver_id: string } }[];
  })[];

  const ordersAnalyzed = typed.length;
  const onTimeCount = typed.filter(r => r.on_time === true).length;
  const onTimeRate = ordersAnalyzed > 0
    ? round2((onTimeCount / ordersAnalyzed) * 100)
    : null;

  const avgDispatchWaitMin = round2(avg(typed.map(r => r.dispatch_wait_min)));
  const avgKitchenPrepMin  = round2(avg(typed.map(r => r.kitchen_prep_min)));
  const avgPickupWaitMin   = round2(avg(typed.map(r => r.pickup_wait_min)));
  const avgDriveMin        = round2(avg(typed.map(r => r.drive_min)));
  const avgTotalMin        = round2(avg(typed.map(r => r.total_min)));

  // Location-wide baseline (all drivers, same period)
  const { data: baseRow } = await sb
    .from('order_lifecycle_snapshots')
    .select('kitchen_prep_min, pickup_wait_min, drive_min')
    .eq('location_id', locationId)
    .gte('snapped_at', since)
    .not('drive_min', 'is', null);

  const baseRows = ((baseRow ?? []) as DbBaselineRaw[]);
  const baselineKitchenPrepMin = round2(avg(baseRows.map(r => r.kitchen_prep_min)));
  const baselinePickupWaitMin  = round2(avg(baseRows.map(r => r.pickup_wait_min)));
  const baselineDriveMin       = round2(avg(baseRows.map(r => r.drive_min)));

  const deltaKitchenPrepMin = avgKitchenPrepMin !== null && baselineKitchenPrepMin !== null
    ? round2(avgKitchenPrepMin - baselineKitchenPrepMin)
    : null;
  const deltaPickupWaitMin = avgPickupWaitMin !== null && baselinePickupWaitMin !== null
    ? round2(avgPickupWaitMin - baselinePickupWaitMin)
    : null;
  const deltaDriveMin = avgDriveMin !== null && baselineDriveMin !== null
    ? round2(avgDriveMin - baselineDriveMin)
    : null;

  const cause = primaryCause(deltaKitchenPrepMin, deltaPickupWaitMin, deltaDriveMin);

  return {
    driverId,
    locationId,
    ordersAnalyzed,
    onTimeCount,
    onTimeRate,
    avgDispatchWaitMin,
    avgKitchenPrepMin,
    avgPickupWaitMin,
    avgDriveMin,
    avgTotalMin,
    baselineKitchenPrepMin,
    baselinePickupWaitMin,
    baselineDriveMin,
    deltaKitchenPrepMin,
    deltaPickupWaitMin,
    deltaDriveMin,
    primaryDelayCause: cause,
  };
}

// ─── Snapshot: compute + persist one driver ───────────────────────────────────

export async function snapshotDriverCoaching(
  locationId: string,
  driverId: string,
  days = 14,
): Promise<PunctualityProfile> {
  const sb = createServiceClient();

  const analysis = await analyzeDriverDelays(locationId, driverId, days);

  const hints = coachingHints(
    analysis.primaryDelayCause,
    analysis.onTimeRate,
    analysis.deltaPickupWaitMin,
    analysis.deltaDriveMin,
    analysis.ordersAnalyzed,
  );
  const score = computeScore(analysis.onTimeRate, analysis.primaryDelayCause, analysis.ordersAnalyzed);

  // Determine trend by comparing with most recent previous snapshot
  const { data: prev } = await sb
    .from('driver_punctuality_profiles')
    .select('coaching_score')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .order('period_end', { ascending: false })
    .limit(1)
    .single();

  let scoreTrend: ScoreTrend | null = null;
  let scoreDelta: number | null = null;
  if (prev && score !== null && prev.coaching_score !== null) {
    scoreDelta = round2(score - (prev.coaching_score as number));
    scoreTrend = (scoreDelta ?? 0) > 2 ? 'improving' : (scoreDelta ?? 0) < -2 ? 'declining' : 'stable';
  }

  const today = new Date().toISOString().slice(0, 10);
  const periodStart = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data: upserted, error } = await sb
    .from('driver_punctuality_profiles')
    .upsert(
      {
        location_id:             locationId,
        driver_id:               driverId,
        period_start:            periodStart,
        period_end:              today,
        analysis_days:           days,
        orders_analyzed:         analysis.ordersAnalyzed,
        on_time_count:           analysis.onTimeCount,
        on_time_rate:            analysis.onTimeRate,
        avg_dispatch_wait_min:   analysis.avgDispatchWaitMin,
        avg_kitchen_prep_min:    analysis.avgKitchenPrepMin,
        avg_pickup_wait_min:     analysis.avgPickupWaitMin,
        avg_drive_min:           analysis.avgDriveMin,
        avg_total_min:           analysis.avgTotalMin,
        delta_kitchen_prep_min:  analysis.deltaKitchenPrepMin,
        delta_pickup_wait_min:   analysis.deltaPickupWaitMin,
        delta_drive_min:         analysis.deltaDriveMin,
        primary_delay_cause:     analysis.primaryDelayCause,
        coaching_hints:          hints,
        coaching_score:          score,
        score_trend:             scoreTrend,
        score_delta:             scoreDelta,
      },
      { onConflict: 'location_id,driver_id,period_end' },
    )
    .select()
    .single();

  if (error) throw new Error(`snapshotDriverCoaching upsert failed: ${error.message}`);

  // Fetch driver name separately
  const { data: driver } = await sb
    .from('mise_drivers')
    .select('name, fahrzeug')
    .eq('id', driverId)
    .single();

  return mapProfile({
    ...(upserted as DbProfile),
    driver_name: (driver as DbDriverRow | null)?.name ?? null,
    vehicle_type: (driver as DbDriverRow | null)?.fahrzeug ?? null,
  });
}

// ─── Batch: all active drivers for a location ─────────────────────────────────

export async function snapshotAllDriversCoaching(
  locationId: string,
  days = 14,
): Promise<BatchResult> {
  const sb = createServiceClient();

  const { data: drivers, error } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('aktiv', true);

  if (error) throw new Error(`snapshotAllDriversCoaching fetch drivers failed: ${error.message}`);

  let saved = 0;
  let errors = 0;

  await Promise.allSettled(
    ((drivers ?? []) as { id: string }[]).map(async (d) => {
      try {
        await snapshotDriverCoaching(locationId, d.id, days);
        saved++;
      } catch {
        errors++;
      }
    }),
  );

  return { locationId, processed: (drivers ?? []).length, saved, errors };
}

// ─── Dashboard: overview of all drivers ──────────────────────────────────────

export async function getPunctualityCoachDashboard(locationId: string): Promise<CoachingDashboard> {
  const sb = createServiceClient();

  const { data: rows, error } = await sb
    .from('v_driver_punctuality_latest')
    .select('*')
    .eq('location_id', locationId)
    .order('coaching_score', { ascending: false });

  if (error) throw new Error(`getPunctualityCoachDashboard failed: ${error.message}`);

  const profiles = ((rows ?? []) as DbProfile[]).map(r => mapProfile(r));
  const scored = profiles.filter((p: PunctualityProfile) => p.coachingScore !== null);
  const avgScore = scored.length
    ? round2(scored.reduce((s: number, p: PunctualityProfile) => s + (p.coachingScore ?? 0), 0) / scored.length)
    : null;

  const THRESHOLD = 75;

  return {
    locationId,
    totalDrivers: profiles.length,
    driversBelowThreshold: profiles.filter((p: PunctualityProfile) => (p.coachingScore ?? 100) < THRESHOLD).length,
    avgCoachingScore: avgScore,
    profiles,
    topDriver: profiles[0] ?? null,
    needsAttention: profiles
      .filter((p: PunctualityProfile) => (p.coachingScore ?? 100) < THRESHOLD && p.ordersAnalyzed >= 5)
      .slice(0, 5),
  };
}

// ─── Detailed report for one driver ──────────────────────────────────────────

export async function getDriverCoachingReport(
  locationId: string,
  driverId: string,
  days = 14,
): Promise<DriverCoachingReport> {
  const sb = createServiceClient();

  // Ensure a fresh snapshot exists
  const profile = await snapshotDriverCoaching(locationId, driverId, days);

  // Historical profiles (last 10 periods)
  const { data: histRows } = await sb
    .from('driver_punctuality_profiles')
    .select('*')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .order('period_end', { ascending: false })
    .limit(10);

  // Percentile rank among all drivers
  const { data: rankRow } = await sb
    .from('v_driver_punctuality_ranking')
    .select('rank')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .single();

  const { data: totalRow } = await sb
    .from('v_driver_punctuality_ranking')
    .select('rank')
    .eq('location_id', locationId)
    .order('rank', { ascending: false })
    .limit(1)
    .single();

  let percentileRank: number | null = null;
  if (rankRow && totalRow && (rankRow as { rank: number }).rank && (totalRow as { rank: number }).rank) {
    const r = (rankRow as { rank: number }).rank;
    const total = (totalRow as { rank: number }).rank;
    percentileRank = Math.round((1 - (r - 1) / total) * 100);
  }

  const history = ((histRows ?? []) as DbProfile[]).map(r => mapProfile({
    ...r,
    driver_name: profile.driverName,
    vehicle_type: profile.vehicleType,
  }));

  return { profile, history, percentileRank };
}

// ─── Batch: all locations (for cron) ─────────────────────────────────────────

export interface AllLocationsBatchResult {
  locations: number;
  processed: number;
  saved: number;
  errors: number;
}

export async function snapshotPunctualityAllLocations(days = 14): Promise<AllLocationsBatchResult> {
  const sb = createServiceClient();
  const { data: locs, error } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (error) throw new Error(`snapshotPunctualityAllLocations fetch locations failed: ${error.message}`);

  let totalProcessed = 0;
  let totalSaved = 0;
  let totalErrors = 0;

  await Promise.allSettled(
    ((locs ?? []) as { id: string }[]).map(async (loc) => {
      try {
        const r = await snapshotAllDriversCoaching(loc.id, days);
        totalProcessed += r.processed;
        totalSaved += r.saved;
        totalErrors += r.errors;
      } catch {
        totalErrors++;
      }
    }),
  );

  return {
    locations: (locs ?? []).length,
    processed: totalProcessed,
    saved: totalSaved,
    errors: totalErrors,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function pruneOldProfiles(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_punctuality_profiles', { p_days: daysToKeep });
  if (error) throw new Error(`pruneOldProfiles failed: ${error.message}`);
  return { pruned: (data as number) ?? 0 };
}
