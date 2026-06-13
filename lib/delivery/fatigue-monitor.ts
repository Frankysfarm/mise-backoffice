/**
 * lib/delivery/fatigue-monitor.ts
 *
 * Phase 119: Smart Driver Fatigue & Shift Health Monitor
 *
 * Tracks fatigue indicators for every online driver and computes a risk score
 * (0–100, higher = more fatigued). Operators see real-time warnings before
 * safety or performance issues escalate.
 *
 * Fatigue Score Factors (0–100 total):
 *  A. Hours on shift         — 0h=0, 4h=20, 6h=35, 8h=55, 10h+=80  (max 40 pts)
 *  B. Speed drift            — avg delivery time slowing vs. shift start  (max 20 pts)
 *  C. Late-delivery rate     — fraction of deliveries past ETA           (max 20 pts)
 *  D. Break deprivation      — no break in >3h continuous work           (max 15 pts)
 *  E. Deliveries/hour surge  — too many stops in last hour (overload)    (max 5 pts)
 *
 * Risk levels: low (<30) · medium (30–54) · high (55–74) · critical (≥75)
 *
 * Cron: every 10 min (isRatingTick) for all online drivers.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Types
// ============================================================

export interface DriverFatigueSnapshot {
  id: string;
  locationId: string;
  driverId: string;
  snapshotAt: string;
  shiftId: string | null;
  hoursOnShift: number;
  shiftDeliveries: number;
  deliveriesLast60min: number;
  deliveriesLast30min: number;
  avgDeliveryMinShift: number | null;
  avgDeliveryMinLast3: number | null;
  lastDeliveryAgoMin: number | null;
  longestBreakMin: number;
  breakCount: number;
  speedDriftPct: number;
  lateDeliveriesShift: number;
  lateRateShift: number;
  fatigueScore: number;
  riskLevel: FatigueRiskLevel;
}

export type FatigueRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface FatigueAlert {
  id: string;
  locationId: string;
  driverId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  riskLevel: FatigueRiskLevel;
  fatigueScore: number;
  triggerReason: string;
  actionTaken: string;
  notes: string | null;
}

export interface DriverFatigueState {
  driverId: string;
  driverName: string;
  driverVehicle: string;
  driverState: string;
  snapshot: DriverFatigueSnapshot | null;
  openAlert: FatigueAlert | null;
}

export interface FatigueDashboard {
  locationId: string;
  asOf: string;
  driversMonitored: number;
  driversAtRisk: number;         // medium+high+critical
  criticalCount: number;
  avgFatigueScore: number;
  currentStates: DriverFatigueState[];
  trend24h: FatigueTrendBucket[];
  recentAlerts: FatigueAlertRow[];
  alertStats: FatigueAlertStats;
}

export interface FatigueTrendBucket {
  hourBucket: string;
  avgFatigueScore: number;
  maxFatigueScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
}

export interface FatigueAlertRow {
  id: string;
  driverId: string;
  driverName: string;
  riskLevel: FatigueRiskLevel;
  fatigueScore: number;
  triggerReason: string;
  actionTaken: string;
  triggeredAt: string;
  resolvedAt: string | null;
  minutesAgo: number;
}

export interface FatigueAlertStats {
  openCount: number;
  alerts24h: number;
  alerts7d: number;
  criticalOpen: number;
  driversAtRisk: number;
  avgOpenScore: number | null;
}

// ============================================================
// Score Computation
// ============================================================

interface ScoreInput {
  hoursOnShift: number;
  speedDriftPct: number;
  lateRateShift: number;
  lastDeliveryAgoMin: number | null;
  longestBreakMin: number;
  deliveriesLast60min: number;
}

function computeFatigueScore(input: ScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // A. Hours on shift (max 40 pts)
  const h = input.hoursOnShift;
  let hoursScore = 0;
  if (h >= 10) { hoursScore = 40; reasons.push('hours_exceeded_10'); }
  else if (h >= 8) { hoursScore = 30; reasons.push('hours_exceeded_8'); }
  else if (h >= 6) { hoursScore = 20; reasons.push('hours_exceeded_6'); }
  else if (h >= 4) { hoursScore = 10; }
  score += hoursScore;

  // B. Speed drift — slower than shift average (max 20 pts)
  const drift = input.speedDriftPct;
  if (drift >= 40) { score += 20; reasons.push('speed_drift_critical'); }
  else if (drift >= 25) { score += 14; reasons.push('speed_drift_high'); }
  else if (drift >= 15) { score += 8; }
  else if (drift >= 5) { score += 3; }

  // C. Late delivery rate (max 20 pts)
  const lateRate = input.lateRateShift;
  if (lateRate >= 0.5) { score += 20; reasons.push('late_rate_critical'); }
  else if (lateRate >= 0.35) { score += 14; reasons.push('late_rate_high'); }
  else if (lateRate >= 0.2) { score += 8; }
  else if (lateRate >= 0.1) { score += 3; }

  // D. Break deprivation (max 15 pts)
  // last_delivery_ago_min < 30 means driver is currently active (no break concern)
  // If driver has been continuously working > 3h without a break >15min:
  const breakDeprivation = input.longestBreakMin < 15 && input.hoursOnShift > 3;
  const continuousWork =
    input.lastDeliveryAgoMin != null && input.lastDeliveryAgoMin < 20 &&
    input.longestBreakMin < 15 && input.hoursOnShift >= 2;
  if (breakDeprivation && input.hoursOnShift >= 4) {
    score += 15;
    reasons.push('no_break_4h');
  } else if (continuousWork && input.hoursOnShift >= 2) {
    score += 7;
  }

  // E. Overload — too many deliveries in last 60 min (max 5 pts)
  if (input.deliveriesLast60min >= 10) { score += 5; reasons.push('overload_60min'); }
  else if (input.deliveriesLast60min >= 7) { score += 3; }

  const capped = Math.min(100, Math.max(0, Math.round(score)));
  return { score: capped, reasons };
}

function scoreToRisk(score: number): FatigueRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// ============================================================
// Core: snapshot one driver
// ============================================================

interface DeliveryRow {
  id: string;
  geliefert_am: string | null;
  eta_latest: string | null;
  created_at: string;
}

export async function snapshotDriverFatigue(
  locationId: string,
  driverId: string,
): Promise<DriverFatigueSnapshot | null> {
  const sb = createServiceClient();
  const now = new Date();

  // 1. Active shift
  const { data: shiftRow } = await sb
    .from('driver_shifts')
    .select('id, actual_start')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('actual_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const shiftStart: Date =
    shiftRow?.actual_start
      ? new Date(shiftRow.actual_start as string)
      : new Date(now.getTime() - 4 * 3_600_000); // fallback: assume 4h shift
  const hoursOnShift = (now.getTime() - shiftStart.getTime()) / 3_600_000;

  // 2. Deliveries this shift
  const { data: shiftDeliveries } = await sb
    .from('customer_orders')
    .select('id, geliefert_am, eta_latest, created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .gte('geliefert_am', shiftStart.toISOString())
    .order('geliefert_am', { ascending: true });

  const deliveries: DeliveryRow[] = (shiftDeliveries ?? []).map((r) => ({
    id: r.id as string,
    geliefert_am: r.geliefert_am as string | null,
    eta_latest: r.eta_latest as string | null,
    created_at: r.created_at as string,
  }));

  // Need at least 3 deliveries to compute drift
  const shiftCount = deliveries.length;

  // 3. Deliveries in last 60 / 30 min
  const ago60 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const ago30 = new Date(now.getTime() - 30 * 60_000).toISOString();
  const last60 = deliveries.filter((d) => d.geliefert_am && d.geliefert_am >= ago60).length;
  const last30 = deliveries.filter((d) => d.geliefert_am && d.geliefert_am >= ago30).length;

  // 4. Delivery time per delivery (minutes from order created to delivered)
  function deliveryMin(d: DeliveryRow): number | null {
    if (!d.geliefert_am) return null;
    return (new Date(d.geliefert_am).getTime() - new Date(d.created_at).getTime()) / 60_000;
  }

  const allMins = deliveries.map(deliveryMin).filter((m): m is number => m != null && m > 0 && m < 180);
  const avgShiftMin: number | null = allMins.length > 0
    ? allMins.reduce((a, b) => a + b, 0) / allMins.length
    : null;

  const last3Mins = allMins.slice(-3);
  const avgLast3Min: number | null = last3Mins.length > 0
    ? last3Mins.reduce((a, b) => a + b, 0) / last3Mins.length
    : null;

  // 5. Speed drift: % slower than first 3 deliveries of shift
  let speedDriftPct = 0;
  if (allMins.length >= 6) {
    const first3 = allMins.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const last3Avg = last3Mins.reduce((a, b) => a + b, 0) / last3Mins.length;
    speedDriftPct = first3 > 0 ? ((last3Avg - first3) / first3) * 100 : 0;
  }

  // 6. Last delivery ago
  const lastDelivered = deliveries.at(-1)?.geliefert_am;
  const lastDeliveryAgoMin: number | null = lastDelivered
    ? Math.round((now.getTime() - new Date(lastDelivered).getTime()) / 60_000)
    : null;

  // 7. Breaks: gaps > 15 min between deliveries
  let longestBreakMin = 0;
  let breakCount = 0;
  for (let i = 1; i < deliveries.length; i++) {
    const prev = deliveries[i - 1].geliefert_am;
    const curr = deliveries[i].geliefert_am;
    if (!prev || !curr) continue;
    const gap = (new Date(curr).getTime() - new Date(prev).getTime()) / 60_000;
    if (gap > 15) {
      breakCount++;
      if (gap > longestBreakMin) longestBreakMin = Math.round(gap);
    }
  }

  // 8. Late deliveries
  const lateDeliveries = deliveries.filter((d) => {
    if (!d.geliefert_am || !d.eta_latest) return false;
    return new Date(d.geliefert_am) > new Date(d.eta_latest);
  }).length;
  const lateRate = shiftCount > 0 ? lateDeliveries / shiftCount : 0;

  // 9. Compute score
  const { score, reasons } = computeFatigueScore({
    hoursOnShift,
    speedDriftPct,
    lateRateShift: lateRate,
    lastDeliveryAgoMin,
    longestBreakMin,
    deliveriesLast60min: last60,
  });
  const riskLevel = scoreToRisk(score);

  // 10. Upsert snapshot (round to nearest 10-min bucket to avoid duplicate explosion)
  const bucketAt = new Date(Math.floor(now.getTime() / 600_000) * 600_000).toISOString();

  const row = {
    location_id:            locationId,
    driver_id:              driverId,
    snapshot_at:            bucketAt,
    shift_id:               shiftRow?.id ?? null,
    hours_on_shift:         Math.round(hoursOnShift * 100) / 100,
    shift_deliveries:       shiftCount,
    deliveries_last_60min:  last60,
    deliveries_last_30min:  last30,
    avg_delivery_min_shift: avgShiftMin != null ? Math.round(avgShiftMin * 10) / 10 : null,
    avg_delivery_min_last3: avgLast3Min != null ? Math.round(avgLast3Min * 10) / 10 : null,
    last_delivery_ago_min:  lastDeliveryAgoMin,
    longest_break_min:      longestBreakMin,
    break_count:            breakCount,
    speed_drift_pct:        Math.round(speedDriftPct * 100) / 100,
    late_deliveries_shift:  lateDeliveries,
    late_rate_shift:        Math.round(lateRate * 1000) / 1000,
    fatigue_score:          score,
    risk_level:             riskLevel,
  };

  const { data: upserted, error } = await sb
    .from('driver_fatigue_snapshots')
    .upsert(row, { onConflict: 'driver_id,snapshot_at' })
    .select()
    .maybeSingle();

  if (error || !upserted) return null;

  // 11. Create/resolve fatigue alerts
  if (riskLevel === 'medium' || riskLevel === 'high' || riskLevel === 'critical') {
    await upsertFatigueAlert(locationId, driverId, riskLevel, score, reasons, upserted.id as string);
  } else {
    // Score dropped to low → resolve open alert
    await resolveDriverAlert(driverId);
  }

  return rowToSnapshot(upserted);
}

async function upsertFatigueAlert(
  locationId: string,
  driverId: string,
  riskLevel: FatigueRiskLevel,
  score: number,
  reasons: string[],
  snapshotId: string,
): Promise<void> {
  const sb = createServiceClient();

  // Check if open alert already exists (UNIQUE partial index prevents duplicates)
  const { data: existing } = await sb
    .from('driver_fatigue_alerts')
    .select('id, risk_level, fatigue_score')
    .eq('driver_id', driverId)
    .is('resolved_at', null)
    .maybeSingle();

  if (existing) {
    // Update existing alert if risk escalated
    if (score > (existing.fatigue_score as number)) {
      await sb
        .from('driver_fatigue_alerts')
        .update({
          risk_level:     riskLevel,
          fatigue_score:  score,
          trigger_reason: reasons.join('|'),
          snapshot_id:    snapshotId,
        })
        .eq('id', existing.id as string);
    }
    return;
  }

  // Create new alert
  await sb.from('driver_fatigue_alerts').insert({
    location_id:    locationId,
    driver_id:      driverId,
    risk_level:     riskLevel,
    fatigue_score:  score,
    trigger_reason: reasons.join('|') || 'score_threshold',
    action_taken:   'none',
    snapshot_id:    snapshotId,
  });
}

async function resolveDriverAlert(driverId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_fatigue_alerts')
    .update({ resolved_at: new Date().toISOString(), action_taken: 'auto_resolved' })
    .eq('driver_id', driverId)
    .is('resolved_at', null);
}

// ============================================================
// Batch: snapshot all online drivers for a location
// ============================================================

export async function snapshotFatigueAllDrivers(locationId: string): Promise<{
  drivers: number;
  snapshots: number;
  atRisk: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('state', 'online')
    .eq('active', true)
    .limit(30);

  if (!drivers || drivers.length === 0) {
    return { drivers: 0, snapshots: 0, atRisk: 0, errors: 0 };
  }

  let snapshots = 0;
  let atRisk = 0;
  let errors = 0;

  await Promise.all(
    drivers.map(async (d) => {
      try {
        const snap = await snapshotDriverFatigue(locationId, d.id as string);
        if (snap) {
          snapshots++;
          if (snap.riskLevel !== 'low') atRisk++;
        }
      } catch {
        errors++;
      }
    }),
  );

  return { drivers: drivers.length, snapshots, atRisk, errors };
}

/** Cron-Batch: alle aktiven Locations */
export async function snapshotFatigueAllLocations(): Promise<{
  locations: number;
  drivers: number;
  atRisk: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  if (!locs || locs.length === 0) {
    return { locations: 0, drivers: 0, atRisk: 0, errors: 0 };
  }

  let totalDrivers = 0;
  let totalAtRisk = 0;
  let totalErrors = 0;

  for (const loc of locs) {
    const r = await snapshotFatigueAllDrivers(loc.id as string).catch(() => ({
      drivers: 0, snapshots: 0, atRisk: 0, errors: 1,
    }));
    totalDrivers += r.drivers;
    totalAtRisk += r.atRisk;
    totalErrors += r.errors;
  }

  return {
    locations: locs.length,
    drivers:   totalDrivers,
    atRisk:    totalAtRisk,
    errors:    totalErrors,
  };
}

