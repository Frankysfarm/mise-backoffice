/**
 * lib/delivery/driver-performance.ts
 *
 * Driver Performance Snapshot Engine — Phase 56
 *
 * Berechnet tägliche KPI-Snapshots pro Fahrer und speichert sie in
 * driver_performance_snapshots. Grundlage für Wochen-/Monats-Leaderboard.
 *
 * Funktionen:
 *  - computeAndSaveSnapshot()     — Tages-Snapshot für einen Fahrer berechnen + upserten
 *  - snapshotAllDriversForLocation() — alle Fahrer einer Location snapshotten
 *  - snapshotAllLocations()        — Cron-Wrapper für alle aktiven Locations
 *  - getLeaderboard()              — geranktes Leaderboard (today/week/month)
 *  - getDriverHistory()            — persönlicher Trend-Verlauf (N Tage)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getNetActiveMinutes } from '@/lib/delivery/shifts';

// ============================================================
// Typen
// ============================================================

export type LeaderboardPeriod = 'today' | 'week' | 'month';

export interface DriverSnapshot {
  driverId: string;
  locationId: string;
  snapshotDate: string;          // ISO date (YYYY-MM-DD)
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;     // 0.0–1.0
  activeMinutes: number;
  avgRating: number | null;
  totalRatings: number;
  totalEarningsEur: number;
}

export interface LeaderboardEntry {
  rank: number;
  driverId: string;
  locationId: string;
  authUserId: string | null;
  driverName: string | null;
  initials: string;
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  activeMinutes: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalRatings: number;
  earningsEur: number;
  lastActiveDate: string;
  activeDays: number;
}

export interface DriverHistoryPoint {
  date: string;                  // YYYY-MM-DD
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalEarningsEur: number;
  activeMinutes: number;
}

export interface SnapshotResult {
  driverIds: string[];
  snapshots: number;
  errors: number;
}

// ============================================================
// Snapshot-Berechnung
// ============================================================

/**
 * Berechnet den Tages-Snapshot für einen Fahrer und schreibt ihn per UPSERT.
 * Aggregiert aus: mise_delivery_batches, mise_delivery_batch_stops,
 *                 eta_accuracy_log, customer_delivery_ratings, driver_payout_records.
 */
