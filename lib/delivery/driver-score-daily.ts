/**
 * lib/delivery/driver-score-daily.ts — Phase 385
 *
 * Driver Score Daily Snapshots + Performance Drop Alerts.
 *
 * Ergänzt die wöchentlichen driver_score_history-Snapshots um tägliche Granularität:
 * Jeder Fahrer bekommt täglich einen Composite-Score (7-Tage-Rollfenster) persistiert.
 * Bei signifikanten Einbrüchen (>8 Punkte, Noten-Rückschritt, 3 Tage Abwärtstrend)
 * werden driver_score_drop_alerts erzeugt, die Manager im Admin-Panel sehen.
 *
 * Public API:
 *   snapshotDailyScore(driverId, locationId, date?)           — Tages-Snapshot für einen Fahrer
 *   snapshotDailyScoreForLocation(locationId, date?)          — Alle Fahrer einer Location
 *   snapshotDailyScoreAllLocations(date?)                     — Cron-Batch
 *   detectScoreDropAlerts(locationId)                         — Einbruch-Erkennung + Alerts
 *   detectScoreDropAlertsAllLocations()                       — Cron-Batch
 *   acknowledgeAlert(alertId, locationId, userId?)            — Alert quittieren
 *   getDriverDailyScoreTrend(driverId, locationId, days)      — Trend-Verlauf für einen Fahrer
 *   getLocationDailyScoreSummary(locationId, date?)           — Alle Fahrer-Scores eines Tages
 *   getPendingDropAlerts(locationId)                          — Offene Alerts für Admin-Panel
 *   pruneOldDailySnapshots(daysToKeep)                        — Cleanup
 *   pruneOldDropAlerts(daysToKeep)                            — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
export type AlertType = 'significant_drop' | 'consecutive_decline' | 'grade_regression';

export interface DailyScoreSnapshot {
  id: string;
  driverId: string;
  locationId: string;
  snapshotDate: string;
  compositeScore: number;
  grade: ScoreGrade;
  fPunctuality: number;
  fRating: number;
  fEfficiency: number;
  fReliability: number;
  fActivity: number;
  fVolume: number;
  fFeedback: number;
  dataPoints: number;
  createdAt: string;
}

export interface ScoreDropAlert {
  id: string;
  driverId: string;
  locationId: string;
  alertDate: string;
  scoreToday: number;
  scoreBaseline: number;
  dropMagnitude: number;
  gradeToday: ScoreGrade;
  gradeBaseline: ScoreGrade;
  alertType: AlertType;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  driverName: string | null;
  vehicle: 'bike' | 'car' | null;
}

export interface SnapshotResult {
  driverId: string;
  locationId: string;
  snapshotDate: string;
  compositeScore: number;
  grade: ScoreGrade;
  saved: boolean;
}

export interface BatchSnapshotResult {
  locations: number;
  snapshotDate: string;
  saved: number;
  errors: number;
}

export interface AlertDetectResult {
  locations?: number;
  alertsCreated: number;
  driversChecked: number;
  errors: number;
}

// ── Scoring-Hilfsfunktionen (spiegeln driver-score.ts) ────────────────────────

function gradeFromScore(score: number): ScoreGrade {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function gradeValue(g: ScoreGrade): number {
  const map: Record<ScoreGrade, number> = { 'A+': 5, A: 4, B: 3, C: 2, D: 1 };
  return map[g];
}

function scorePunctuality(onTimeRate: number | null): number {
  const r = onTimeRate ?? 0.7;
  return Math.round(Math.min(30, Math.max(0, r * 30)) * 100) / 100;
}

function scoreRating(avg: number | null): number {
  const r = avg ?? 4.0;
  return Math.round(Math.min(25, Math.max(0, ((r - 1) / 4) * 25)) * 100) / 100;
}

function scoreEfficiency(kmPerStop: number | null): number {
  if (kmPerStop === null) return 7;
  if (kmPerStop <= 1.0) return 15;
  if (kmPerStop <= 2.0) return 12;
  if (kmPerStop <= 3.0) return 9;
  if (kmPerStop <= 5.0) return 6;
  return 3;
}

function scoreReliability(score: number | null): number {
  const r = score ?? 50;
  return Math.round(Math.min(15, Math.max(0, (r / 100) * 15)) * 100) / 100;
}

function scoreActivity(avgActiveMinPerDay: number | null): number {
  const m = avgActiveMinPerDay ?? 0;
  if (m >= 300) return 10;
  if (m >= 180) return 8;
  if (m >= 90)  return 5;
  if (m >= 30)  return 2;
  return 0;
}

function scoreVolume(avgStopsPerDay: number | null): number {
  const s = avgStopsPerDay ?? 0;
  if (s >= 15) return 5;
  if (s >= 10) return 4;
  if (s >= 6)  return 3;
  if (s >= 3)  return 2;
  if (s >= 1)  return 1;
  return 0;
}

function scoreFeedback(avgCustomerRating: number | null): number {
  const r = avgCustomerRating ?? 4.0;
  return Math.round(Math.min(5, Math.max(0, ((r - 1) / 4) * 5)) * 100) / 100;
}

// ── Kernfunktion: Score für einen Fahrer + Datum berechnen ────────────────────

interface RawScoreData {
  compositeScore: number;
  grade: ScoreGrade;
  fPunctuality: number;
  fRating: number;
  fEfficiency: number;
  fReliability: number;
  fActivity: number;
  fVolume: number;
  fFeedback: number;
  dataPoints: number;
}

async function computeScoreForDate(
  driverId: string,
  locationId: string,
  endDate: string, // YYYY-MM-DD
  windowDays = 7,
): Promise<RawScoreData> {
  const svc = createServiceClient();

  const end = new Date(`${endDate}T23:59:59Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - windowDays + 1);
  start.setUTCHours(0, 0, 0, 0);

  const since = start.toISOString().slice(0, 10);

  // ── Performance-Snapshots laden ───────────────────────────────────────────
  const { data: snaps } = await svc
    .from('driver_performance_snapshots')
    .select('on_time_rate, avg_rating, total_distance_km, stops_completed, active_minutes')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .lte('snapshot_date', endDate);

  type SnapRow = {
    on_time_rate: number | null;
    avg_rating: number | null;
    total_distance_km: number | null;
    stops_completed: number | null;
    active_minutes: number | null;
  };
  const rows: SnapRow[] = (snaps ?? []) as SnapRow[];
  const dataPoints = rows.length;

  const otRows = rows.filter((r) => r.on_time_rate !== null);
  const onTimeRateAvg = otRows.length > 0
    ? otRows.reduce((s, r) => s + Number(r.on_time_rate), 0) / otRows.length
    : null;

  const ratingRows = rows.filter((r) => r.avg_rating !== null);
  const avgRating = ratingRows.length > 0
    ? ratingRows.reduce((s, r) => s + Number(r.avg_rating), 0) / ratingRows.length
    : null;

  const totalKm    = rows.reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0);
  const totalStops = rows.reduce((s, r) => s + Number(r.stops_completed ?? 0), 0);
  const kmPerStop  = totalStops > 0 ? totalKm / totalStops : null;

  const totalActiveMin = rows.reduce((s, r) => s + Number(r.active_minutes ?? 0), 0);
  const activeDays = rows.filter((r) => Number(r.active_minutes ?? 0) > 0).length;
  const avgActiveMinPerDay = activeDays > 0 ? totalActiveMin / activeDays : null;
  const avgStopsPerDay     = activeDays > 0 ? totalStops / activeDays : null;

  // ── Zuverlässigkeits-Score ────────────────────────────────────────────────
  let reliabilityScore: number | null = null;
  try {
    const { data: relRow } = await svc
      .from('driver_reliability_scores')
      .select('score')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .maybeSingle();
    if (relRow) reliabilityScore = Number((relRow as Record<string, unknown>).score);
  } catch { /* graceful: table may not exist yet */ }

  // ── Feedback-Score ────────────────────────────────────────────────────────
  let avgFeedbackRating: number | null = null;
  try {
    const { data: fbRows } = await svc
      .from('tour_feedback')
      .select('customer_rating')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('submitted_at', `${since}T00:00:00Z`)
      .not('customer_rating', 'is', null);

    const fbVals = ((fbRows ?? []) as { customer_rating: number | null }[])
      .map((r) => Number(r.customer_rating))
      .filter((v) => v > 0);
    if (fbVals.length > 0) avgFeedbackRating = fbVals.reduce((a, b) => a + b, 0) / fbVals.length;
  } catch { /* graceful */ }

  // ── Faktoren + Composite ──────────────────────────────────────────────────
  const fPunctuality = scorePunctuality(onTimeRateAvg);
  const fRating      = scoreRating(avgRating);
  const fEfficiency  = scoreEfficiency(kmPerStop);
  const fReliability = scoreReliability(reliabilityScore);
  const fActivity    = scoreActivity(avgActiveMinPerDay);
  const fVolume      = scoreVolume(avgStopsPerDay);
  const fFeedback    = scoreFeedback(avgFeedbackRating);

  const compositeScore = Math.min(100, Math.round(
    (fPunctuality + fRating + fEfficiency + fReliability + fActivity + fVolume + fFeedback) * 100,
  ) / 100);

  return {
    compositeScore,
    grade: gradeFromScore(compositeScore),
    fPunctuality,
    fRating,
    fEfficiency,
    fReliability,
    fActivity,
    fVolume,
    fFeedback,
    dataPoints,
  };
}

