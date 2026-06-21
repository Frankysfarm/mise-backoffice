/**
 * lib/delivery/driver-score.ts
 *
 * Phase 205 — Driver Composite Performance Score Engine
 * Phase 359 — Driver Score History + Tour Feedback Integration
 *
 * Berechnet einen gewichteten 0–100-Score für jeden Fahrer aus 7 Faktoren:
 *  1. f_punctuality  (0–30) — On-Time-Rate der letzten N Tage
 *  2. f_rating       (0–25) — Kundenbewertung (avg_rating 1–5)
 *  3. f_efficiency   (0–15) — km pro Lieferung (niedrig = effizient)
 *  4. f_reliability  (0–15) — Schicht-Zuverlässigkeits-Score aus driver_reliability_scores
 *  5. f_activity     (0–10) — Aktive Minuten pro Schicht-Tag
 *  6. f_volume       (0–5)  — Durchschnittliche Stops pro aktivem Tag
 *  7. f_feedback     (0–5)  — Kunden-Feedback aus tour_feedback (avg customer_rating)
 *
 * Grade-Mapping:
 *  ≥90 → A+, ≥75 → A, ≥60 → B, ≥45 → C, <45 → D
 *
 * Exports:
 *  computeDriverScore()            — Score für einen Fahrer berechnen
 *  computeAndSaveScoresForLocation()— Alle Fahrer einer Location berechnen + upserten
 *  computeScoresAllLocations()     — Cron-Wrapper
 *  getScoreLeaderboard()           — Rangliste mit Scores laden
 *  getDriverScoreDetail()          — Faktor-Aufschlüsselung für einen Fahrer
 *  snapshotDriverScoreHistory()    — Wöchentlicher Snapshot in driver_score_history
 *  snapshotDriverScoreHistoryAllLocations() — Cron-Wrapper für History-Snapshots
 *  getDriverScoreHistory()         — History-Daten laden
 *  pruneDriverScoreHistory()       — Alte History-Einträge löschen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
export type ScorePeriod = 'week' | 'month';

export interface CompositeScoreResult {
  driverId: string;
  locationId: string;
  period: ScorePeriod;
  periodStart: string;      // ISO date YYYY-MM-DD
  compositeScore: number;   // 0–100
  grade: ScoreGrade;
  fPunctuality: number;     // 0–30
  fRating: number;          // 0–25
  fEfficiency: number;      // 0–15
  fReliability: number;     // 0–15
  fActivity: number;        // 0–10
  fVolume: number;          // 0–5
  fFeedback: number;        // 0–5
  dataPoints: number;
}

export interface ScoreLeaderboardEntry {
  scoreRank: number;
  driverId: string;
  locationId: string;
  authUserId: string | null;
  driverName: string | null;
  initials: string;
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
  periodStart: string;
}

// ─── Score-Berechnung ─────────────────────────────────────────────────────────

function gradeFromScore(score: number): ScoreGrade {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

/**
 * Berechnet den Pünktlichkeits-Faktor (0–30).
 * onTimeRate: 0.0–1.0, fehlend → Mittelwert 0.8 angenommen.
 */
function scorePunctuality(onTimeRateAvg: number | null): number {
  const rate = onTimeRateAvg ?? 0.8;
  // 100% → 30 Punkte, 0% → 0 Punkte (linear)
  return Math.round(Math.min(30, Math.max(0, rate * 30)) * 100) / 100;
}

/**
 * Berechnet den Bewertungs-Faktor (0–25).
 * rating: 1.0–5.0, fehlend → 4.0 angenommen.
 */
function scoreRating(avgRating: number | null): number {
  const r = avgRating ?? 4.0;
  // 5.0 → 25, 1.0 → 0 (linear über 4 Punkte Skala)
  return Math.round(Math.min(25, Math.max(0, ((r - 1) / 4) * 25)) * 100) / 100;
}