export async function computeAndSaveSnapshot(
  driverId: string,
  locationId: string,
  date: Date = new Date(),
): Promise<DriverSnapshot | null> {
  const sb = createServiceClient();

  const dateStr = date.toISOString().slice(0, 10);
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd   = `${dateStr}T23:59:59.999Z`;

  // ── 1. Abgeschlossene Touren für diesen Tag ──────────────────────────────
  const { data: batches, error: batchErr } = await sb
    .from('mise_delivery_batches')
    .select('id, total_distance_km, created_at, state')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('state', 'completed')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (batchErr) {
    console.warn('[driver-performance] batches error:', batchErr.message);
    return null;
  }

  const toursCompleted = batches?.length ?? 0;
  const totalDistanceKm = (batches ?? []).reduce(
    (sum, b) => sum + (Number(b.total_distance_km) || 0), 0,
  );

  // Active minutes: aus Schicht-Daten (Netto, Pausen abgezogen) — Migration 047
  // Fallback: Tour-Zeitspanne wenn keine Schichtdaten vorhanden
  let activeMinutes = await getNetActiveMinutes(driverId, date).catch(() => 0);
  if (activeMinutes === 0 && batches && batches.length > 0) {
    const starts = batches.map((b) => new Date(b.created_at as string).getTime());
    const firstStart = Math.min(...starts);
    const lastEnd = new Date(dayEnd).getTime();
    activeMinutes = Math.max(0, Math.round((Math.min(lastEnd, Date.now()) - firstStart) / 60_000));
    activeMinutes = Math.min(activeMinutes, 720);
  }

  const batchIds = (batches ?? []).map((b) => b.id as string);

  // ── 2. Abgeschlossene Dropoff-Stops ──────────────────────────────────────
  let stopsCompleted = 0;
  if (batchIds.length > 0) {
    const { count } = await sb
      .from('mise_delivery_batch_stops')
      .select('id', { count: 'exact', head: true })
      .in('batch_id', batchIds)
      .eq('type', 'dropoff')
      .not('completed_at', 'is', null);

    stopsCompleted = count ?? 0;
  }

  // ── 3. ETA-Genauigkeit (on-time rate + avg delivery min) ─────────────────
  let avgDeliveryMin: number | null = null;
  let onTimeRate: number | null = null;

  const { data: etaData } = await sb
    .from('eta_accuracy_log')
    .select('actual_min, on_time')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('delivered_at', dayStart)
    .lte('delivered_at', dayEnd)
    .not('actual_min', 'is', null);

  if (etaData && etaData.length > 0) {
    const actuals = etaData.map((r) => Number(r.actual_min)).filter((v) => v > 0);
    if (actuals.length > 0) {
      avgDeliveryMin = Math.round(actuals.reduce((s, v) => s + v, 0) / actuals.length * 10) / 10;
    }
    const onTimeCount = etaData.filter((r) => r.on_time === true).length;
    onTimeRate = Math.round((onTimeCount / etaData.length) * 10000) / 10000;
  }

  // ── 4. Kundenbewertungen ──────────────────────────────────────────────────
  let avgRating: number | null = null;
  let totalRatings = 0;

  const { data: ratingData } = await sb
    .from('customer_delivery_ratings')
    .select('rating')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (ratingData && ratingData.length > 0) {
    totalRatings = ratingData.length;
    const sum = ratingData.reduce((s, r) => s + (r.rating as number), 0);
    avgRating = Math.round((sum / totalRatings) * 100) / 100;
  }

  // ── 5. Verdienst ──────────────────────────────────────────────────────────
  let totalEarningsEur = 0;

  const { data: payoutData } = await sb
    .from('driver_payout_records')
    .select('total_amount')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('completed_at', dayStart)
    .lte('completed_at', dayEnd);

  if (payoutData && payoutData.length > 0) {
    totalEarningsEur = payoutData.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
    totalEarningsEur = Math.round(totalEarningsEur * 100) / 100;
  }

  // ── 6. Upsert ─────────────────────────────────────────────────────────────
  const snapshot: Omit<DriverSnapshot, 'driverId' | 'locationId' | 'snapshotDate'> & {
    driver_id: string; location_id: string; snapshot_date: string;
  } = {
    driver_id:          driverId,
    location_id:        locationId,
    snapshot_date:      dateStr,
    tours_completed:    toursCompleted,
    stops_completed:    stopsCompleted,
    total_distance_km:  Math.round(totalDistanceKm * 100) / 100,
    avg_delivery_min:   avgDeliveryMin,
    on_time_rate:       onTimeRate,
    active_minutes:     activeMinutes,
    avg_rating:         avgRating,
    total_ratings:      totalRatings,
    total_earnings_eur: totalEarningsEur,
    updated_at:         new Date().toISOString(),
  } as unknown as typeof snapshot;

  const { error: upsertErr } = await sb
    .from('driver_performance_snapshots')
    .upsert(snapshot as Record<string, unknown>, { onConflict: 'driver_id,location_id,snapshot_date' });

  if (upsertErr) {
    // Tabelle noch nicht migriert → graceful
    if (upsertErr.message.includes('driver_performance_snapshots')) return null;
    console.warn('[driver-performance] upsert error:', upsertErr.message);
    return null;
  }

  return {
    driverId,
    locationId,
    snapshotDate:      dateStr,
    toursCompleted,
    stopsCompleted,
    totalDistanceKm:   Math.round(totalDistanceKm * 100) / 100,
    avgDeliveryMin,
    onTimeRate,
    activeMinutes,
    avgRating,
    totalRatings,
    totalEarningsEur,
  };
}

/**
 * Snapshottet alle aktiven Fahrer einer Location für ein Datum.
 */