// ── Snapshot speichern ────────────────────────────────────────────────────────

export async function snapshotDailyScore(
  driverId: string,
  locationId: string,
  date?: string,
): Promise<SnapshotResult> {
  const svc = createServiceClient();
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const scores = await computeScoreForDate(driverId, locationId, snapshotDate);

  const { error } = await svc
    .from('driver_score_daily_snapshots')
    .upsert(
      {
        driver_id:       driverId,
        location_id:     locationId,
        snapshot_date:   snapshotDate,
        composite_score: scores.compositeScore,
        grade:           scores.grade,
        f_punctuality:   scores.fPunctuality,
        f_rating:        scores.fRating,
        f_efficiency:    scores.fEfficiency,
        f_reliability:   scores.fReliability,
        f_activity:      scores.fActivity,
        f_volume:        scores.fVolume,
        f_feedback:      scores.fFeedback,
        data_points:     scores.dataPoints,
        window_days:     7,
      } as Record<string, unknown>,
      { onConflict: 'driver_id,location_id,snapshot_date' },
    );

  if (error) {
    if (error.message.includes('driver_score_daily_snapshots')) {
      return { driverId, locationId, snapshotDate, compositeScore: scores.compositeScore, grade: scores.grade, saved: false };
    }
    throw error;
  }

  return {
    driverId,
    locationId,
    snapshotDate,
    compositeScore: scores.compositeScore,
    grade: scores.grade,
    saved: true,
  };
}