/**
 * Berechnet den Effizienz-Faktor (0–15) aus km pro Lieferung.
 * Weniger km pro Stop = effizienter = mehr Punkte.
 * ≤2 km/Stop → 15, 5 km/Stop → 7, ≥10 km/Stop → 0
 */
function scoreEfficiency(kmPerStop: number | null): number {
  if (kmPerStop === null || kmPerStop <= 0) return 7; // neutral wenn keine Daten
  if (kmPerStop <= 2)  return 15;
  if (kmPerStop <= 3)  return 12;
  if (kmPerStop <= 5)  return 9;
  if (kmPerStop <= 7)  return 6;
  if (kmPerStop <= 10) return 3;
  return 0;
}

/**
 * Berechnet den Zuverlässigkeits-Faktor (0–15) aus dem Schicht-Reliability-Score (0–100).
 */
function scoreReliability(reliabilityScore: number | null): number {
  const s = reliabilityScore ?? 80; // neutral default
  return Math.round(Math.min(15, Math.max(0, (s / 100) * 15)) * 100) / 100;
}

/**
 * Berechnet den Aktivitäts-Faktor (0–10) aus durchschnittlichen aktiven Minuten pro Tag.
 * ≥240 Min (4h) → 10, ≤60 Min → 0
 */
function scoreActivity(avgActiveMinPerDay: number | null): number {
  const m = avgActiveMinPerDay ?? 120;
  if (m >= 240) return 10;
  if (m >= 180) return 8;
  if (m >= 120) return 6;
  if (m >= 60)  return 3;
  return 1;
}

/**
 * Berechnet den Volumen-Faktor (0–5) aus durchschnittlichen Stops pro aktivem Tag.
 * ≥15 Stops/Tag → 5, ≤2 → 0
 */
function scoreVolume(avgStopsPerDay: number | null): number {
  const s = avgStopsPerDay ?? 5;
  if (s >= 15) return 5;
  if (s >= 10) return 4;
  if (s >= 7)  return 3;
  if (s >= 4)  return 2;
  if (s >= 2)  return 1;
  return 0;
}

/**
 * Berechnet den Feedback-Faktor (0–5) aus dem Kunden-Rating in tour_feedback.
 * 5.0 → 5, 1.0 → 0 (linear)
 */
function scoreFeedback(avgCustomerRating: number | null): number {
  const r = avgCustomerRating ?? 4.0;
  return Math.round(Math.min(5, Math.max(0, ((r - 1) / 4) * 5)) * 100) / 100;
}

/**
 * Berechnet den Composite Score für einen Fahrer aus seinen Performance-Snapshots.
 */