export async function snapshotAllDriversForLocation(
  locationId: string,
  date: Date = new Date(),
): Promise<SnapshotResult> {
  const sb = createServiceClient();

  // Fahrer dieser Location (via employees + auth_user_id)
  const { data: employees } = await sb
    .from('employees')
    .select('auth_user_id')
    .eq('location_id', locationId)
    .eq('active', true);

  const authIds = (employees ?? []).map((e) => e.auth_user_id as string).filter(Boolean);
  if (authIds.length === 0) return { driverIds: [], snapshots: 0, errors: 0 };

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .in('auth_user_id', authIds)
    .eq('active', true);

  if (!drivers || drivers.length === 0) return { driverIds: [], snapshots: 0, errors: 0 };

  let snapshots = 0;
  let errors = 0;
  const driverIds: string[] = [];

  for (const d of drivers) {
    const result = await computeAndSaveSnapshot(d.id as string, locationId, date);
    driverIds.push(d.id as string);
    if (result) snapshots++;
    else errors++;
  }

  return { driverIds, snapshots, errors };
}

/**
 * Cron-Wrapper: snapshottet gestrigen Tag für alle aktiven Locations.
 * Läuft täglich um 02:00 UTC (nach Mitternacht Abschluss).
 */
export async function snapshotAllLocations(
  date?: Date,
): Promise<{ locations: number; snapshots: number; errors: number }> {
  const sb = createServiceClient();

  // Gestern snapshotten (Daten vollständig)
  const targetDate = date ?? (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  })();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locations || locations.length === 0) return { locations: 0, snapshots: 0, errors: 0 };

  let totalSnapshots = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    const result = await snapshotAllDriversForLocation(loc.id as string, targetDate).catch(
      () => ({ driverIds: [], snapshots: 0, errors: 1 }),
    );
    totalSnapshots += result.snapshots;
    totalErrors    += result.errors;
  }

  return { locations: locations.length, snapshots: totalSnapshots, errors: totalErrors };
}

// ============================================================
// Leaderboard-Abfragen
// ============================================================

const VIEW_MAP: Record<LeaderboardPeriod, string> = {
  today: 'v_driver_leaderboard_today',
  week:  'v_driver_leaderboard_week',
  month: 'v_driver_leaderboard_month',
};

const EARNINGS_COL: Record<LeaderboardPeriod, string> = {
  today: 'total_earnings_eur',
  week:  'earnings_week_eur',
  month: 'earnings_month_eur',
};

const STOPS_COL: Record<LeaderboardPeriod, string> = {
  today: 'stops_completed',
  week:  'stops_week',
  month: 'stops_month',
};

const TOURS_COL: Record<LeaderboardPeriod, string> = {
  today: 'tours_completed',
  week:  'tours_week',
  month: 'tours_month',
};

const DISTANCE_COL: Record<LeaderboardPeriod, string> = {
  today: 'total_distance_km',
  week:  'distance_week_km',
  month: 'distance_month_km',
};

const ACTIVE_MIN_COL: Record<LeaderboardPeriod, string> = {
  today: 'active_minutes',
  week:  'active_minutes_week',
  month: 'active_minutes_month',
};

/**
 * Lädt das gerankete Leaderboard für eine Location.
 * Reichert mit Employee-Namen an.
 */