export async function snapshotDailyScoreForLocation(
  locationId: string,
  date?: string,
): Promise<{ saved: number; errors: number; snapshotDate: string }> {
  const svc = createServiceClient();
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('active', true);

  if (!drivers || drivers.length === 0) return { saved: 0, errors: 0, snapshotDate };

  let saved = 0;
  let errors = 0;

  for (const d of drivers) {
    try {
      const r = await snapshotDailyScore(d.id as string, locationId, snapshotDate);
      if (r.saved) saved++;
    } catch {
      errors++;
    }
  }

  return { saved, errors, snapshotDate };
}

export async function snapshotDailyScoreAllLocations(date?: string): Promise<BatchSnapshotResult> {
  const svc = createServiceClient();
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) return { locations: 0, snapshotDate, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => snapshotDailyScoreForLocation(l.id as string, snapshotDate)),
  );

  let saved = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { saved += r.value.saved; errors += r.value.errors; }
    else errors++;
  }

  return { locations: locs.length, snapshotDate, saved, errors };
}

// ── Alert-Erkennung ───────────────────────────────────────────────────────────

const SIGNIFICANT_DROP_THRESHOLD = 8;   // Punkte-Einbruch
const CONSECUTIVE_DECLINE_DAYS   = 3;   // Tage in Folge sinkend