// ============================================================
// Dashboard
// ============================================================

export async function getFatigueDashboard(locationId: string): Promise<FatigueDashboard> {
  const sb = createServiceClient();

  const [currentRows, trendRows, alertRows, statsRow] = await Promise.all([
    sb
      .from('v_driver_fatigue_current')
      .select('*')
      .eq('location_id', locationId)
      .order('fatigue_score', { ascending: false })
      .limit(50),
    sb
      .from('v_fatigue_trend_24h')
      .select('*')
      .eq('location_id', locationId)
      .order('hour_bucket', { ascending: false })
      .limit(24),
    sb
      .from('driver_fatigue_alerts')
      .select('id, driver_id, risk_level, fatigue_score, trigger_reason, action_taken, triggered_at, resolved_at, mise_drivers!driver_id(name)')
      .eq('location_id', locationId)
      .order('triggered_at', { ascending: false })
      .limit(20),
    sb
      .from('v_fatigue_alert_stats')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  const currentStates: DriverFatigueState[] = (currentRows.data ?? []).map((r) => ({
    driverId:      r.driver_id as string,
    driverName:    r.driver_name as string,
    driverVehicle: r.driver_vehicle as string,
    driverState:   r.driver_state as string,
    snapshot: {
      id:                    r.id as string,
      locationId:            r.location_id as string,
      driverId:              r.driver_id as string,
      snapshotAt:            r.snapshot_at as string,
      shiftId:               r.shift_id as string | null,
      hoursOnShift:          Number(r.hours_on_shift),
      shiftDeliveries:       Number(r.shift_deliveries),
      deliveriesLast60min:   Number(r.deliveries_last_60min),
      deliveriesLast30min:   Number(r.deliveries_last_30min),
      avgDeliveryMinShift:   r.avg_delivery_min_shift != null ? Number(r.avg_delivery_min_shift) : null,
      avgDeliveryMinLast3:   r.avg_delivery_min_last3 != null ? Number(r.avg_delivery_min_last3) : null,
      lastDeliveryAgoMin:    r.last_delivery_ago_min != null ? Number(r.last_delivery_ago_min) : null,
      longestBreakMin:       Number(r.longest_break_min),
      breakCount:            Number(r.break_count),
      speedDriftPct:         Number(r.speed_drift_pct),
      lateDeliveriesShift:   Number(r.late_deliveries_shift),
      lateRateShift:         Number(r.late_rate_shift),
      fatigueScore:          Number(r.fatigue_score),
      riskLevel:             r.risk_level as FatigueRiskLevel,
    },
    openAlert: r.open_alert_id
      ? ({
          id:            r.open_alert_id as string,
          locationId,
          driverId:      r.driver_id as string,
          triggeredAt:   r.alert_triggered_at as string,
          resolvedAt:    null,
          riskLevel:     r.risk_level as FatigueRiskLevel,
          fatigueScore:  Number(r.fatigue_score),
          triggerReason: '',
          actionTaken:   r.alert_action as string,
          notes:         null,
        })
      : null,
  }));

  const trend24h: FatigueTrendBucket[] = (trendRows.data ?? []).map((r) => ({
    hourBucket:      r.hour_bucket as string,
    avgFatigueScore: Number(r.avg_fatigue_score),
    maxFatigueScore: Number(r.max_fatigue_score),
    criticalCount:   Number(r.critical_count),
    highCount:       Number(r.high_count),
    mediumCount:     Number(r.medium_count),
  }));

  const now = new Date().toISOString();
  const recentAlerts: FatigueAlertRow[] = (alertRows.data ?? []).map((r) => {
    const drv = Array.isArray(r.mise_drivers) ? r.mise_drivers[0] : r.mise_drivers;
    return {
      id:            r.id as string,
      driverId:      r.driver_id as string,
      driverName:    (drv as { name: string } | null)?.name ?? 'Unbekannt',
      riskLevel:     r.risk_level as FatigueRiskLevel,
      fatigueScore:  Number(r.fatigue_score),
      triggerReason: r.trigger_reason as string,
      actionTaken:   r.action_taken as string,
      triggeredAt:   r.triggered_at as string,
      resolvedAt:    r.resolved_at as string | null,
      minutesAgo:    Math.round(
        (new Date(now).getTime() - new Date(r.triggered_at as string).getTime()) / 60_000,
      ),
    };
  });

  const stats = statsRow.data;
  const alertStats: FatigueAlertStats = {
    openCount:      Number(stats?.open_count ?? 0),
    alerts24h:      Number(stats?.alerts_24h ?? 0),
    alerts7d:       Number(stats?.alerts_7d ?? 0),
    criticalOpen:   Number(stats?.critical_open ?? 0),
    driversAtRisk:  Number(stats?.drivers_at_risk ?? 0),
    avgOpenScore:   stats?.avg_open_score != null ? Number(stats.avg_open_score) : null,
  };

  const scores = currentStates.map((s) => s.snapshot?.fatigueScore ?? 0);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    locationId,
    asOf:              now,
    driversMonitored:  currentStates.length,
    driversAtRisk:     currentStates.filter((s) => s.snapshot && s.snapshot.riskLevel !== 'low').length,
    criticalCount:     currentStates.filter((s) => s.snapshot?.riskLevel === 'critical').length,
    avgFatigueScore:   avgScore,
    currentStates,
    trend24h,
    recentAlerts,
    alertStats,
  };
}

// ============================================================
// Alert management
// ============================================================

export async function resolveFatigueAlert(alertId: string, action: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_fatigue_alerts')
    .update({ resolved_at: new Date().toISOString(), action_taken: action })
    .eq('id', alertId)
    .is('resolved_at', null);
  return !error;
}

/** Cleanup: prune snapshots older than 30 days */
export async function pruneFatigueSnapshots(retainDays = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_fatigue_snapshots', { retain_days: retainDays });
  return (data as number | null) ?? 0;
}

// ============================================================
// Helpers
// ============================================================

function rowToSnapshot(r: Record<string, unknown>): DriverFatigueSnapshot {
  return {
    id:                    r.id as string,
    locationId:            r.location_id as string,
    driverId:              r.driver_id as string,
    snapshotAt:            r.snapshot_at as string,
    shiftId:               r.shift_id as string | null,
    hoursOnShift:          Number(r.hours_on_shift),
    shiftDeliveries:       Number(r.shift_deliveries),
    deliveriesLast60min:   Number(r.deliveries_last_60min),
    deliveriesLast30min:   Number(r.deliveries_last_30min),
    avgDeliveryMinShift:   r.avg_delivery_min_shift != null ? Number(r.avg_delivery_min_shift) : null,
    avgDeliveryMinLast3:   r.avg_delivery_min_last3 != null ? Number(r.avg_delivery_min_last3) : null,
    lastDeliveryAgoMin:    r.last_delivery_ago_min != null ? Number(r.last_delivery_ago_min) : null,
    longestBreakMin:       Number(r.longest_break_min),
    breakCount:            Number(r.break_count),
    speedDriftPct:         Number(r.speed_drift_pct),
    lateDeliveriesShift:   Number(r.late_deliveries_shift),
    lateRateShift:         Number(r.late_rate_shift),
    fatigueScore:          Number(r.fatigue_score),
    riskLevel:             r.risk_level as FatigueRiskLevel,
  };
}
