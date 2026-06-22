/**
 * lib/delivery/fahrer-prognose.ts — Phase 417
 *
 * Fahrer-Prognose-Engine:
 * ML-ähnlicher Score (0–100) je Fahrer aus 4 gewichteten Sub-Scores,
 * basierend auf den letzten 28 Tagen aus driver_performance_snapshots.
 *
 * Sub-Scores (alle 0–100):
 *   punctuality_score   (35%) — On-Time-Rate der Lieferungen
 *   delivery_time_score (30%) — Ø Lieferzeit (≤20min=100, ≥50min=0)
 *   storno_score        (20%) — Kundenbewertungs-Proxy (rating 1–5 → 0–100)
 *   efficiency_score    (15%) — Stops/Tour-Verhältnis (≤1=0, ≥5=100)
 *
 * Kategorie:
 *   elite(≥80) · gut(≥60) · durchschnitt(≥40) · auffällig(<40)
 *
 * Trend:
 *   Vergleich Ø letzte 7 Tage vs. vorherige 7 Tage → up/stable/down
 *
 * Public API:
 *   computeDriverPrognose(driverId, locationId, daysBack?)  — Score berechnen + UPSERT
 *   computePrognoseForLocation(locationId, daysBack?)       — alle Fahrer einer Location
 *   computePrognoseAllLocations(daysBack?)                  — Cron-Batch
 *   getFahrerPrognoseRangliste(locationId)                  — Rangliste laden
 *   getDriverPrognoseDetail(driverId, locationId)           — Detail für einen Fahrer
 *   pruneOldPrognoseSnapshots(daysOld?)                     — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type PrognoseKategorie = 'elite' | 'gut' | 'durchschnitt' | 'auffällig';
export type TrendDirection = 'up' | 'stable' | 'down';

export interface FahrerPrognoseSnapshot {
  driverId:           string;
  locationId:         string;
  prognoseScore:      number;        // 0–100
  kategorie:          PrognoseKategorie;
  punctualityScore:   number | null; // 0–100
  deliveryTimeScore:  number | null; // 0–100
  stornoScore:        number | null; // 0–100
  efficiencyScore:    number | null; // 0–100
  toursAnalyzed:      number;
  daysAnalyzed:       number;
  trendDirection:     TrendDirection;
  computedAt:         string;
}

export interface FahrerPrognoseRanglistenEintrag extends FahrerPrognoseSnapshot {
  rang:       number;
  driverName: string | null;
  initials:   string;
}

export interface ComputePrognoseResult {
  locationId:  string;
  computed:    number;
  errors:      number;
  durationMs:  number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function kategorieFromScore(score: number): PrognoseKategorie {
  if (score >= 80) return 'elite';
  if (score >= 60) return 'gut';
  if (score >= 40) return 'durchschnitt';
  return 'auffällig';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeSubScores(rows: Array<{
  on_time_rate:    number | null;
  avg_delivery_min: number | null;
  avg_rating:      number | null;
  tours_completed: number;
  stops_completed: number;
}>): {
  punctualityScore:  number | null;
  deliveryTimeScore: number | null;
  stornoScore:       number | null;
  efficiencyScore:   number | null;
  prognoseScore:     number;
} {
  // --- punctuality_score: avg(on_time_rate) * 100
  const ptRows = rows.filter(r => r.on_time_rate != null);
  const punctualityScore = ptRows.length > 0
    ? clamp(ptRows.reduce((s, r) => s + (r.on_time_rate ?? 0), 0) / ptRows.length * 100, 0, 100)
    : null;

  // --- delivery_time_score: ≤20min→100, ≥50min→0, linear
  const dtRows = rows.filter(r => r.avg_delivery_min != null && r.tours_completed > 0);
  const avgDelMin = dtRows.length > 0
    ? dtRows.reduce((s, r) => s + (r.avg_delivery_min ?? 0), 0) / dtRows.length
    : null;
  const deliveryTimeScore = avgDelMin != null
    ? clamp(100 - ((avgDelMin - 20) / 30) * 100, 0, 100)
    : null;

  // --- storno_score: rating proxy (1–5 → 0–100)
  const ratingRows = rows.filter(r => r.avg_rating != null);
  const avgRating = ratingRows.length > 0
    ? ratingRows.reduce((s, r) => s + (r.avg_rating ?? 0), 0) / ratingRows.length
    : null;
  const stornoScore = avgRating != null
    ? clamp((avgRating - 1) / 4 * 100, 0, 100)
    : null;

  // --- efficiency_score: avg(stops/tour): ≤1→0, ≥5→100, linear
  const effRows = rows.filter(r => r.tours_completed > 0);
  const avgStopsPerTour = effRows.length > 0
    ? effRows.reduce((s, r) => s + r.stops_completed / r.tours_completed, 0) / effRows.length
    : null;
  const efficiencyScore = avgStopsPerTour != null
    ? clamp((avgStopsPerTour - 1) / 4 * 100, 0, 100)
    : null;

  // --- prognose_score: weighted average
  const weights = [
    { score: punctualityScore,  w: 0.35 },
    { score: deliveryTimeScore, w: 0.30 },
    { score: stornoScore,       w: 0.20 },
    { score: efficiencyScore,   w: 0.15 },
  ];
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { score, w } of weights) {
    if (score != null) {
      weightedSum += score * w;
      totalWeight += w;
    }
  }
  const prognoseScore = totalWeight > 0
    ? clamp(weightedSum / totalWeight * (totalWeight < 0.5 ? 0.7 : 1), 0, 100)
    : 0;

  return {
    punctualityScore:  punctualityScore  != null ? Math.round(punctualityScore  * 10) / 10 : null,
    deliveryTimeScore: deliveryTimeScore != null ? Math.round(deliveryTimeScore * 10) / 10 : null,
    stornoScore:       stornoScore       != null ? Math.round(stornoScore       * 10) / 10 : null,
    efficiencyScore:   efficiencyScore   != null ? Math.round(efficiencyScore   * 10) / 10 : null,
    prognoseScore:     Math.round(prognoseScore * 10) / 10,
  };
}

// ── Score-Berechnung für einen Fahrer ────────────────────────────────────────

export async function computeDriverPrognose(
  driverId: string,
  locationId: string,
  daysBack = 28,
): Promise<FahrerPrognoseSnapshot | null> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);

  // Letzte N Tage Snapshots für diesen Fahrer
  const { data: snapshots } = await sb
    .from('driver_performance_snapshots')
    .select('on_time_rate, avg_delivery_min, avg_rating, tours_completed, stops_completed, snapshot_date')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: false });

  if (!snapshots || snapshots.length === 0) return null;

  const toursAnalyzed = snapshots.reduce((s, r) => s + (r.tours_completed ?? 0), 0);
  if (toursAnalyzed === 0) return null;

  const { punctualityScore, deliveryTimeScore, stornoScore, efficiencyScore, prognoseScore } =
    computeSubScores(snapshots as Array<{
      on_time_rate: number | null;
      avg_delivery_min: number | null;
      avg_rating: number | null;
      tours_completed: number;
      stops_completed: number;
    }>);

  // Trend: letzte 7d vs. vorherige 7d
  const last7 = snapshots.slice(0, 7);
  const prev7 = snapshots.slice(7, 14);
  let trendDirection: TrendDirection = 'stable';
  if (last7.length >= 3 && prev7.length >= 3) {
    const scoreOf = (rs: typeof last7) => computeSubScores(rs as Array<{
      on_time_rate: number | null;
      avg_delivery_min: number | null;
      avg_rating: number | null;
      tours_completed: number;
      stops_completed: number;
    }>).prognoseScore;
    const diffScore = scoreOf(last7) - scoreOf(prev7);
    if (diffScore > 5)       trendDirection = 'up';
    else if (diffScore < -5) trendDirection = 'down';
  }

  const snapshot: FahrerPrognoseSnapshot = {
    driverId,
    locationId,
    prognoseScore,
    kategorie:         kategorieFromScore(prognoseScore),
    punctualityScore,
    deliveryTimeScore,
    stornoScore,
    efficiencyScore,
    toursAnalyzed,
    daysAnalyzed:  snapshots.length,
    trendDirection,
    computedAt:    new Date().toISOString(),
  };

  // UPSERT
  await sb.from('fahrer_prognose_snapshots').upsert({
    driver_id:           driverId,
    location_id:         locationId,
    prognose_score:      prognoseScore,
    kategorie:           snapshot.kategorie,
    punctuality_score:   punctualityScore,
    delivery_time_score: deliveryTimeScore,
    storno_score:        stornoScore,
    efficiency_score:    efficiencyScore,
    tours_analyzed:      toursAnalyzed,
    days_analyzed:       snapshots.length,
    trend_direction:     trendDirection,
    computed_at:         snapshot.computedAt,
  }, { onConflict: 'driver_id,location_id' });

  return snapshot;
}

// ── Alle Fahrer einer Location ────────────────────────────────────────────────

export async function computePrognoseForLocation(
  locationId: string,
  daysBack = 28,
): Promise<ComputePrognoseResult> {
  const start = Date.now();
  const sb = createServiceClient();

  // Alle Fahrer mit driver_performance_snapshots in den letzten 60 Tagen
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const { data: driverRows } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('snapshot_date', since60);

  if (!driverRows || driverRows.length === 0) {
    return { locationId, computed: 0, errors: 0, durationMs: Date.now() - start };
  }

  const uniqueDriverIds = [...new Set(driverRows.map(r => r.driver_id as string))];
  let computed = 0;
  let errors = 0;

  await Promise.allSettled(
    uniqueDriverIds.map(async (driverId) => {
      try {
        const result = await computeDriverPrognose(driverId, locationId, daysBack);
        if (result) computed++;
      } catch {
        errors++;
      }
    }),
  );

  return { locationId, computed, errors, durationMs: Date.now() - start };
}

// ── Cron-Batch alle Locations ─────────────────────────────────────────────────

export async function computePrognoseAllLocations(
  daysBack = 28,
): Promise<{ locations: number; computed: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, computed: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map(l => computePrognoseForLocation(l.id as string, daysBack)),
  );

  let computed = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      computed += r.value.computed;
      errors   += r.value.errors;
    } else {
      errors++;
    }
  }

  return { locations: locs.length, computed, errors };
}

// ── Rangliste laden ───────────────────────────────────────────────────────────

export async function getFahrerPrognoseRangliste(
  locationId: string,
): Promise<FahrerPrognoseRanglistenEintrag[]> {
  const sb = createServiceClient();

  const { data: rows } = await sb
    .from('fahrer_prognose_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('prognose_score', { ascending: false });

  if (!rows || rows.length === 0) return [];

  // Fahrer-Namen laden
  const driverIds = rows.map(r => r.driver_id as string);
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, auth_user_id')
    .in('id', driverIds);

  const authIdMap = new Map<string, string>();
  for (const d of drivers ?? []) {
    if (d.id && d.auth_user_id) authIdMap.set(d.id as string, d.auth_user_id as string);
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

  return rows.map((r, idx) => {
    const authId = authIdMap.get(r.driver_id as string) ?? null;
    const driverName = authId ? (nameMap.get(authId) ?? null) : null;
    const initials = driverName
      ? driverName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
      : '?';

    return {
      rang:               idx + 1,
      driverId:           r.driver_id as string,
      locationId:         r.location_id as string,
      prognoseScore:      Number(r.prognose_score),
      kategorie:          r.kategorie as PrognoseKategorie,
      punctualityScore:   r.punctuality_score  != null ? Number(r.punctuality_score)  : null,
      deliveryTimeScore:  r.delivery_time_score != null ? Number(r.delivery_time_score) : null,
      stornoScore:        r.storno_score        != null ? Number(r.storno_score)        : null,
      efficiencyScore:    r.efficiency_score    != null ? Number(r.efficiency_score)    : null,
      toursAnalyzed:      r.tours_analyzed as number,
      daysAnalyzed:       r.days_analyzed as number,
      trendDirection:     r.trend_direction as TrendDirection,
      computedAt:         r.computed_at as string,
      driverName,
      initials,
    };
  });
}

// ── Detail für einen Fahrer ───────────────────────────────────────────────────

export async function getDriverPrognoseDetail(
  driverId: string,
  locationId: string,
): Promise<FahrerPrognoseSnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('fahrer_prognose_snapshots')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;

  return {
    driverId:          data.driver_id as string,
    locationId:        data.location_id as string,
    prognoseScore:     Number(data.prognose_score),
    kategorie:         data.kategorie as PrognoseKategorie,
    punctualityScore:  data.punctuality_score  != null ? Number(data.punctuality_score)  : null,
    deliveryTimeScore: data.delivery_time_score != null ? Number(data.delivery_time_score) : null,
    stornoScore:       data.storno_score        != null ? Number(data.storno_score)        : null,
    efficiencyScore:   data.efficiency_score    != null ? Number(data.efficiency_score)    : null,
    toursAnalyzed:     data.tours_analyzed as number,
    daysAnalyzed:      data.days_analyzed as number,
    trendDirection:    data.trend_direction as TrendDirection,
    computedAt:        data.computed_at as string,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldPrognoseSnapshots(daysOld = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_fahrer_prognose_snapshots', { days_old: daysOld });
  return { pruned: (data as number | null) ?? 0 };
}