export async function detectScoreDropAlerts(locationId: string): Promise<AlertDetectResult> {
  const svc = createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 8);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: rows } = await svc
    .from('driver_score_daily_snapshots')
    .select('driver_id, snapshot_date, composite_score, grade')
    .eq('location_id', locationId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: false });

  type SnapRow = { driver_id: string; snapshot_date: string; composite_score: number; grade: string };
  const snapshots = (rows ?? []) as SnapRow[];

  // Snapshots nach Fahrer gruppieren
  const byDriver = new Map<string, SnapRow[]>();
  for (const s of snapshots) {
    const existing = byDriver.get(s.driver_id) ?? [];
    existing.push(s);
    byDriver.set(s.driver_id, existing);
  }

  let alertsCreated = 0;
  const driversChecked = byDriver.size;

  for (const [driverId, driverSnaps] of byDriver) {
    const sorted = [...driverSnaps].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
    const latest = sorted[0];
    if (!latest || latest.snapshot_date !== today) continue; // kein heutiger Snapshot

    // Baseline: Durchschnitt der vorherigen 7 Tage
    const prev = sorted.slice(1);
    if (prev.length < 2) continue; // zu wenig Daten

    const baseline = prev.reduce((s, r) => s + Number(r.composite_score), 0) / prev.length;
    const scoreToday = Number(latest.composite_score);
    const dropMagnitude = baseline - scoreToday;

    const gradeToday    = latest.grade as ScoreGrade;
    const gradeBaseline = (prev[0]?.grade ?? 'D') as ScoreGrade;

    const alertsToCreate: AlertType[] = [];

    if (dropMagnitude >= SIGNIFICANT_DROP_THRESHOLD) {
      alertsToCreate.push('significant_drop');
    }

    if (gradeValue(gradeToday) < gradeValue(gradeBaseline)) {
      alertsToCreate.push('grade_regression');
    }

    // 3 aufeinanderfolgende Rückgänge
    if (sorted.length >= CONSECUTIVE_DECLINE_DAYS) {
      const last3 = sorted.slice(0, CONSECUTIVE_DECLINE_DAYS);
      const isDecline = last3.every((r, i) => {
        if (i === last3.length - 1) return true;
        return Number(r.composite_score) < Number(last3[i + 1]!.composite_score);
      });
      if (isDecline) alertsToCreate.push('consecutive_decline');
    }

    for (const alertType of alertsToCreate) {
      const { error } = await svc
        .from('driver_score_drop_alerts')
        .upsert(
          {
            driver_id:      driverId,
            location_id:    locationId,
            alert_date:     today,
            score_today:    scoreToday,
            score_baseline: Math.round(baseline * 100) / 100,
            drop_magnitude: Math.round(dropMagnitude * 100) / 100,
            grade_today:    gradeToday,
            grade_baseline: gradeBaseline,
            alert_type:     alertType,
            acknowledged:   false,
          } as Record<string, unknown>,
          { onConflict: 'driver_id,location_id,alert_date,alert_type' },
        );

      if (!error || error.message.includes('driver_score_drop_alerts')) {
        alertsCreated++;
      }
    }
  }

  return { alertsCreated, driversChecked, errors: 0 };
}

export async function detectScoreDropAlertsAllLocations(): Promise<AlertDetectResult> {
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) return { locations: 0, alertsCreated: 0, driversChecked: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => detectScoreDropAlerts(l.id as string)),
  );

  let alertsCreated = 0;
  let driversChecked = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      alertsCreated  += r.value.alertsCreated;
      driversChecked += r.value.driversChecked;
      errors         += r.value.errors;
    } else errors++;
  }

  return { locations: locs.length, alertsCreated, driversChecked, errors };
}

// ── Alert quittieren ──────────────────────────────────────────────────────────

export async function acknowledgeAlert(
  alertId: string,
  locationId: string,
  userId?: string,
): Promise<{ ok: boolean }> {
  const svc = createServiceClient();

  const { error } = await svc
    .from('driver_score_drop_alerts')
    .update({
      acknowledged:    true,
      acknowledged_at: new Date().toISOString(),
      ...(userId ? { acknowledged_by: userId } : {}),
    } as Record<string, unknown>)
    .eq('id', alertId)
    .eq('location_id', locationId);

  if (error) throw error;
  return { ok: true };
}

// ── Abfragen ──────────────────────────────────────────────────────────────────

