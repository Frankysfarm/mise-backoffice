/**
 * lib/delivery/location-health-score.ts
 *
 * Phase 264: Location-Gesundheits-Score API
 *
 * Aggregierter Standort-Score (0–100) aus 4 Dimensionen:
 *   40% Pünktlichkeit       — fertig_am ≤ eta_earliest
 *   25% Fahrerverfügbarkeit — online Fahrer vs. geschätzter Bedarf
 *   20% Stornoquote         — % stornierter Bestellungen (invertiert)
 *   15% Kundenzufriedenheit — Ø Bewertung 1–5 → 0–100
 *
 * Bewertung: A+ ≥92 · A ≥80 · B+ ≥70 · B ≥60 · C ≥45 · D ≥30 · F <30
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Gewichte ─────────────────────────────────────────────────────────────────

const W_ON_TIME = 0.40;
const W_DRIVER  = 0.25;
const W_CANCEL  = 0.20;
const W_RATING  = 0.15;

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface LocationHealthSnapshot {
  id:              string;
  locationId:      string;
  locationName?:   string;
  scoreDate:       string;
  // Rohdaten
  totalDeliveries: number;
  onTimeCount:     number;
  onTimeRatePct:   number | null;
  driversOnline:   number;
  driversNeeded:   number;
  cancelCount:     number;
  totalOrders:     number;
  cancelRatePct:   number | null;
  avgRating:       number | null;
  ratedOrders:     number;
  // Dimension-Scores
  onTimeScore:     number;
  driverScore:     number;
  cancelScore:     number;
  ratingScore:     number;
  // Gesamt
  overallScore:     number;
  grade:            string;
  trend:            'up' | 'stable' | 'down';
  scoreDelta:       number;
  weakestDimension: string | null;
  snappedAt:        string;
}

export interface HealthTrendRow {
  scoreDate:    string;
  overallScore: number;
  grade:        string;
  onTimeScore:  number;
  driverScore:  number;
  cancelScore:  number;
  ratingScore:  number;
}

export interface LocationHealthDashboard {
  latest:          LocationHealthSnapshot | null;
  trend:           HealthTrendRow[];
  ranking:         { locationId: string; locationName: string; overallScore: number; grade: string; trend: string; scoreDelta: number; healthRank: number; totalLocations: number }[];
  recommendations: string[];
}

export interface SnapshotAllResult {
  locations:  number;
  snapshots:  number;
  errors:     number;
}

// ─── Grade Helper ─────────────────────────────────────────────────────────────

function toGrade(score: number): string {
  if (score >= 92) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ─── Score-Berechnung ────────────────────────────────────────────────────────

/**
 * Berechnet den aktuellen Gesundheits-Score einer Location für ein Datum.
 * Standardmäßig: gestern (abgeschlossener Tag hat vollständige Daten).
 */
