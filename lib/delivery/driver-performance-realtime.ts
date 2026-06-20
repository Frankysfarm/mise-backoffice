/**
 * lib/delivery/driver-performance-realtime.ts — Phase 310
 *
 * Echtzeit-Fahrer-Performance-Dashboard:
 * - Live-Score je Fahrer (Pünktlichkeit, Ø Lieferzeit, Rating)
 * - Woche-über-Woche Trend-Vergleich
 * - On-Shift-Status-Erkennung
 * - Stündliche Live-Score-Snapshots für Charts
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type DriverTrendDirection = 'up' | 'down' | 'flat';

export interface DriverLiveScore {
  driverId: string;
  authUserId: string | null;
  vehicle: string | null;
  currentState: string | null;
  currentZone: string | null;

  // Heutiger Tag
  today: {
    stopsCompleted: number;
    toursCompleted: number;
    avgDeliveryMin: number | null;
    onTimeRate: number | null;
    avgRating: number | null;
    earningsEur: number;
  };

  // Aktuelle Woche
  thisWeek: {
    stopsCompleted: number;
    toursCompleted: number;
    distanceKm: number;
    avgDeliveryMin: number | null;
    onTimeRate: number | null;
    avgRating: number | null;
    totalRatings: number;
    activeMinutes: number;
    earningsEur: number;
  };

  // Trend vs. Vorwoche
  trend: {
    stopsDelta: number;
    deliveryMinDelta: number | null;  // negativ = schneller = besser
    onTimeDelta: number | null;       // positiv = besser
    direction: DriverTrendDirection;
  };

  // Berechneter Live-Score 0–100
  liveScore: number;
  liveScoreLabel: 'Ausgezeichnet' | 'Gut' | 'Durchschnittlich' | 'Verbesserungsbedarf';
}

export interface DriverRealtimeDashboard {
  locationId: string;
  generatedAt: string;
  activeDrivers: number;
  drivers: DriverLiveScore[];
  summary: {
    avgLiveScore: number;
    avgOnTimeRate: number | null;
    avgDeliveryMin: number | null;
    totalStopsToday: number;
    topPerformerId: string | null;
  };
}

export interface LiveScoreSnapshotRow {
  driverId: string;
  locationId: string;
  liveScore: number;
  onTimeRate: number | null;
  avgDeliveryMin: number | null;
  stopsToday: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function computeLiveScore(data: {
  onTimeRate: number | null;
  avgDeliveryMin: number | null;
  avgRating: number | null;
  stopsToday: number;
  trendDirection: DriverTrendDirection;
}): number {
  let score = 60; // Basis

  // Pünktlichkeit: 0–30 Punkte
  if (data.onTimeRate !== null) {
    score += Math.round(data.onTimeRate * 30);
  } else {
    score += 15; // Neutral wenn keine Daten
  }

  // Ø Lieferzeit: 0–20 Punkte (≤ 20 Min = 20, ≥ 50 Min = 0)
  if (data.avgDeliveryMin !== null) {
    const timeScore = Math.max(0, Math.min(20, Math.round((50 - data.avgDeliveryMin) / 1.5)));
    score += timeScore;
  } else {
    score += 10;
  }

  // Rating: 0–20 Punkte (5★ = 20, 1★ = 4)
  if (data.avgRating !== null) {
    score += Math.round((data.avgRating / 5) * 20);
  } else {
    score += 10;
  }

  // Trend-Bonus: +5 aufsteigend, -5 absteigend
  if (data.trendDirection === 'up') score += 5;
  if (data.trendDirection === 'down') score -= 5;

  // Aktivitäts-Boost: Fahrer mit Stops heute
  if (data.stopsToday >= 5) score += 3;
  if (data.stopsToday >= 10) score += 2;

  return Math.min(100, Math.max(0, score));
}

function trendDirection(stopsDelta: number, onTimeDelta: number | null): DriverTrendDirection {
  if (stopsDelta > 2 || (onTimeDelta !== null && onTimeDelta > 0.05)) return 'up';
  if (stopsDelta < -2 || (onTimeDelta !== null && onTimeDelta < -0.05)) return 'down';
  return 'flat';
}

function liveScoreLabel(score: number): DriverLiveScore['liveScoreLabel'] {
  if (score >= 85) return 'Ausgezeichnet';
  if (score >= 70) return 'Gut';
  if (score >= 55) return 'Durchschnittlich';
  return 'Verbesserungsbedarf';
}

// ─── Haupt-Funktion ───────────────────────────────────────────────────────────

export async function getDriverPerformanceRealtime(
  locationId: string,
): Promise<DriverRealtimeDashboard> {
  const sb = createServiceClient();

  // Live-Daten aus der Realtime-View (Phase 310 Migration)
  const { data: rows, error } = await sb
    .from('v_driver_performance_realtime')
    .select('*')
    .eq('location_id', locationId);

  if (error) throw new Error(`driver-performance-realtime: ${error.message}`);

  const drivers: DriverLiveScore[] = (rows as Record<string, unknown>[] ?? []).map((r) => {
    const stopsDelta    = (r.stops_delta as number | null) ?? 0;
    const onTimeDelta   = r.on_time_delta as number | null;
    const direction     = trendDirection(stopsDelta, onTimeDelta);

    const todayOnTime = r.on_time_rate_today as number | null;
    const weekOnTime  = r.on_time_rate_this_week as number | null;
    const ratingToday = r.avg_rating_today as number | null;
    const ratingWeek  = r.avg_rating_this_week as number | null;

    // Beste verfügbare Pünktlichkeit: heute → diese Woche
    const bestOnTime  = todayOnTime ?? weekOnTime;
    const bestRating  = ratingToday ?? ratingWeek;
    const bestDelivMin = (r.avg_delivery_min_today as number | null)
                      ?? (r.avg_delivery_min_this_week as number | null);

    const liveScore = computeLiveScore({
      onTimeRate:     bestOnTime,
      avgDeliveryMin: bestDelivMin,
      avgRating:      bestRating,
      stopsToday:     (r.stops_today as number | null) ?? 0,
      trendDirection: direction,
    });

    return {
      driverId:     r.driver_id as string,
      authUserId:   r.auth_user_id as string | null,
      vehicle:      r.vehicle as string | null,
      currentState: r.current_state as string | null,
      currentZone:  r.current_zone as string | null,

      today: {
        stopsCompleted: (r.stops_today as number | null) ?? 0,
        toursCompleted: (r.tours_today as number | null) ?? 0,
        avgDeliveryMin: r.avg_delivery_min_today as number | null,
        onTimeRate:     todayOnTime,
        avgRating:      ratingToday,
        earningsEur:    (r.earnings_today_eur as number | null) ?? 0,
      },

      thisWeek: {
        stopsCompleted: (r.stops_this_week as number | null) ?? 0,
        toursCompleted: (r.tours_this_week as number | null) ?? 0,
        distanceKm:     (r.distance_this_week_km as number | null) ?? 0,
        avgDeliveryMin: r.avg_delivery_min_this_week as number | null,
        onTimeRate:     weekOnTime,
        avgRating:      ratingWeek,
        totalRatings:   (r.ratings_this_week as number | null) ?? 0,
        activeMinutes:  (r.active_min_this_week as number | null) ?? 0,
        earningsEur:    (r.earnings_this_week_eur as number | null) ?? 0,
      },

      trend: {
        stopsDelta,
        deliveryMinDelta: (r.delivery_min_delta as number | null) ?? null,
        onTimeDelta,
        direction,
      },

      liveScore,
      liveScoreLabel: liveScoreLabel(liveScore),
    };
  });

  // Nach Live-Score sortieren (beste zuerst)
  drivers.sort((a, b) => b.liveScore - a.liveScore);

  // Summary
  const totalStopsToday = drivers.reduce((s, d) => s + d.today.stopsCompleted, 0);
  const avgLiveScore = drivers.length > 0
    ? Math.round(drivers.reduce((s, d) => s + d.liveScore, 0) / drivers.length)
    : 0;

  const driversWithOnTime = drivers.filter((d) =>
    d.today.onTimeRate !== null || d.thisWeek.onTimeRate !== null,
  );
  const avgOnTimeRate = driversWithOnTime.length > 0
    ? driversWithOnTime.reduce(
        (s, d) => s + ((d.today.onTimeRate ?? d.thisWeek.onTimeRate)!),
        0,
      ) / driversWithOnTime.length
    : null;

  const driversWithDelivMin = drivers.filter((d) =>
    d.today.avgDeliveryMin !== null || d.thisWeek.avgDeliveryMin !== null,
  );
  const avgDeliveryMin = driversWithDelivMin.length > 0
    ? driversWithDelivMin.reduce(
        (s, d) => s + ((d.today.avgDeliveryMin ?? d.thisWeek.avgDeliveryMin)!),
        0,
      ) / driversWithDelivMin.length
    : null;

  const topPerformer = drivers[0] ?? null;

  return {
    locationId,
    generatedAt: new Date().toISOString(),
    activeDrivers: drivers.length,
    drivers,
    summary: {
      avgLiveScore,
      avgOnTimeRate: avgOnTimeRate !== null ? Math.round(avgOnTimeRate * 1000) / 1000 : null,
      avgDeliveryMin: avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
      totalStopsToday,
      topPerformerId: topPerformer?.driverId ?? null,
    },
  };
}

// ─── Live-Score-Snapshot speichern (für Trend-Charts) ─────────────────────────

export async function saveDriverLiveScoreSnapshots(locationId: string): Promise<number> {
  const sb = createServiceClient();

  // Aktuelle Performance holen
  let dashboard: DriverRealtimeDashboard;
  try {
    dashboard = await getDriverPerformanceRealtime(locationId);
  } catch {
    return 0;
  }

  if (dashboard.drivers.length === 0) return 0;

  const rows: LiveScoreSnapshotRow[] = dashboard.drivers.map((d) => ({
    driverId:       d.driverId,
    locationId,
    liveScore:      d.liveScore,
    onTimeRate:     d.today.onTimeRate ?? d.thisWeek.onTimeRate ?? null,
    avgDeliveryMin: d.today.avgDeliveryMin ?? d.thisWeek.avgDeliveryMin ?? null,
    stopsToday:     d.today.stopsCompleted,
  }));

  const { error } = await sb.from('driver_live_score_snapshots').insert(
    rows.map((r) => ({
      driver_id:        r.driverId,
      location_id:      r.locationId,
      live_score:       r.liveScore,
      on_time_rate:     r.onTimeRate,
      avg_delivery_min: r.avgDeliveryMin,
      stops_today:      r.stopsToday,
    })),
  );

  if (error) return 0;
  return rows.length;
}

export async function saveDriverLiveScoreSnapshotsAllLocations(): Promise<{
  locations: number;
  snapshots: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let total = 0;
  await Promise.allSettled(
    (locs as { id: string }[] ?? []).map(async (loc) => {
      const n = await saveDriverLiveScoreSnapshots(loc.id);
      total += n;
    }),
  );

  return { locations: (locs ?? []).length, snapshots: total };
}

// ─── Trend-Chart-Daten für einen Fahrer (letzte N Stunden) ────────────────────

export interface LiveScoreTrendPoint {
  snapshotAt: string;
  liveScore: number;
  onTimeRate: number | null;
  avgDeliveryMin: number | null;
  stopsToday: number;
}

export async function getDriverLiveScoreTrend(
  driverId: string,
  hours: number = 8,
): Promise<LiveScoreTrendPoint[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data } = await sb
    .from('driver_live_score_snapshots')
    .select('snapshot_at, live_score, on_time_rate, avg_delivery_min, stops_today')
    .eq('driver_id', driverId)
    .gte('snapshot_at', since)
    .order('snapshot_at', { ascending: true });

  return (data as Record<string, unknown>[] ?? []).map((r) => ({
    snapshotAt:     r.snapshot_at as string,
    liveScore:      r.live_score as number,
    onTimeRate:     r.on_time_rate as number | null,
    avgDeliveryMin: r.avg_delivery_min as number | null,
    stopsToday:     r.stops_today as number,
  }));
}

// ─── Altes Snapshot-Pruning ───────────────────────────────────────────────────

export async function pruneDriverLiveScoreSnapshots(): Promise<void> {
  const sb = createServiceClient();
  await sb.rpc('prune_driver_live_score_snapshots').throwOnError();
}
