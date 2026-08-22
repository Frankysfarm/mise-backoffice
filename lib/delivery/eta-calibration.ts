/**
 * lib/delivery/eta-calibration.ts
 *
 * Phase 36: ETA Accuracy Calibration Engine
 *
 * Zeichnet für jede Lieferung auf: was wurde vorhergesagt vs. was war tatsächlich.
 * Berechnet daraus Kalibrierungsfaktoren pro Zone / Fahrzeugtyp / Tageszeit.
 * Die Faktoren werden von calculateEta() angewendet, um systematische Abweichungen
 * (z.B. Zone B immer +8 Min) automatisch zu korrigieren.
 *
 * Funktionen:
 *  - logEtaPrediction()            — Vorhersage bei Dispatch loggen
 *  - recordActualDelivery()        — Echte Lieferzeit nach Zustellung eintragen
 *  - recomputeCalibrationFactors() — Faktoren für eine Location neu berechnen
 *  - recomputeAllLocations()       — Cron-Wrapper: alle aktiven Locations
 *  - getCalibrationFactor()        — Faktor für eta.ts abrufen (1.0 = neutral)
 *  - getAccuracyReport()           — Admin-Bericht (Genauigkeit + Faktoren)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EtaPredictionParams {
  orderId: string;
  locationId: string;
  batchId: string | null;
  driverId: string | null;
  zone: string;       // A/B/C/D
  vehicle: string;    // bike/car
  predictedEarliestMin: number;
  predictedLatestMin: number;
}

export interface ZoneAccuracy {
  zone: string;
  vehicle: string;
  completedDeliveries: number;
  pendingDeliveries: number;
  onTimeRate: number;           // 0.0–1.0
  avgErrorMin: number;          // negative = früher als versprochen
  avgRelativeError: number;     // fractional
}

export interface CalibrationFactor {
  zone: string;
  vehicle: string;
  hourBucket: number;           // 0..3
  hourBucketLabel: string;      // '18:00–23:59' etc.
  factor: number;               // 1.0 = neutral, >1 = ETAs werden verlängert
  sampleCount: number;
  onTimeRate: number;
}

export interface AccuracyReport {
  locationId: string;
  generatedAt: string;
  overall: {
    completedDeliveries: number;
    pendingDeliveries: number;
    onTimeRate: number;
    avgErrorMin: number;
  };
  byZone: ZoneAccuracy[];
  calibrationFactors: CalibrationFactor[];
  _fallback?: boolean;
}

export interface RecomputeResult {
  locations: number;
  factorsUpdated: number;
  errors: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_BUCKET_LABELS: Record<number, string> = {
  0: '00:00–05:59',
  1: '06:00–11:59',
  2: '12:00–17:59',
  3: '18:00–23:59',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function hourBucketLabel(bucket: number): string {
  return HOUR_BUCKET_LABELS[bucket] ?? '??:??–??:??';
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ── Public Functions ───────────────────────────────────────────────────────────

/**
 * Vorhersage bei Dispatch-Zeitpunkt loggen.
 * Wird fire-and-forget aus dispatch-engine.ts aufgerufen.
 */
export async function logEtaPrediction(params: EtaPredictionParams): Promise<void> {
  const sb = createServiceClient();
  const now = new Date();
  const hourOfDay = now.getUTCHours();
  // JS: 0=Sunday → umrechnen auf 0=Monday
  const dayOfWeek = (now.getUTCDay() + 6) % 7;

  await sb.from('eta_accuracy_log').upsert(
    {
      order_id:              params.orderId,
      location_id:           params.locationId,
      batch_id:              params.batchId,
      driver_id:             params.driverId,
      zone:                  params.zone,
      vehicle:               params.vehicle,
      hour_of_day:           hourOfDay,
      day_of_week:           dayOfWeek,
      predicted_earliest_min: params.predictedEarliestMin,
      predicted_latest_min:   params.predictedLatestMin,
      predicted_at:           now.toISOString(),
    },
    { onConflict: 'order_id', ignoreDuplicates: false },
  );
}

/**
 * Echte Lieferzeit eintragen (Zeitraum von Vorhersage bis Zustellung in Minuten).
 * Wird fire-and-forget aus PATCH /api/delivery/tours/[id]/status aufgerufen.
 */
export async function recordActualDelivery(
  orderId: string,
  deliveredAt: Date = new Date(),
): Promise<void> {
  const sb = createServiceClient();

  const { data: pred } = await sb
    .from('eta_accuracy_log')
    .select('id, predicted_at')
    .eq('order_id', orderId)
    .is('actual_min', null)
    .maybeSingle();

  if (!pred) return; // kein Log-Eintrag vorhanden (ältere Orders)

  const predictedAt = new Date(pred.predicted_at as string);
  const actualMin = (deliveredAt.getTime() - predictedAt.getTime()) / 60_000;
  if (actualMin < 0 || actualMin > 480) return; // Plausibilitätscheck (0–8h)

  await sb
    .from('eta_accuracy_log')
    .update({
      actual_min:   Math.round(actualMin * 100) / 100,
      delivered_at: deliveredAt.toISOString(),
    })
    .eq('id', pred.id as string);
}