export async function computeDriverScore(
  driverId: string,
  locationId: string,
  period: ScorePeriod = 'week',
): Promise<CompositeScoreResult | null> {
  const sb = createServiceClient();

  const days = period === 'week' ? 7 : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - days + 1);
  const periodStartStr = periodStart.toISOString().slice(0, 10);

  // ── 1. Performance-Snapshots aus driver_performance_snapshots ───────────────
  const { data: snaps, error: snapErr } = await sb
    .from('driver_performance_snapshots')
    .select('on_time_rate, avg_rating, total_distance_km, stops_completed, active_minutes')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', sinceStr);

  if (snapErr) {
    if (snapErr.message.includes('driver_performance_snapshots')) return null;
    console.warn('[driver-score] snapshots error:', snapErr.message);
    return null;
  }

  type SnapRow = {
    on_time_rate: number | null;
    avg_rating: number | null;
    total_distance_km: number | null;
    stops_completed: number | null;
    active_minutes: number | null;
  };
  const rows: SnapRow[] = (snaps ?? []) as SnapRow[];
  const dataPoints = rows.length;

  // ── 2. Aggregate KPIs ───────────────────────────────────────────────────────

  // On-Time-Rate: Durchschnitt über Tage mit Daten
  const otRows = rows.filter((r: SnapRow) => r.on_time_rate !== null);
  const onTimeRateAvg = otRows.length > 0
    ? otRows.reduce((s: number, r: SnapRow) => s + Number(r.on_time_rate), 0) / otRows.length
    : null;

  // Bewertung: Durchschnitt über Tage mit Rating-Daten
  const ratingRows = rows.filter((r: SnapRow) => r.avg_rating !== null);
  const avgRating = ratingRows.length > 0
    ? ratingRows.reduce((s: number, r: SnapRow) => s + Number(r.avg_rating), 0) / ratingRows.length
    : null;

  // km pro Lieferung
  const totalKm    = rows.reduce((s: number, r: SnapRow) => s + Number(r.total_distance_km ?? 0), 0);
  const totalStops = rows.reduce((s: number, r: SnapRow) => s + Number(r.stops_completed ?? 0), 0);
  const kmPerStop  = totalStops > 0 ? totalKm / totalStops : null;

  // Aktive Minuten pro Tag
  const totalActiveMin = rows.reduce((s: number, r: SnapRow) => s + Number(r.active_minutes ?? 0), 0);
  const activeDays = rows.filter((r: SnapRow) => Number(r.active_minutes ?? 0) > 0).length;
  const avgActiveMinPerDay = activeDays > 0 ? totalActiveMin / activeDays : null;

  // Stops pro aktivem Tag
  const avgStopsPerDay = activeDays > 0 ? totalStops / activeDays : null;

  // ── 3. Zuverlässigkeits-Score aus driver_reliability_scores ─────────────────
  let reliabilityScore: number | null = null;
  const { data: relRow } = await sb
    .from('driver_reliability_scores')
    .select('score')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();
  if (relRow) reliabilityScore = Number((relRow as Record<string, unknown>).score);

  // ── 3b. Feedback-Score aus tour_feedback ─────────────────────────────────────
  let avgCustomerFeedbackRating: number | null = null;
  try {
    const { data: fbRows } = await sb
      .from('tour_feedback')
      .select('customer_rating')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('submitted_at', sinceStr)
      .not('customer_rating', 'is', null);
    const fbVals = (fbRows ?? []).map((r: { customer_rating: number | null }) => Number(r.customer_rating)).filter((v: number) => v > 0);
    if (fbVals.length > 0) {
      avgCustomerFeedbackRating = fbVals.reduce((a: number, b: number) => a + b, 0) / fbVals.length;
    }
  } catch { /* graceful: tour_feedback may not exist */ }

  // ── 4. Faktoren berechnen ───────────────────────────────────────────────────
  const fPunctuality = scorePunctuality(onTimeRateAvg);
  const fRating      = scoreRating(avgRating);
  const fEfficiency  = scoreEfficiency(kmPerStop);
  const fReliability = scoreReliability(reliabilityScore);
  const fActivity    = scoreActivity(avgActiveMinPerDay);
  const fVolume      = scoreVolume(avgStopsPerDay);
  const fFeedback    = scoreFeedback(avgCustomerFeedbackRating);

  const compositeScore = Math.min(100, Math.round(
    (fPunctuality + fRating + fEfficiency + fReliability + fActivity + fVolume + fFeedback) * 100
  ) / 100);

  const grade = gradeFromScore(compositeScore);

  // ── 5. Upsert in driver_composite_scores ────────────────────────────────────
  const { error: upsertErr } = await sb
    .from('driver_composite_scores')
    .upsert({
      driver_id:       driverId,
      location_id:     locationId,
      period,
      period_start:    periodStartStr,
      composite_score: compositeScore,
      grade,
      f_punctuality:   fPunctuality,
      f_rating:        fRating,
      f_efficiency:    fEfficiency,
      f_reliability:   fReliability,
      f_activity:      fActivity,
      f_volume:        fVolume,
      f_feedback:      fFeedback,
      data_points:     dataPoints,
      computed_at:     new Date().toISOString(),
    } as Record<string, unknown>, { onConflict: 'driver_id,location_id,period,period_start' });

  if (upsertErr) {
    if (upsertErr.message.includes('driver_composite_scores')) return null;
    console.warn('[driver-score] upsert error:', upsertErr.message);
    return null;
  }

  return {
    driverId,
    locationId,
    period,
    periodStart: periodStartStr,
    compositeScore,
    grade,
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

/**
 * Berechnet Composite Scores für alle aktiven Fahrer einer Location.
 */
export async function computeAndSaveScoresForLocation(
  locationId: string,
  period: ScorePeriod = 'week',
): Promise<{ computed: number; errors: number }> {
  const sb = createServiceClient();

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('active', true)
    .in(
      'auth_user_id',
      (await sb
        .from('employees')
        .select('auth_user_id')
        .eq('location_id', locationId)
        .eq('active', true)
        .then((r: { data: Array<{ auth_user_id: string | null }> | null }) =>
          (r.data ?? []).map(e => e.auth_user_id as string).filter(Boolean)))
    );

  if (!drivers || drivers.length === 0) return { computed: 0, errors: 0 };

  let computed = 0;
  let errors = 0;

  for (const d of drivers) {
    const result = await computeDriverScore(d.id as string, locationId, period).catch(() => null);
    if (result) computed++;
    else errors++;
  }

  return { computed, errors };
}

/**
 * Cron-Wrapper: berechnet Scores für alle aktiven Locations.
 */
export async function computeScoresAllLocations(
  period: ScorePeriod = 'week',
): Promise<{ locations: number; computed: number; errors: number }> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locations || locations.length === 0) return { locations: 0, computed: 0, errors: 0 };

  let totalComputed = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    const r = await computeAndSaveScoresForLocation(loc.id as string, period).catch(
      () => ({ computed: 0, errors: 1 }),
    );
    totalComputed += r.computed;
    totalErrors   += r.errors;
  }

  return { locations: locations.length, computed: totalComputed, errors: totalErrors };
}