export async function computeLocationHealthScore(
  locationId: string,
  targetDate?: string,
): Promise<Omit<LocationHealthSnapshot, 'id' | 'locationName' | 'trend' | 'scoreDelta' | 'snappedAt'>> {
  const sb = createServiceClient();
  const date     = targetDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  // ── Dimension 1: Pünktlichkeit ──────────────────────────────────────────────
  const { data: deliveries } = await sb
    .from('customer_orders')
    .select('fertig_am, eta_earliest')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .not('fertig_am', 'is', null)
    .gte('fertig_am', dayStart)
    .lte('fertig_am', dayEnd);

  const totalDeliveries = deliveries?.length ?? 0;
  let onTimeCount   = 0;
  let onTimeRatePct: number | null = null;

  if (totalDeliveries > 0) {
    onTimeCount = (deliveries ?? []).filter(d =>
      d.fertig_am && d.eta_earliest &&
      new Date(d.fertig_am) <= new Date(d.eta_earliest),
    ).length;
    onTimeRatePct = Math.round((onTimeCount / totalDeliveries) * 10000) / 100;
  }

  // on_time_score: linear 50%→0, 95%→100
  let onTimeScore = 0;
  if (onTimeRatePct !== null) {
    onTimeScore = Math.round(Math.max(0, Math.min(100, ((onTimeRatePct - 50) / 45) * 100)));
  }

  // ── Dimension 2: Fahrerverfügbarkeit ───────────────────────────────────────
  const [{ count: driversOnlineRaw }, { count: openOrdersRaw }] = await Promise.all([
    sb.from('mise_drivers').select('id', { count: 'exact', head: true })
      .eq('active', true)
      .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']),
    sb.from('customer_orders').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['neu', 'angenommen', 'in_zubereitung', 'fertig']),
  ]);

  const driversOnline = driversOnlineRaw ?? 0;
  // Fahrer-Bedarf: 1 Fahrer pro 3 offene Bestellungen, min. 1
  const driversNeeded = Math.max(1, Math.ceil((openOrdersRaw ?? 0) / 3));

  // driver_score: 0 Fahrer=0, driversNeeded=100, linear
  const driverScore = Math.round(
    Math.max(0, Math.min(100, (driversOnline / driversNeeded) * 100)),
  );

  // ── Dimension 3: Stornoquote ────────────────────────────────────────────────
  const { data: allOrders } = await sb
    .from('customer_orders')
    .select('status')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const totalOrders = allOrders?.length ?? 0;
  const cancelCount = (allOrders ?? []).filter(o =>
    o.status === 'storniert' || o.status === 'cancelled',
  ).length;
  let cancelRatePct: number | null = null;
  if (totalOrders > 0) {
    cancelRatePct = Math.round((cancelCount / totalOrders) * 10000) / 100;
  }

  // cancel_score: 0% → 100, 20%+ → 0; linear invertiert
  let cancelScore = 100;
  if (cancelRatePct !== null) {
    cancelScore = Math.round(Math.max(0, Math.min(100, (1 - cancelRatePct / 20) * 100)));
  }

  // ── Dimension 4: Kundenzufriedenheit ───────────────────────────────────────
  const { data: ratings } = await sb
    .from('customer_orders')
    .select('rating')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('rating', 'is', null)
    .gte('fertig_am', dayStart)
    .lte('fertig_am', dayEnd);

  const ratedOrders = ratings?.length ?? 0;
  let avgRating: number | null = null;
  if (ratedOrders > 0) {
    const sum = (ratings ?? []).reduce((a, r) => a + (Number(r.rating) || 0), 0);
    avgRating = Math.round((sum / ratedOrders) * 100) / 100;
  }

  // rating_score: (avgRating-1)/4 * 100 → 1=0, 5=100
  let ratingScore = 0;
  if (avgRating !== null) {
    ratingScore = Math.round(Math.max(0, Math.min(100, ((avgRating - 1) / 4) * 100)));
  }

  // ── Gesamt-Score ────────────────────────────────────────────────────────────
  const overallScore = Math.round(
    onTimeScore * W_ON_TIME +
    driverScore * W_DRIVER  +
    cancelScore * W_CANCEL  +
    ratingScore * W_RATING,
  );

  const grade = toGrade(overallScore);

  // Schwächste Dimension
  const dims = [
    { key: 'on_time', score: onTimeScore },
    { key: 'driver',  score: driverScore },
    { key: 'cancel',  score: cancelScore },
    { key: 'rating',  score: ratingScore },
  ];
  dims.sort((a, b) => a.score - b.score);
  const weakestDimension = dims[0].score < 60 ? dims[0].key : null;

  return {
    locationId,
    scoreDate:       date,
    totalDeliveries, onTimeCount, onTimeRatePct,
    driversOnline, driversNeeded,
    cancelCount, totalOrders, cancelRatePct,
    avgRating, ratedOrders,
    onTimeScore, driverScore, cancelScore, ratingScore,
    overallScore, grade, weakestDimension,
  };
}