export async function getLeaderboard(
  locationId: string,
  period: LeaderboardPeriod = 'week',
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const sb = createServiceClient();

  const viewName = VIEW_MAP[period];

  const { data: rows, error } = await sb
    .from(viewName)
    .select('*')
    .eq('location_id', locationId)
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    // View noch nicht migriert
    if (error.message.includes(viewName) || error.message.includes('does not exist')) return [];
    console.warn('[driver-performance] getLeaderboard error:', error.message);
    return [];
  }

  if (!rows || rows.length === 0) return [];

  // Employee-Namen nachladen
  const authIds = rows.map((r) => (r as Record<string, unknown>).auth_user_id as string).filter(Boolean);
  const empMap = new Map<string, string>();

  if (authIds.length > 0) {
    const { data: employees } = await sb
      .from('employees')
      .select('auth_user_id, vorname, nachname')
      .in('auth_user_id', authIds)
      .eq('location_id', locationId);

    for (const e of employees ?? []) {
      const name = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
      if (e.auth_user_id) empMap.set(e.auth_user_id as string, name);
    }
  }

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const authId = r.auth_user_id as string | null;
    const driverName = authId ? (empMap.get(authId) ?? null) : null;
    const nameParts = driverName?.split(' ') ?? [];
    const initials = nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (driverName?.[0]?.toUpperCase() ?? '?');

    return {
      rank:             Number(r.rank),
      driverId:         r.driver_id as string,
      locationId:       r.location_id as string,
      authUserId:       authId,
      driverName,
      initials,
      toursCompleted:   Number(r[TOURS_COL[period]] ?? 0),
      stopsCompleted:   Number(r[STOPS_COL[period]] ?? 0),
      totalDistanceKm:  Math.round(Number(r[DISTANCE_COL[period]] ?? 0) * 10) / 10,
      activeMinutes:    Number(r[ACTIVE_MIN_COL[period]] ?? 0),
      avgDeliveryMin:   r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
      onTimeRate:       r.on_time_rate     != null ? Number(r.on_time_rate)     : null,
      avgRating:        r.avg_rating       != null ? Number(r.avg_rating)       : null,
      totalRatings:     Number(r.total_ratings ?? 0),
      earningsEur:      Math.round(Number(r[EARNINGS_COL[period]] ?? 0) * 100) / 100,
      lastActiveDate:   (r.last_active_date as string) ?? '',
      activeDays:       Number(r.active_days ?? 1),
    } satisfies LeaderboardEntry;
  });
}

/**
 * Persönliche Performance-Historie: letzte N Tage.
 */
export async function getDriverHistory(
  driverId: string,
  locationId: string,
  days = 14,
): Promise<DriverHistoryPoint[]> {
  const sb = createServiceClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);

  const { data: rows, error } = await sb
    .from('driver_performance_snapshots')
    .select('snapshot_date, tours_completed, stops_completed, total_distance_km, avg_delivery_min, on_time_rate, avg_rating, total_earnings_eur, active_minutes')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', since.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  if (error) {
    if (error.message.includes('driver_performance_snapshots')) return [];
    console.warn('[driver-performance] getDriverHistory error:', error.message);
    return [];
  }

  return (rows ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      date:             row.snapshot_date as string,
      toursCompleted:   Number(row.tours_completed ?? 0),
      stopsCompleted:   Number(row.stops_completed ?? 0),
      totalDistanceKm:  Number(row.total_distance_km ?? 0),
      avgDeliveryMin:   row.avg_delivery_min != null ? Number(row.avg_delivery_min) : null,
      onTimeRate:       row.on_time_rate     != null ? Number(row.on_time_rate)     : null,
      avgRating:        row.avg_rating       != null ? Number(row.avg_rating)       : null,
      totalEarningsEur: Number(row.total_earnings_eur ?? 0),
      activeMinutes:    Number(row.active_minutes ?? 0),
    };
  });
}

/**
 * Rank eines einzelnen Fahrers im aktuellen Leaderboard.
 * Gibt null zurück wenn kein Snapshot vorhanden.
 */
export async function getDriverRank(
  driverId: string,
  locationId: string,
  period: LeaderboardPeriod = 'week',
): Promise<{ rank: number; total: number } | null> {
  const sb = createServiceClient();
  const viewName = VIEW_MAP[period];

  const { data: rows, error } = await sb
    .from(viewName)
    .select('driver_id, rank')
    .eq('location_id', locationId);

  if (error || !rows) return null;

  const total = rows.length;
  const mine  = rows.find((r) => (r as Record<string, unknown>).driver_id === driverId);
  if (!mine) return null;

  return { rank: Number((mine as Record<string, unknown>).rank), total };
}
