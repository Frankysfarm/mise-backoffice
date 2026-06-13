/**
 * lib/delivery/rating.ts
 *
 * Driver Auto-Rating + Delivery Performance Recording.
 * Schreibt delivery_performance-Einträge und aktualisiert mise_drivers.rating
 * basierend auf tatsächlicher vs. geschätzter Lieferzeit.
 *
 * Der DB-Trigger trg_perf_on_stop_complete (Migration 016) übernimmt das
 * automatische Recording beim Stop-Abschluss über Supabase direkt.
 * Diese Funktionen sind für explizite API-Aufrufe (z.B. nach Batch-Abschluss).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface PerformanceRecord {
  driverId: string;
  orderId: string | null;
  batchId: string | null;
  batchStopId?: string | null;
  locationId: string | null;
  zone?: string | null;
  etaEarliestAt: string | null;
  etaLatestAt: string | null;
  completedAt: string;
}

/**
 * Schreibt einen delivery_performance-Eintrag manuell.
 * Wird genutzt wenn der Trigger nicht greift (z.B. Bulk-Nachholen).
 * Fire-and-forget kompatibel.
 */
export async function recordDeliveryPerformance(rec: PerformanceRecord): Promise<void> {
  const sb = createServiceClient();

  const completedAt = new Date(rec.completedAt);
  const etaLatest   = rec.etaLatestAt ? new Date(rec.etaLatestAt) : null;

  const etaDeviationMin = etaLatest
    ? Math.round((completedAt.getTime() - etaLatest.getTime()) / 60_000)
    : null;
  const onTime = etaLatest ? completedAt <= etaLatest : null;

  const { error } = await sb.from('delivery_performance').insert({
    driver_id:        rec.driverId,
    order_id:         rec.orderId,
    batch_id:         rec.batchId,
    batch_stop_id:    rec.batchStopId ?? null,
    location_id:      rec.locationId,
    zone:             rec.zone ?? null,
    eta_earliest_at:  rec.etaEarliestAt,
    eta_latest_at:    rec.etaLatestAt,
    completed_at:     rec.completedAt,
    eta_deviation_min: etaDeviationMin,
    on_time:          onTime,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[delivery/rating] recordDeliveryPerformance failed:', error.message);
  }
}

/**
 * Löst die DB-Funktion recompute_driver_rating() aus.
 * Aktualisiert mise_drivers.rating (1–5) und avg_delivery_min
 * basierend auf den letzten 30 delivery_performance-Einträgen des Fahrers.
 *
 * Benötigt mindestens 3 abgeschlossene Lieferungen mit ETA — sonst kein Update.
 */
export async function recomputeDriverRating(driverId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.rpc('recompute_driver_rating', { p_driver_id: driverId });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[delivery/rating] recomputeDriverRating failed:', error.message);
  }
}

export interface SlaStats {
  totalStops: number;
  onTimeCount: number;
  lateCount: number;
  onTimePct: number;
  avgDeviationMin: number | null;
  avgDeliveryMin: number | null;
}

/**
 * Lädt aggregierte SLA-Statistiken für eine Location aus v_delivery_sla.
 * Fallback auf delivery_performance direkt wenn View fehlt.
 */