// ─── Leaderboard Abfrage ──────────────────────────────────────────────────────

/**
 * Lädt die Score-Rangliste für eine Location.
 * Fällt auf direkte Tabellen-Abfrage zurück wenn View fehlt.
 */
export async function getScoreLeaderboard(
  locationId: string,
  period: ScorePeriod = 'week',
  limit = 20,
): Promise<ScoreLeaderboardEntry[]> {
  const sb = createServiceClient();

  const viewName = period === 'week'
    ? 'v_driver_score_leaderboard_week'
    : 'v_driver_score_leaderboard_month';

  const { data: rows, error } = await sb
    .from(viewName)
    .select('*')
    .eq('location_id', locationId)
    .order('score_rank', { ascending: true })
    .limit(limit);

  // View noch nicht migriert → graceful fallback auf direkte Abfrage
  if (error) {
    if (error.message.includes(viewName) || error.message.includes('does not exist')) {
      return getScoreLeaderboardFallback(locationId, period, limit);
    }
    console.warn('[driver-score] getScoreLeaderboard error:', error.message);
    return [];
  }

  return enrichWithNames(rows ?? [], locationId, period);
}

async function getScoreLeaderboardFallback(
  locationId: string,
  period: ScorePeriod,
  limit: number,
): Promise<ScoreLeaderboardEntry[]> {
  const sb = createServiceClient();

  const days = period === 'week' ? 7 : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data: rows, error } = await sb
    .from('driver_composite_scores')
    .select('*')
    .eq('location_id', locationId)
    .eq('period', period)
    .gte('period_start', since.toISOString().slice(0, 10))
    .order('composite_score', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes('driver_composite_scores')) return [];
    console.warn('[driver-score] fallback error:', error.message);
    return [];
  }

  const withRank = (rows ?? []).map((r: Record<string, unknown>, i: number) => ({ ...r, score_rank: i + 1 }));
  return enrichWithNames(withRank, locationId, period);
}

