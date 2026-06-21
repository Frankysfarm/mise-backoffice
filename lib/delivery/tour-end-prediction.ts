/**
 * lib/delivery/tour-end-prediction.ts — Phase 376
 *
 * Echtzeit-Vorhersage wann ein aktiver Batch alle Stops abgeschlossen hat.
 *
 * Algorithmus:
 *  1. Lade alle aktiven Batches (state: on_route / assigned)
 *  2. Berechne bisherigen Ø-Rhythmus (Min/Stop) aus abgeschlossenen Stops
 *  3. Projiziere auf verbleibende Stops → predicted_end_utc
 *  4. Confidence steigt mit mehr abgeschlossenen Stops (Datenbasis)
 *  5. Beim Batch-Abschluss: settle + Error-Berechnung
 *
 * Public API:
 *  predictTourEnd(batchId, locationId)        — Einzelprognose berechnen + upserten
 *  predictAllActiveTours(locationId)          — Alle aktiven Batches einer Location
 *  predictAllActiveTourEndsAllLocations()     — Cron-Batch
 *  settleCompletedTours(locationId)           — Abgeschlossene Touren auswerten
 *  settleAllCompletedToursAllLocations()      — Cron-Batch
 *  getTourEndPredictionDashboard(locationId)  — Admin-Dashboard
 *  pruneTourEndPredictions(daysOld)           — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Konstanten ─────────────────────────────────────────────────────────────────

const ACTIVE_BATCH_STATES = ['on_route', 'assigned', 'en_route', 'unterwegs', 'active'];
const TERMINAL_BATCH_STATES = ['completed', 'abgeschlossen', 'delivered', 'cancelled'];
const DEFAULT_MIN_PER_STOP = 8;     // Fallback wenn noch keine abgeschlossenen Stops
const MIN_PER_STOP_FAST    = 5;     // Untergrenze (sehr schneller Fahrer)
const MIN_PER_STOP_SLOW    = 20;    // Obergrenze
const SPEED_KMH_BIKE       = 18;
const SPEED_KMH_CAR        = 30;

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface TourEndPrediction {
  id:                  string;
  batchId:             string;
  locationId:          string;
  predictedEndUtc:     string;       // ISO
  confidence:          number;       // 0–100
  remainingStops:      number;
  completedStops:      number;
  avgMinPerStop:       number | null;
  predictedDurationMin: number | null;
  driverId:            string | null;
  vehicle:             'bike' | 'car';
  settledAt:           string | null;
  actualEndUtc:        string | null;
  errorMin:            number | null;
  createdAt:           string;
  updatedAt:           string;
}

export interface PredictBatchResult {
  batchId:         string;
  locationId:      string;
  predictedEndUtc: string;
  confidence:      number;
  remainingStops:  number;
  completedStops:  number;
  avgMinPerStop:   number;
}

export interface TourEndPredictionDashboard {
  locationId:            string;
  activePredictions:     ActivePredictionRow[];
  accuracy7d:            AccuracyRow[];
  avgErrorMin:           number | null;
  p75ErrorMin:           number | null;
  settledToday:          number;
}

export interface ActivePredictionRow {
  batchId:             string;
  predictedEndUtc:     string;
  confidence:          number;
  remainingStops:      number;
  completedStops:      number;
  totalStops:          number;
  avgMinPerStop:       number | null;
  predictedDurationMin: number | null;
  driverId:            string | null;
  vehicle:             'bike' | 'car';
  updatedAt:           string;
}

export interface AccuracyRow {
  day:         string;
  settled:     number;
  avgErrorMin: number | null;
  p75ErrorMin: number | null;
}

// ── Kernlogik ─────────────────────────────────────────────────────────────────

export async function predictTourEnd(
  batchId:    string,
  locationId: string,
): Promise<PredictBatchResult | null> {
  const svc = createServiceClient();

  // Batch + Driver + Stops laden
  const { data: batchRow } = await svc
    .from('mise_delivery_batches')
    .select(`
      id, state, driver_id,
      driver:mise_drivers(id, vehicle, last_lat, last_lng),
      stops:mise_delivery_batch_stops(
        id, sequence, type, lat, lng, completed_at,
        order:customer_orders(id, status)
      )
    `)
    .eq('id', batchId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!batchRow) return null;

  const state = batchRow.state as string;
  if (!ACTIVE_BATCH_STATES.includes(state)) return null;

  const driverRaw = batchRow.driver;
  const driver = (Array.isArray(driverRaw)
    ? (driverRaw[0] ?? null)
    : driverRaw) as Record<string, unknown> | null;

  const vehicle = ((driver?.vehicle as string | null) === 'car' ? 'car' : 'bike') as 'bike' | 'car';
  const speedKmh = vehicle === 'car' ? SPEED_KMH_CAR : SPEED_KMH_BIKE;

  const allStops = ((batchRow.stops ?? []) as Record<string, unknown>[])
    .sort((a, b) => (a.sequence as number) - (b.sequence as number))
    .filter((s) => s.type === 'dropoff');

  const DELIVERED = new Set(['geliefert', 'delivered', 'storniert', 'abgebrochen']);

  const completedStops = allStops.filter(
    (s) => s.completed_at != null ||
      DELIVERED.has(((s.order as Record<string, unknown>)?.status as string) ?? ''),
  );
  const remainingStops = allStops.filter(
    (s) => s.completed_at == null &&
      !DELIVERED.has(((s.order as Record<string, unknown>)?.status as string) ?? ''),
  );

  const completedCount = completedStops.length;
  const remainingCount = remainingStops.length;

  if (remainingCount === 0) {
    // Tour bereits fertig — settle
    await svc.from('tour_end_predictions').update({
      settled_at:     new Date().toISOString(),
      actual_end_utc: new Date().toISOString(),
      error_min:      0,
    }).eq('batch_id', batchId).is('settled_at', null);
    return null;
  }

  // Ø Min/Stop aus abgeschlossenen Stops berechnen
  let avgMinPerStop = DEFAULT_MIN_PER_STOP;
  if (completedCount >= 2) {
    const completedWithTs = completedStops
      .filter((s) => s.completed_at != null)
      .map((s) => new Date(s.completed_at as string).getTime())
      .sort((a, b) => a - b);

    if (completedWithTs.length >= 2) {
      const totalMs  = completedWithTs[completedWithTs.length - 1] - completedWithTs[0];
      const observed = totalMs / (completedWithTs.length - 1) / 60_000;
      avgMinPerStop  = Math.max(MIN_PER_STOP_FAST, Math.min(MIN_PER_STOP_SLOW, observed));
    }
  }

  // GPS-Distanz zum nächsten Stop (erster verbleibender Stop)
  let distanceBonus = 0;
  const nextStop = remainingStops[0] as Record<string, unknown> | undefined;
  if (
    driver?.last_lat != null && driver?.last_lng != null &&
    nextStop?.lat != null && nextStop?.lng != null
  ) {
    const km = haversineKm(
      { lat: driver.last_lat as number, lng: driver.last_lng as number },
      { lat: nextStop.lat as number,     lng: nextStop.lng as number     },
    );
    distanceBonus = (km / speedKmh) * 60;
  }

  const predictedDurationMin = distanceBonus + avgMinPerStop * remainingCount;
  const predictedEndUtc      = new Date(Date.now() + predictedDurationMin * 60_000);

  // Confidence: steigt mit abgeschlossenen Stops (Datenbasis)
  const totalStops = completedCount + remainingCount;
  const baseConfidence = completedCount === 0 ? 40
    : completedCount === 1 ? 55
    : Math.min(90, 60 + (completedCount / totalStops) * 30);
  const confidence = Math.round(baseConfidence);

  // Upsert
  await svc.from('tour_end_predictions').upsert({
    batch_id:              batchId,
    location_id:           locationId,
    predicted_end_utc:     predictedEndUtc.toISOString(),
    confidence,
    remaining_stops:       remainingCount,
    completed_stops:       completedCount,
    avg_min_per_stop:      Math.round(avgMinPerStop * 100) / 100,
    predicted_duration_min: Math.round(predictedDurationMin * 100) / 100,
    driver_id:             (batchRow.driver_id as string | null) ?? null,
    vehicle,
  }, { onConflict: 'batch_id' });

  return {
    batchId,
    locationId,
    predictedEndUtc: predictedEndUtc.toISOString(),
    confidence,
    remainingStops:  remainingCount,
    completedStops:  completedCount,
    avgMinPerStop,
  };
}

// ── Batch-Scan pro Location ────────────────────────────────────────────────────

export async function predictAllActiveTours(locationId: string): Promise<{
  processed: number;
  skipped:   number;
  errors:    number;
}> {
  const svc = createServiceClient();

  const { data: batches } = await svc
    .from('mise_delivery_batches')
    .select('id')
    .eq('location_id', locationId)
    .in('state', ACTIVE_BATCH_STATES);

  if (!batches?.length) return { processed: 0, skipped: 0, errors: 0 };

  let processed = 0; let skipped = 0; let errors = 0;

  await Promise.allSettled(
    (batches as { id: string }[]).map(async (b) => {
      try {
        const result = await predictTourEnd(b.id, locationId);
        if (result) processed++;
        else skipped++;
      } catch {
        errors++;
      }
    }),
  );

  return { processed, skipped, errors };
}

// ── Cron-Batch: alle Locations ─────────────────────────────────────────────────

export async function predictAllActiveTourEndsAllLocations(): Promise<{
  locations: number;
  processed: number;
  errors:    number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  const rows = (locs ?? []) as { id: string }[];
  let processed = 0; let errors = 0;

  await Promise.allSettled(
    rows.map(async (loc) => {
      try {
        const r = await predictAllActiveTours(loc.id);
        processed += r.processed;
        errors    += r.errors;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: rows.length, processed, errors };
}

// ── Settlement: Abgeschlossene Batches auswerten ──────────────────────────────

export async function settleCompletedTours(locationId: string): Promise<{
  settled: number;
  errors:  number;
}> {
  const svc = createServiceClient();

  // Unsettled predictions laden, deren Batch jetzt terminal ist
  const { data: unsettled } = await svc
    .from('tour_end_predictions')
    .select('id, batch_id, predicted_end_utc')
    .eq('location_id', locationId)
    .is('settled_at', null)
    .limit(50);

  if (!unsettled?.length) return { settled: 0, errors: 0 };

  const batchIds = (unsettled as { id: string; batch_id: string; predicted_end_utc: string }[])
    .map((r) => r.batch_id);

  const { data: batches } = await svc
    .from('mise_delivery_batches')
    .select('id, state, updated_at')
    .in('id', batchIds);

  const batchMap = new Map(
    ((batches ?? []) as { id: string; state: string; updated_at: string }[])
      .map((b) => [b.id, b]),
  );

  let settled = 0; let errors = 0;

  await Promise.allSettled(
    (unsettled as { id: string; batch_id: string; predicted_end_utc: string }[]).map(async (row) => {
      try {
        const batch = batchMap.get(row.batch_id);
        if (!batch) return;
        if (!TERMINAL_BATCH_STATES.includes(batch.state)) return;

        const actualEndUtc = new Date(batch.updated_at);
        const predictedEnd = new Date(row.predicted_end_utc);
        const errorMin     = (predictedEnd.getTime() - actualEndUtc.getTime()) / 60_000;

        await svc.from('tour_end_predictions').update({
          settled_at:     new Date().toISOString(),
          actual_end_utc: actualEndUtc.toISOString(),
          error_min:      Math.round(errorMin * 100) / 100,
        }).eq('id', row.id);

        settled++;
      } catch {
        errors++;
      }
    }),
  );

  return { settled, errors };
}

export async function settleAllCompletedToursAllLocations(): Promise<{
  locations: number;
  settled:   number;
  errors:    number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc.from('locations').select('id').eq('active', true);
  const rows = (locs ?? []) as { id: string }[];
  let settled = 0; let errors = 0;

  await Promise.allSettled(
    rows.map(async (loc) => {
      try {
        const r = await settleCompletedTours(loc.id);
        settled += r.settled;
        errors  += r.errors;
      } catch { errors++; }
    }),
  );

  return { locations: rows.length, settled, errors };
}

// ── Admin-Dashboard ────────────────────────────────────────────────────────────

export async function getTourEndPredictionDashboard(
  locationId: string,
): Promise<TourEndPredictionDashboard> {
  const svc = createServiceClient();
  const todayBerlin = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });

  const [activeRes, accuracyRes, todayCountRes] = await Promise.all([
    svc
      .from('tour_end_predictions')
      .select('batch_id, predicted_end_utc, confidence, remaining_stops, completed_stops, avg_min_per_stop, predicted_duration_min, driver_id, vehicle, updated_at')
      .eq('location_id', locationId)
      .is('settled_at', null)
      .order('predicted_end_utc', { ascending: true })
      .limit(20),

    svc
      .from('tour_end_predictions')
      .select('settled_at, error_min')
      .eq('location_id', locationId)
      .not('settled_at', 'is', null)
      .not('error_min', 'is', null)
      .gte('settled_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('settled_at', { ascending: false })
      .limit(200),

    svc
      .from('tour_end_predictions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .not('settled_at', 'is', null)
      .gte('settled_at', `${todayBerlin}T00:00:00+01:00`),
  ]);

  const activeRows = (activeRes.data ?? []) as Record<string, unknown>[];
  const accuracyRows = (accuracyRes.data ?? []) as { settled_at: string; error_min: number }[];

  // Accuracy per day (abs error)
  const dayMap = new Map<string, number[]>();
  for (const r of accuracyRows) {
    const day = r.settled_at.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(Math.abs(r.error_min));
  }

  const accuracy7d: AccuracyRow[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([day, errs]) => {
      const sorted = [...errs].sort((a, b) => a - b);
      const p75idx = Math.floor(sorted.length * 0.75);
      return {
        day,
        settled:     errs.length,
        avgErrorMin: errs.length ? Math.round((errs.reduce((s, v) => s + v, 0) / errs.length) * 10) / 10 : null,
        p75ErrorMin: sorted.length ? Math.round((sorted[p75idx] ?? sorted[sorted.length - 1]) * 10) / 10 : null,
      };
    });

  const allErrors = accuracyRows.map((r) => Math.abs(r.error_min)).filter((v) => !Number.isNaN(v));
  const sortedErrors = [...allErrors].sort((a, b) => a - b);
  const avgErrorMin = allErrors.length ? Math.round((allErrors.reduce((s, v) => s + v, 0) / allErrors.length) * 10) / 10 : null;
  const p75ErrorMin = sortedErrors.length ? Math.round((sortedErrors[Math.floor(sortedErrors.length * 0.75)] ?? sortedErrors[sortedErrors.length - 1]) * 10) / 10 : null;

  const activePredictions: ActivePredictionRow[] = activeRows.map((r) => ({
    batchId:              r.batch_id as string,
    predictedEndUtc:      r.predicted_end_utc as string,
    confidence:           r.confidence as number,
    remainingStops:       r.remaining_stops as number,
    completedStops:       r.completed_stops as number,
    totalStops:           (r.remaining_stops as number) + (r.completed_stops as number),
    avgMinPerStop:        (r.avg_min_per_stop as number | null) ?? null,
    predictedDurationMin: (r.predicted_duration_min as number | null) ?? null,
    driverId:             (r.driver_id as string | null) ?? null,
    vehicle:              ((r.vehicle as string) === 'car' ? 'car' : 'bike') as 'bike' | 'car',
    updatedAt:            r.updated_at as string,
  }));

  return {
    locationId,
    activePredictions,
    accuracy7d,
    avgErrorMin,
    p75ErrorMin,
    settledToday: todayCountRes.count ?? 0,
  };
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export async function pruneTourEndPredictions(daysOld = 30): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_tour_end_predictions', { days_to_keep: daysOld });
  return { pruned: (data as number | null) ?? 0 };
}