export async function getSlaSummary(
  locationId: string,
  days = 7,
): Promise<SlaStats & { byDriver: Record<string, SlaStats>; byZone: Record<string, SlaStats> }> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('delivery_performance')
    .select('driver_id, zone, on_time, eta_deviation_min, delivery_min')
    .eq('location_id', locationId)
    .gte('recorded_at', since)
    .not('eta_latest_at', 'is', null);

  const rows = data ?? [];

  function aggregate(subset: typeof rows): SlaStats {
    const total = subset.length;
    const onTime = subset.filter((r) => r.on_time === true).length;
    const deviations = subset
      .map((r) => r.eta_deviation_min as number | null)
      .filter((v): v is number => v !== null);
    const deliveryMins = subset
      .map((r) => r.delivery_min as number | null)
      .filter((v): v is number => v !== null && v > 0);

    return {
      totalStops:      total,
      onTimeCount:     onTime,
      lateCount:       total - onTime,
      onTimePct:       total > 0 ? Math.round((onTime / total) * 1000) / 10 : 0,
      avgDeviationMin: deviations.length > 0
        ? Math.round(deviations.reduce((a, b) => a + b, 0) / deviations.length * 10) / 10
        : null,
      avgDeliveryMin:  deliveryMins.length > 0
        ? Math.round(deliveryMins.reduce((a, b) => a + b, 0) / deliveryMins.length * 10) / 10
        : null,
    };
  }

  // Per-Driver aufschlüsseln
  const driverMap = new Map<string, typeof rows>();
  for (const r of rows) {
    const id = r.driver_id as string;
    if (!driverMap.has(id)) driverMap.set(id, []);
    driverMap.get(id)!.push(r);
  }
  const byDriver: Record<string, SlaStats> = {};
  for (const [id, subset] of driverMap) byDriver[id] = aggregate(subset);

  // Per-Zone aufschlüsseln
  const zoneMap = new Map<string, typeof rows>();
  for (const r of rows) {
    const z = (r.zone as string | null) ?? 'unknown';
    if (!zoneMap.has(z)) zoneMap.set(z, []);
    zoneMap.get(z)!.push(r);
  }
  const byZone: Record<string, SlaStats> = {};
  for (const [z, subset] of zoneMap) byZone[z] = aggregate(subset);

  return { ...aggregate(rows), byDriver, byZone };
}

// ── Phase 106: Recency-Weighted Rating Breakdown ───────────────────────────

export interface RatingBreakdown {
  driverId: string;
  currentRating: number | null;
  totalDeliveries: number;
  wOnTimePct: number | null;       // recency-weighted on-time %
  wAvgDevMin: number | null;       // recency-weighted ETA deviation
  avgDeliveryMin: number | null;
  totalCustRatings: number;
  wCustRating: number | null;      // recency-weighted customer rating
  recencyConcentration: number | null; // 0–1: share of last 5 deliveries in total weight
}

/**
 * Lädt die Recency-gewichteten Rating-Komponenten für einen Fahrer
 * aus v_driver_rating_breakdown (Migration 064).
 */
export async function getDriverRatingBreakdown(
  driverId: string,
): Promise<RatingBreakdown | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_driver_rating_breakdown')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();

  if (!data) return null;
  return {
    driverId:             data.driver_id as string,
    currentRating:        (data.current_rating as number | null),
    totalDeliveries:      (data.total_deliveries as number) ?? 0,
    wOnTimePct:           (data.w_on_time_pct as number | null),
    wAvgDevMin:           (data.w_avg_dev_min as number | null),
    avgDeliveryMin:       (data.avg_delivery_min as number | null),
    totalCustRatings:     (data.total_cust_ratings as number) ?? 0,
    wCustRating:          (data.w_cust_rating as number | null),
    recencyConcentration: (data.recency_concentration as number | null),
  };
}

/**
 * Berechnet die Recency-gewichteten Ratings für alle Fahrer einer Location neu.
 * Gedacht für nächtlichen Cron-Job (isReportTick).
 */
export async function batchRecomputeRatingsForLocation(
  locationId: string,
): Promise<{ recomputed: number; errors: number }> {
  const sb = createServiceClient();
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('location_id', locationId)
    .eq('active', true);

  let recomputed = 0;
  let errors = 0;
  for (const d of drivers ?? []) {
    try {
      const { error } = await sb.rpc('recompute_driver_rating', {
        p_driver_id: d.id as string,
      });
      if (error) errors++;
      else recomputed++;
    } catch {
      errors++;
    }
  }
  return { recomputed, errors };
}