/**
 * Kalibrierungsfaktoren für eine Location aus History neu berechnen.
 * Nutzt DB-Funktion recompute_calibration_factors(p_location_id).
 * Gibt Anzahl upserted Zeilen zurück.
 */
export async function recomputeCalibrationFactors(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('recompute_calibration_factors', {
    p_location_id: locationId,
  });
  if (error) throw new Error(`Kalibrierung fehlgeschlagen: ${error.message}`);
  return safeNum(data);
}

/**
 * Cron-Wrapper: Kalibrierungsfaktoren aller aktiven Locations täglich neu berechnen.
 */
export async function recomputeAllLocations(): Promise<RecomputeResult> {
  const sb = createServiceClient();
  const { data: locs, error } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (error || !locs) return { locations: 0, factorsUpdated: 0, errors: 0 };

  let factorsUpdated = 0;
  let errors = 0;
  for (const loc of locs) {
    try {
      factorsUpdated += await recomputeCalibrationFactors(loc.id as string);
    } catch {
      errors++;
    }
  }
  return { locations: locs.length, factorsUpdated, errors };
}

/**
 * Kalibrierungsfaktor für eta.ts abrufen.
 * Gibt 1.0 zurück wenn keine Daten vorliegen (kein Fehler, kein Bias).
 */
export async function getCalibrationFactor(
  locationId: string,
  zone: string,
  vehicle: string,
  hourOfDay: number,
): Promise<number> {
  const sb = createServiceClient();
  const hourBucket = Math.floor(hourOfDay / 6); // 0..3

  const { data } = await sb
    .from('eta_calibration_factors')
    .select('calibration_factor')
    .eq('location_id', locationId)
    .eq('zone', zone)
    .eq('vehicle', vehicle)
    .eq('hour_bucket', hourBucket)
    .maybeSingle();

  return safeNum(data?.calibration_factor, 1.0);
}

/**
 * Admin-Bericht: ETA-Genauigkeit + Kalibrierungsfaktoren für eine Location.
 * Graceful Fallback wenn Migration 030 noch nicht ausgeführt.
 */
export async function getAccuracyReport(locationId: string): Promise<AccuracyReport> {
  const sb = createServiceClient();

  // ── Genauigkeit aus View ──────────────────────────────────────────────────
  const { data: summaryRows, error: summaryErr } = await sb
    .from('v_eta_accuracy_summary')
    .select(
      'zone, vehicle, completed_deliveries, pending_deliveries, on_time_rate, avg_error_min, avg_relative_error',
    )
    .eq('location_id', locationId);

  if (summaryErr) {
    // Migration noch nicht ausgeführt → leeren Fallback liefern
    return {
      locationId,
      generatedAt: new Date().toISOString(),
      overall: { completedDeliveries: 0, pendingDeliveries: 0, onTimeRate: 0, avgErrorMin: 0 },
      byZone: [],
      calibrationFactors: [],
      _fallback: true,
    };
  }

  const byZone: ZoneAccuracy[] = (summaryRows ?? []).map((r) => ({
    zone:                r.zone as string,
    vehicle:             r.vehicle as string,
    completedDeliveries: safeNum(r.completed_deliveries),
    pendingDeliveries:   safeNum(r.pending_deliveries),
    onTimeRate:          safeNum(r.on_time_rate),
    avgErrorMin:         safeNum(r.avg_error_min),
    avgRelativeError:    safeNum(r.avg_relative_error),
  }));

  // Aggregat
  const totalCompleted    = byZone.reduce((s, z) => s + z.completedDeliveries, 0);
  const totalPending      = byZone.reduce((s, z) => s + z.pendingDeliveries, 0);
  const weightedOnTime    = totalCompleted > 0
    ? byZone.reduce((s, z) => s + z.onTimeRate * z.completedDeliveries, 0) / totalCompleted
    : 0;
  const weightedError     = totalCompleted > 0
    ? byZone.reduce((s, z) => s + z.avgErrorMin * z.completedDeliveries, 0) / totalCompleted
    : 0;

  // ── Kalibrierungsfaktoren ─────────────────────────────────────────────────
  const { data: factorRows } = await sb
    .from('eta_calibration_factors')
    .select('zone, vehicle, hour_bucket, calibration_factor, sample_count, on_time_rate')
    .eq('location_id', locationId)
    .order('zone')
    .order('vehicle')
    .order('hour_bucket');

  const calibrationFactors: CalibrationFactor[] = (factorRows ?? []).map((r) => ({
    zone:            r.zone as string,
    vehicle:         r.vehicle as string,
    hourBucket:      r.hour_bucket as number,
    hourBucketLabel: hourBucketLabel(r.hour_bucket as number),
    factor:          safeNum(r.calibration_factor, 1.0),
    sampleCount:     safeNum(r.sample_count),
    onTimeRate:      safeNum(r.on_time_rate),
  }));

  return {
    locationId,
    generatedAt: new Date().toISOString(),
    overall: {
      completedDeliveries: totalCompleted,
      pendingDeliveries:   totalPending,
      onTimeRate:          Math.round(weightedOnTime * 10_000) / 10_000,
      avgErrorMin:         Math.round(weightedError * 100) / 100,
    },
    byZone,
    calibrationFactors,
  };
}
