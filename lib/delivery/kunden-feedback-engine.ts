/**
 * lib/delivery/kunden-feedback-engine.ts — Phase 418
 *
 * Kunden-Feedback-Engine: Echtzeit-Auswertung von Kundenbewertungen
 * (1–5 Sterne) aus customer_delivery_ratings.
 *
 * Public API:
 *   getKundenzufriedenheitsDashboard(locationId, days?)
 *     → Gesamt-KPIs, Trend, Fahrer-Rangliste, Zonen-Heatmap, Tageszeit-Analyse
 *   getDriverRatingRangliste(locationId, limit?)
 *     → Fahrer sortiert nach Ø-Kundenbewertung
 *   getZoneRatingHeatmap(locationId, days?)
 *     → Ø-Rating je Lieferzone
 *   getTageszeitRating(locationId, days?)
 *     → Ø-Rating je Tagesstunde
 *   getFahrerEigeneBewertung(driverId, locationId, days?)
 *     → Eigene Bewertungs-KPIs für Fahrer-App-Widget
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface RatingKpis {
  avgRating:     number;
  totalCount:    number;
  positiveCount: number;
  negativeCount: number;
  positivePct:   number;
  negativePct:   number;
  fiveStarCount: number;
  oneStarCount:  number;
}

export interface RatingTrend {
  day:         string;
  total:       number;
  avgRating:   number;
  positivePct: number;
}

export interface TrendDirection {
  direction: 'up' | 'stable' | 'down';
  delta:     number;
}

export interface DriverRatingEntry {
  rang:          number;
  driverId:      string;
  driverName:    string | null;
  initials:      string;
  totalRatings:  number;
  avgRating:     number;
  positiveCount: number;
  negativeCount: number;
  fiveStarCount: number;
  oneStarCount:  number;
  lastRatingAt:  string | null;
}

export interface ZoneRatingEntry {
  zone:          string;
  totalRatings:  number;
  avgRating:     number;
  positiveCount: number;
  negativeCount: number;
  fiveStarCount: number;
  oneStarCount:  number;
  qualityLabel:  'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'keine_daten';
}

export interface TageszeitEntry {
  hourOfDay:     number;
  totalRatings:  number;
  avgRating:     number;
  negativeCount: number;
  positiveCount: number;
  qualityLabel:  'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'keine_daten';
}

export interface RecentRating {
  id:        string;
  rating:    number;
  comment:   string | null;
  createdAt: string;
  driverId:  string | null;
}

export interface KundenzufriedenheitsDashboard {
  kpis:              RatingKpis;
  trend:             TrendDirection;
  dailyTrend:        RatingTrend[];
  driverRangliste:   DriverRatingEntry[];
  zoneHeatmap:       ZoneRatingEntry[];
  tageszeitAnalyse:  TageszeitEntry[];
  recentRatings:     RecentRating[];
  worstHour:         number | null;
  bestDriverName:    string | null;
  worstZone:         string | null;
}

export interface FahrerEigeneBewertung {
  driverId:      string;
  avgRating:     number;
  totalRatings:  number;
  positiveCount: number;
  negativeCount: number;
  fiveStarCount: number;
  trend:         'up' | 'stable' | 'down';
  trendDelta:    number;
  lastRatingAt:  string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toQualityLabel(avg: number, count: number): ZoneRatingEntry['qualityLabel'] {
  if (count < 3) return 'keine_daten';
  if (avg >= 4.5) return 'excellent';
  if (avg >= 4.0) return 'good';
  if (avg >= 3.5) return 'fair';
  if (avg >= 3.0) return 'poor';
  return 'critical';
}

function toInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Hauptfunktion: Dashboard ──────────────────────────────────────────────────

export async function getKundenzufriedenheitsDashboard(
  locationId: string,
  days = 30,
): Promise<KundenzufriedenheitsDashboard> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const prev7dFrom = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [currentRes, prev7dRes, driverRes, zoneRes, tageszeitRes, recentRes, dailyTrendRes] =
    await Promise.all([
      // Aktuelle Periode KPIs
      sb
        .from('customer_delivery_ratings')
        .select('rating')
        .eq('location_id', locationId)
        .gte('created_at', since),

      // Vorherige 7d für Trend (letzte 7d vs. davor)
      sb
        .from('customer_delivery_ratings')
        .select('rating')
        .eq('location_id', locationId)
        .gte('created_at', prev7dFrom)
        .lt('created_at', since7d),

      // Fahrer-Rangliste via View (letzte 90 Tage)
      sb
        .from('v_driver_rating_rangliste')
        .select('rang, driver_id, driver_name, total_ratings, avg_rating, positive_count, negative_count, five_star_count, one_star_count, last_rating_at')
        .eq('location_id', locationId)
        .order('rang', { ascending: true })
        .limit(15),

      // Zonen-Heatmap via View
      sb
        .from('v_zone_rating_summary')
        .select('zone, total_ratings, avg_rating, positive_count, negative_count, five_star_count, one_star_count')
        .eq('location_id', locationId)
        .order('avg_rating', { ascending: true }),

      // Tageszeit-Analyse via View
      sb
        .from('v_tageszeit_rating')
        .select('hour_of_day, total_ratings, avg_rating, negative_count, positive_count')
        .eq('location_id', locationId)
        .order('hour_of_day', { ascending: true }),

      // Letzte 8 Bewertungen mit Kommentar
      sb
        .from('customer_delivery_ratings')
        .select('id, rating, comment, created_at, driver_id')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(8),

      // Täglicher Trend (30 Tage) via RPC
      sb.rpc('get_rating_daily_trend', {
        p_location_id: locationId,
        p_days:        days,
      }),
    ]);

  const current = (currentRes.data ?? []) as Array<{ rating: number }>;
  const prev7d  = (prev7dRes.data ?? []) as Array<{ rating: number }>;

  // KPIs
  const avgCurrent = current.length
    ? current.reduce((s, r) => s + r.rating, 0) / current.length
    : 0;
  const avgPrev7d = prev7d.length
    ? prev7d.reduce((s, r) => s + r.rating, 0) / prev7d.length
    : 0;
  const delta    = Math.round((avgCurrent - avgPrev7d) * 10) / 10;
  const positive = current.filter((r) => r.rating >= 4).length;
  const negative = current.filter((r) => r.rating <= 2).length;
  const five     = current.filter((r) => r.rating === 5).length;
  const one      = current.filter((r) => r.rating === 1).length;

  const kpis: RatingKpis = {
    avgRating:     Math.round(avgCurrent * 10) / 10,
    totalCount:    current.length,
    positiveCount: positive,
    negativeCount: negative,
    positivePct:   current.length ? Math.round((positive / current.length) * 100) : 0,
    negativePct:   current.length ? Math.round((negative / current.length) * 100) : 0,
    fiveStarCount: five,
    oneStarCount:  one,
  };

  const trend: TrendDirection = {
    direction: Math.abs(delta) < 0.1 ? 'stable' : delta > 0 ? 'up' : 'down',
    delta,
  };

  // Fahrer-Rangliste
  const driverRangliste: DriverRatingEntry[] = (driverRes.data ?? []).map((r) => ({
    rang:          Number(r.rang),
    driverId:      r.driver_id as string,
    driverName:    (r.driver_name as string | null) ?? null,
    initials:      toInitials(r.driver_name as string | null),
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    positiveCount: Number(r.positive_count),
    negativeCount: Number(r.negative_count),
    fiveStarCount: Number(r.five_star_count),
    oneStarCount:  Number(r.one_star_count),
    lastRatingAt:  (r.last_rating_at as string | null) ?? null,
  }));

  // Zonen-Heatmap
  const zoneHeatmap: ZoneRatingEntry[] = (zoneRes.data ?? []).map((r) => ({
    zone:          r.zone as string,
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    positiveCount: Number(r.positive_count),
    negativeCount: Number(r.negative_count),
    fiveStarCount: Number(r.five_star_count),
    oneStarCount:  Number(r.one_star_count),
    qualityLabel:  toQualityLabel(Number(r.avg_rating), Number(r.total_ratings)),
  }));

  // Tageszeit-Analyse
  const tageszeitAnalyse: TageszeitEntry[] = (tageszeitRes.data ?? []).map((r) => ({
    hourOfDay:     Number(r.hour_of_day),
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    negativeCount: Number(r.negative_count),
    positiveCount: Number(r.positive_count),
    qualityLabel:  toQualityLabel(Number(r.avg_rating), Number(r.total_ratings)),
  }));

  // Recent ratings
  const recentRatings: RecentRating[] = (recentRes.data ?? []).map((r) => ({
    id:        r.id as string,
    rating:    r.rating as number,
    comment:   (r.comment as string | null) ?? null,
    createdAt: r.created_at as string,
    driverId:  (r.driver_id as string | null) ?? null,
  }));

  // Daily trend
  const dailyTrend: RatingTrend[] = (dailyTrendRes.data ?? []).map((r) => ({
    day:         r.rating_day as string,
    total:       Number(r.total),
    avgRating:   Number(r.avg_rating),
    positivePct: Number(r.positive_pct ?? 0),
  }));

  // Derived highlights
  const worstHour = tageszeitAnalyse.length
    ? tageszeitAnalyse.reduce((w, t) =>
        t.totalRatings >= 3 && t.avgRating < (w?.avgRating ?? 99) ? t : w,
      tageszeitAnalyse[0],
    )?.hourOfDay ?? null
    : null;

  const bestDriver = driverRangliste.find((d) => d.totalRatings >= 5);
  const bestDriverName = bestDriver?.driverName ?? null;

  const worstZoneEntry = zoneHeatmap.find((z) => z.totalRatings >= 3 && z.zone !== 'unbekannt');
  const worstZone = worstZoneEntry?.zone ?? null;

  return {
    kpis,
    trend,
    dailyTrend,
    driverRangliste,
    zoneHeatmap,
    tageszeitAnalyse,
    recentRatings,
    worstHour,
    bestDriverName,
    worstZone,
  };
}

// ── Fahrer-Rangliste ──────────────────────────────────────────────────────────

export async function getDriverRatingRangliste(
  locationId: string,
  limit = 15,
): Promise<DriverRatingEntry[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_driver_rating_rangliste')
    .select('rang, driver_id, driver_name, total_ratings, avg_rating, positive_count, negative_count, five_star_count, one_star_count, last_rating_at')
    .eq('location_id', locationId)
    .order('rang', { ascending: true })
    .limit(limit);

  return (data ?? []).map((r) => ({
    rang:          Number(r.rang),
    driverId:      r.driver_id as string,
    driverName:    (r.driver_name as string | null) ?? null,
    initials:      toInitials(r.driver_name as string | null),
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    positiveCount: Number(r.positive_count),
    negativeCount: Number(r.negative_count),
    fiveStarCount: Number(r.five_star_count),
    oneStarCount:  Number(r.one_star_count),
    lastRatingAt:  (r.last_rating_at as string | null) ?? null,
  }));
}

// ── Zonen-Heatmap ─────────────────────────────────────────────────────────────

export async function getZoneRatingHeatmap(locationId: string): Promise<ZoneRatingEntry[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_zone_rating_summary')
    .select('zone, total_ratings, avg_rating, positive_count, negative_count, five_star_count, one_star_count')
    .eq('location_id', locationId)
    .order('avg_rating', { ascending: true });

  return (data ?? []).map((r) => ({
    zone:          r.zone as string,
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    positiveCount: Number(r.positive_count),
    negativeCount: Number(r.negative_count),
    fiveStarCount: Number(r.five_star_count),
    oneStarCount:  Number(r.one_star_count),
    qualityLabel:  toQualityLabel(Number(r.avg_rating), Number(r.total_ratings)),
  }));
}

// ── Tageszeit-Analyse ─────────────────────────────────────────────────────────

export async function getTageszeitRating(locationId: string): Promise<TageszeitEntry[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_tageszeit_rating')
    .select('hour_of_day, total_ratings, avg_rating, negative_count, positive_count')
    .eq('location_id', locationId)
    .order('hour_of_day', { ascending: true });

  return (data ?? []).map((r) => ({
    hourOfDay:     Number(r.hour_of_day),
    totalRatings:  Number(r.total_ratings),
    avgRating:     Number(r.avg_rating),
    negativeCount: Number(r.negative_count),
    positiveCount: Number(r.positive_count),
    qualityLabel:  toQualityLabel(Number(r.avg_rating), Number(r.total_ratings)),
  }));
}

// ── Fahrer: Eigene Bewertung (für Fahrer-App) ─────────────────────────────────

export async function getFahrerEigeneBewertung(
  driverId: string,
  locationId: string,
  days = 30,
): Promise<FahrerEigeneBewertung | null> {
  const sb = createServiceClient();
  const since    = new Date(Date.now() - days * 86_400_000).toISOString();
  const since7d  = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const prev7dFrom = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [currentRes, prev7dRes] = await Promise.all([
    sb
      .from('customer_delivery_ratings')
      .select('rating, created_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    sb
      .from('customer_delivery_ratings')
      .select('rating')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .gte('created_at', prev7dFrom)
      .lt('created_at', since7d),
  ]);

  const current = (currentRes.data ?? []) as Array<{ rating: number; created_at: string }>;
  if (current.length === 0) return null;

  const avgCurrent = current.reduce((s, r) => s + r.rating, 0) / current.length;
  const prev7d     = (prev7dRes.data ?? []) as Array<{ rating: number }>;
  const avgPrev    = prev7d.length
    ? prev7d.reduce((s, r) => s + r.rating, 0) / prev7d.length
    : avgCurrent;
  const delta      = Math.round((avgCurrent - avgPrev) * 10) / 10;

  return {
    driverId,
    avgRating:     Math.round(avgCurrent * 10) / 10,
    totalRatings:  current.length,
    positiveCount: current.filter((r) => r.rating >= 4).length,
    negativeCount: current.filter((r) => r.rating <= 2).length,
    fiveStarCount: current.filter((r) => r.rating === 5).length,
    trend:         Math.abs(delta) < 0.1 ? 'stable' : delta > 0 ? 'up' : 'down',
    trendDelta:    delta,
    lastRatingAt:  current[0]?.created_at ?? null,
  };
}