// ─── Snapshot speichern ───────────────────────────────────────────────────────

export async function snapshotLocationHealthScore(
  locationId: string,
  targetDate?: string,
): Promise<LocationHealthSnapshot> {
  const sb   = createServiceClient();
  const data = await computeLocationHealthScore(locationId, targetDate);

  // Vortag laden für Trend
  const yesterday = new Date(new Date(data.scoreDate).getTime() - 86_400_000).toISOString().slice(0, 10);
  const { data: prev } = await sb
    .from('location_health_scores')
    .select('overall_score')
    .eq('location_id', locationId)
    .eq('score_date', yesterday)
    .maybeSingle();

  const scoreDelta = prev?.overall_score != null
    ? data.overallScore - (prev.overall_score as number)
    : 0;
  const trend: 'up' | 'stable' | 'down' =
    scoreDelta >= 3 ? 'up' : scoreDelta <= -3 ? 'down' : 'stable';

  const { data: row, error } = await sb
    .from('location_health_scores')
    .upsert({
      location_id:      locationId,
      score_date:       data.scoreDate,
      total_deliveries: data.totalDeliveries,
      on_time_count:    data.onTimeCount,
      on_time_rate_pct: data.onTimeRatePct,
      drivers_online:   data.driversOnline,
      drivers_needed:   data.driversNeeded,
      cancel_count:     data.cancelCount,
      total_orders:     data.totalOrders,
      cancel_rate_pct:  data.cancelRatePct,
      avg_rating:       data.avgRating,
      rated_orders:     data.ratedOrders,
      on_time_score:    data.onTimeScore,
      driver_score:     data.driverScore,
      cancel_score:     data.cancelScore,
      rating_score:     data.ratingScore,
      overall_score:    data.overallScore,
      grade:            data.grade,
      trend,
      score_delta:      scoreDelta,
      weakest_dimension: data.weakestDimension,
      snapped_at:       new Date().toISOString(),
    }, { onConflict: 'location_id,score_date' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(row);
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export async function snapshotAllLocations(targetDate?: string): Promise<SnapshotAllResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  let snapshots = 0;
  let errors    = 0;

  await Promise.all(
    (locs ?? []).map(async (loc) => {
      try {
        await snapshotLocationHealthScore(loc.id as string, targetDate);
        snapshots++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, snapshots, errors };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getLocationHealthDashboard(locationId: string): Promise<LocationHealthDashboard> {
  const sb = createServiceClient();

  const [latestRes, trendRes, rankingRes] = await Promise.all([
    sb.from('v_location_health_latest')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb.from('location_health_scores')
      .select('score_date, overall_score, grade, on_time_score, driver_score, cancel_score, rating_score')
      .eq('location_id', locationId)
      .order('score_date', { ascending: false })
      .limit(30),
    sb.from('v_location_health_ranking')
      .select('location_id, location_name, overall_score, grade, trend, score_delta, health_rank, total_locations')
      .order('health_rank', { ascending: true }),
  ]);

  const latest = latestRes.data ? mapRow(latestRes.data) : null;

  const trend: HealthTrendRow[] = ((trendRes.data ?? []) as Record<string, unknown>[]).map(r => ({
    scoreDate:    r.score_date    as string,
    overallScore: r.overall_score as number,
    grade:        r.grade         as string,
    onTimeScore:  r.on_time_score as number,
    driverScore:  r.driver_score  as number,
    cancelScore:  r.cancel_score  as number,
    ratingScore:  r.rating_score  as number,
  })).reverse();

  const ranking = ((rankingRes.data ?? []) as Record<string, unknown>[]).map(r => ({
    locationId:     r.location_id   as string,
    locationName:   r.location_name as string,
    overallScore:   r.overall_score as number,
    grade:          r.grade         as string,
    trend:          r.trend         as string,
    scoreDelta:     r.score_delta   as number,
    healthRank:     r.health_rank   as number,
    totalLocations: r.total_locations as number,
  }));

  const recommendations = buildRecommendations(latest);

  return { latest, trend, ranking, recommendations };
}

export async function getLocationHealthTrend(locationId: string, days = 30): Promise<HealthTrendRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data } = await sb
    .from('location_health_scores')
    .select('score_date, overall_score, grade, on_time_score, driver_score, cancel_score, rating_score')
    .eq('location_id', locationId)
    .gte('score_date', since)
    .order('score_date', { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    scoreDate:    r.score_date    as string,
    overallScore: r.overall_score as number,
    grade:        r.grade         as string,
    onTimeScore:  r.on_time_score as number,
    driverScore:  r.driver_score  as number,
    cancelScore:  r.cancel_score  as number,
    ratingScore:  r.rating_score  as number,
  }));
}

export async function pruneOldHealthScores(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_health_scores', { p_days: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}

// ─── Row-Mapper ───────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): LocationHealthSnapshot {
  return {
    id:              r.id              as string,
    locationId:      r.location_id     as string,
    locationName:    r.location_name   as string | undefined,
    scoreDate:       (r.score_date instanceof Date
                       ? r.score_date.toISOString().slice(0, 10)
                       : String(r.score_date ?? '')).slice(0, 10),
    totalDeliveries: (r.total_deliveries as number) ?? 0,
    onTimeCount:     (r.on_time_count   as number) ?? 0,
    onTimeRatePct:   r.on_time_rate_pct != null ? Number(r.on_time_rate_pct) : null,
    driversOnline:   (r.drivers_online  as number) ?? 0,
    driversNeeded:   (r.drivers_needed  as number) ?? 0,
    cancelCount:     (r.cancel_count    as number) ?? 0,
    totalOrders:     (r.total_orders    as number) ?? 0,
    cancelRatePct:   r.cancel_rate_pct  != null ? Number(r.cancel_rate_pct)  : null,
    avgRating:       r.avg_rating       != null ? Number(r.avg_rating)       : null,
    ratedOrders:     (r.rated_orders    as number) ?? 0,
    onTimeScore:     (r.on_time_score   as number) ?? 0,
    driverScore:     (r.driver_score    as number) ?? 0,
    cancelScore:     (r.cancel_score    as number) ?? 0,
    ratingScore:     (r.rating_score    as number) ?? 0,
    overallScore:    (r.overall_score   as number) ?? 0,
    grade:           (r.grade           as string) ?? 'F',
    trend:           (r.trend           as 'up' | 'stable' | 'down') ?? 'stable',
    scoreDelta:      (r.score_delta     as number) ?? 0,
    weakestDimension: r.weakest_dimension as string | null ?? null,
    snappedAt:       (r.snapped_at      as string) ?? '',
  };
}

// ─── Empfehlungen ─────────────────────────────────────────────────────────────

function buildRecommendations(latest: LocationHealthSnapshot | null): string[] {
  if (!latest) return [];
  const recs: string[] = [];
  if (latest.onTimeScore  < 60) recs.push('Pünktlichkeit unter 60: Küchen-Timing prüfen und ETA-Puffer anpassen.');
  if (latest.driverScore  < 60) recs.push('Fahrerverfügbarkeit kritisch: Schicht-Abdeckung für Stoßzeiten erhöhen.');
  if (latest.cancelScore  < 60) recs.push('Stornoquote zu hoch: Ursachen (Wartezeit, Fehler) im Lifecycle-Funnel prüfen.');
  if (latest.ratingScore  < 60) recs.push('Kundenzufriedenheit unter 3 Sterne: Lieferqualität und Kommunikation verbessern.');
  if (latest.overallScore < 45) recs.push('Gesundheits-Score kritisch (Note F/D): Sofortmaßnahmen empfohlen.');
  if (recs.length === 0)        recs.push('Alle Dimensionen im grünen Bereich. Weiter so!');
  return recs;
}