async function enrichWithNames(
  rows: Record<string, unknown>[],
  locationId: string,
  period: ScorePeriod,
): Promise<ScoreLeaderboardEntry[]> {
  if (rows.length === 0) return [];

  const sb = createServiceClient();

  // Driver-ID → auth_user_id Mapping
  const driverIds = rows.map(r => r.driver_id as string).filter(Boolean);
  const authIdMap = new Map<string, string>();

  if (driverIds.length > 0) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, auth_user_id')
      .in('id', driverIds);
    for (const d of drivers ?? []) {
      if (d.id && d.auth_user_id) authIdMap.set(d.id as string, d.auth_user_id as string);
    }
  }

  const authIds = [...authIdMap.values()];
  const nameMap = new Map<string, string>();

  if (authIds.length > 0) {
    const { data: employees } = await sb
      .from('employees')
      .select('auth_user_id, vorname, nachname')
      .in('auth_user_id', authIds)
      .eq('location_id', locationId);
    for (const e of employees ?? []) {
      const name = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
      if (e.auth_user_id) nameMap.set(e.auth_user_id as string, name);
    }
  }

  // suppress unused parameter warning — period is kept for future use
  void period;

  return rows.map((r) => {
    const driverId  = r.driver_id as string;
    const authId    = authIdMap.get(driverId) ?? null;
    const driverName = authId ? (nameMap.get(authId) ?? null) : null;
    const nameParts  = driverName?.split(' ') ?? [];
    const initials   = nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (driverName?.[0]?.toUpperCase() ?? '?');

    return {
      scoreRank:      Number(r.score_rank ?? 0),
      driverId,
      locationId:     r.location_id as string,
      authUserId:     authId,
      driverName,
      initials,
      compositeScore: Number(r.composite_score ?? 0),
      grade:          (r.grade as ScoreGrade) ?? 'D',
      fPunctuality:   Number(r.f_punctuality ?? 0),
      fRating:        Number(r.f_rating ?? 0),
      fEfficiency:    Number(r.f_efficiency ?? 0),
      fReliability:   Number(r.f_reliability ?? 0),
      fActivity:      Number(r.f_activity ?? 0),
      fVolume:        Number(r.f_volume ?? 0),
      fFeedback:      Number(r.f_feedback ?? 0),
      dataPoints:     Number(r.data_points ?? 0),
      periodStart:    r.period_start as string ?? '',
    } satisfies ScoreLeaderboardEntry;
  });
}

/**
 * Faktor-Aufschlüsselung für einen einzelnen Fahrer.
 */