export async function getDriverDailyScoreTrend(
  driverId: string,
  locationId: string,
  days = 30,
): Promise<DailyScoreSnapshot[]> {
  const svc = createServiceClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.min(90, days));
  const sinceDate = since.toISOString().slice(0, 10);

  const { data } = await svc
    .from('driver_score_daily_snapshots')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:             r.id as string,
    driverId:       r.driver_id as string,
    locationId:     r.location_id as string,
    snapshotDate:   r.snapshot_date as string,
    compositeScore: Number(r.composite_score),
    grade:          r.grade as ScoreGrade,
    fPunctuality:   Number(r.f_punctuality),
    fRating:        Number(r.f_rating),
    fEfficiency:    Number(r.f_efficiency),
    fReliability:   Number(r.f_reliability),
    fActivity:      Number(r.f_activity),
    fVolume:        Number(r.f_volume),
    fFeedback:      Number(r.f_feedback),
    dataPoints:     Number(r.data_points),
    createdAt:      r.created_at as string,
  }));
}

export interface LocationScoreSummaryEntry {
  driverId: string;
  driverName: string | null;
  vehicle: 'bike' | 'car' | null;
  compositeScore: number;
  grade: ScoreGrade;
  dataPoints: number;
  snapshotDate: string;
}

export async function getLocationDailyScoreSummary(
  locationId: string,
  date?: string,
): Promise<LocationScoreSummaryEntry[]> {
  const svc = createServiceClient();

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const { data } = await svc
    .from('driver_score_daily_snapshots')
    .select('driver_id, snapshot_date, composite_score, grade, data_points, mise_drivers(name, vehicle)')
    .eq('location_id', locationId)
    .eq('snapshot_date', targetDate)
    .order('composite_score', { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const drv = (r.mise_drivers as Record<string, unknown> | null) ?? {};
    return {
      driverId:       r.driver_id as string,
      driverName:     (drv.name as string | null) ?? null,
      vehicle:        (drv.vehicle as 'bike' | 'car' | null) ?? null,
      compositeScore: Number(r.composite_score),
      grade:          r.grade as ScoreGrade,
      dataPoints:     Number(r.data_points),
      snapshotDate:   r.snapshot_date as string,
    };
  });
}

export async function getPendingDropAlerts(locationId: string): Promise<ScoreDropAlert[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('driver_score_drop_alerts')
    .select('*, mise_drivers(name, vehicle)')
    .eq('location_id', locationId)
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(50);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const drv = (r.mise_drivers as Record<string, unknown> | null) ?? {};
    return {
      id:             r.id as string,
      driverId:       r.driver_id as string,
      locationId:     r.location_id as string,
      alertDate:      r.alert_date as string,
      scoreToday:     Number(r.score_today),
      scoreBaseline:  Number(r.score_baseline),
      dropMagnitude:  Number(r.drop_magnitude),
      gradeToday:     r.grade_today as ScoreGrade,
      gradeBaseline:  r.grade_baseline as ScoreGrade,
      alertType:      r.alert_type as AlertType,
      acknowledged:   Boolean(r.acknowledged),
      acknowledgedAt: (r.acknowledged_at as string | null) ?? null,
      createdAt:      r.created_at as string,
      driverName:     (drv.name as string | null) ?? null,
      vehicle:        (drv.vehicle as 'bike' | 'car' | null) ?? null,
    };
  });
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldDailySnapshots(daysToKeep = 90): Promise<{ pruned: number }> {
  const svc = createServiceClient();

  const { data, error } = await svc.rpc('prune_driver_score_daily_snapshots', {
    days_to_keep: daysToKeep,
  });

  if (error) {
    if (error.message.includes('prune_driver_score_daily_snapshots')) return { pruned: 0 };
    throw error;
  }

  return { pruned: (data as number | null) ?? 0 };
}

export async function pruneOldDropAlerts(daysToKeep = 60): Promise<{ pruned: number }> {
  const svc = createServiceClient();

  const { data, error } = await svc.rpc('prune_driver_score_drop_alerts', {
    days_to_keep: daysToKeep,
  });

  if (error) {
    if (error.message.includes('prune_driver_score_drop_alerts')) return { pruned: 0 };
    throw error;
  }

  return { pruned: (data as number | null) ?? 0 };
}