export async function getDriverScoreDetail(
  driverId: string,
  locationId: string,
  period: ScorePeriod = 'week',
): Promise<CompositeScoreResult | null> {
  const sb = createServiceClient();

  const days = period === 'week' ? 7 : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const { data: row, error } = await sb
    .from('driver_composite_scores')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('period', period)
    .gte('period_start', since.toISOString().slice(0, 10))
    .order('period_start', { ascending: false })
    .maybeSingle();

  if (error || !row) return null;

  const r = row as Record<string, unknown>;
  return {
    driverId,
    locationId,
    period,
    periodStart:    r.period_start as string,
    compositeScore: Number(r.composite_score),
    grade:          r.grade as ScoreGrade,
    fPunctuality:   Number(r.f_punctuality),
    fRating:        Number(r.f_rating),
    fEfficiency:    Number(r.f_efficiency),
    fReliability:   Number(r.f_reliability),
    fActivity:      Number(r.f_activity),
    fVolume:        Number(r.f_volume),
    fFeedback:      Number(r.f_feedback ?? 0),
    dataPoints:     Number(r.data_points),
  };
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface DriverScoreHistoryRow {
  id: string;
  locationId: string;
  driverId: string;
  period: ScorePeriod;
  periodStart: string;
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
  snapshotAt: string;
}

export async function snapshotDriverScoreHistory(locationId: string): Promise<{ saved: number }> {
  const sb = createServiceClient();

  const { data: scores } = await sb
    .from('driver_composite_scores')
    .select('*')
    .eq('location_id', locationId)
    .eq('period', 'week');

  if (!scores || scores.length === 0) return { saved: 0 };

  let saved = 0;
  for (const s of scores) {
    const r = s as Record<string, unknown>;
    let upsertError: unknown = null;
    try {
      const result = await sb
        .from('driver_score_history')
        .upsert({
          location_id:    r.location_id,
          driver_id:      r.driver_id,
          period:         r.period ?? 'week',
          period_start:   r.period_start,
          composite_score: r.composite_score,
          grade:          r.grade ?? 'D',
          f_punctuality:  r.f_punctuality ?? 0,
          f_rating:       r.f_rating ?? 0,
          f_efficiency:   r.f_efficiency ?? 0,
          f_reliability:  r.f_reliability ?? 0,
          f_activity:     r.f_activity ?? 0,
          f_volume:       r.f_volume ?? 0,
          f_feedback:     r.f_feedback ?? 0,
          data_points:    r.data_points ?? 0,
          snapshot_at:    new Date().toISOString(),
        } as Record<string, unknown>, { onConflict: 'location_id,driver_id,period,period_start' });
      upsertError = result.error;
    } catch { upsertError = true; }
    if (!upsertError) saved++;
  }
  return { saved };
}

export async function snapshotDriverScoreHistoryAllLocations(): Promise<{ locations: number; saved: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(50);
  if (!locs || locs.length === 0) return { locations: 0, saved: 0, errors: 0 };

  let totalSaved = 0;
  let totalErrors = 0;
  await Promise.allSettled(
    locs.map(async (loc: { id: string }) => {
      try {
        const r = await snapshotDriverScoreHistory(loc.id as string);
        totalSaved += r.saved;
      } catch {
        totalErrors++;
      }
    }),
  );
  return { locations: locs.length, saved: totalSaved, errors: totalErrors };
}

export async function getDriverScoreHistory(
  locationId: string,
  weeks = 8,
  driverIds?: string[],
): Promise<DriverScoreHistoryRow[]> {
  const sb = createServiceClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - weeks * 7);

  try {
    let query = sb
      .from('driver_score_history')
      .select('*')
      .eq('location_id', locationId)
      .eq('period', 'week')
      .gte('period_start', since.toISOString().slice(0, 10))
      .order('period_start', { ascending: true });

    if (driverIds && driverIds.length > 0) {
      query = query.in('driver_id', driverIds);
    }

    const { data, error } = await query.limit(500);
    if (error) {
      if (error.message.includes('driver_score_history')) return [];
      return [];
    }

    return (data ?? []).map((r: Record<string, unknown>) => ({
      id:             r.id as string,
      locationId:     r.location_id as string,
      driverId:       r.driver_id as string,
      period:         (r.period as ScorePeriod) ?? 'week',
      periodStart:    r.period_start as string,
      compositeScore: Number(r.composite_score ?? 0),
      grade:          (r.grade as ScoreGrade) ?? 'D',
      fPunctuality:   Number(r.f_punctuality ?? 0),
      fRating:        Number(r.f_rating ?? 0),
      fEfficiency:    Number(r.f_efficiency ?? 0),
      fReliability:   Number(r.f_reliability ?? 0),
      fActivity:      Number(r.f_activity ?? 0),
      fVolume:        Number(r.f_volume ?? 0),
      fFeedback:      Number(r.f_feedback ?? 0),
      dataPoints:     Number(r.data_points ?? 0),
      snapshotAt:     r.snapshot_at as string,
    }));
  } catch {
    return [];
  }
}

export async function pruneDriverScoreHistory(daysToKeep = 365): Promise<number> {
  try {
    const { data } = await createServiceClient().rpc('prune_driver_score_history', { days_to_keep: daysToKeep });
    return (data as number | null) ?? 0;
  } catch {
    return 0;
  }
}
