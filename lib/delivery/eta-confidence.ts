/**
 * lib/delivery/eta-confidence.ts
 *
 * Phase 252: ETA-Vertrauens-Engine
 *
 * Berechnet das Vertrauensniveau einer ETA-Vorhersage für eine konkrete Bestellung.
 * Basiert auf historischer Genauigkeit aus eta_calibration_factors für:
 *  - Location + Zone (A/B/C/D) + Fahrzeugtyp + Tagesstunden-Bucket
 *
 * Fallback-Hierarchie bei fehlenden Daten:
 *  1. Exakter Match (location + zone + vehicle + hour_bucket)
 *  2. Zone-Match (location + zone + vehicle, egal welcher hour_bucket)
 *  3. Standort-Match (location, egal welche Zone/Vehicle)
 *  4. Kein Daten → 'mittel' (neutral)
 *
 * Klassifizierung:
 *  - hoch:    on_time_rate ≥ 0.85 UND ≥ 10 Samples
 *  - mittel:  on_time_rate ≥ 0.65 ODER < 10 Samples (unzureichende Datenlage)
 *  - niedrig: on_time_rate < 0.65
 *
 * Zusätzlich: calibration_factor > 1.3 indiziert systematisch zu optimistische ETAs
 * → zieht Confidence eine Stufe herunter.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type EtaConfidenceLevel = 'hoch' | 'mittel' | 'niedrig';

export interface EtaConfidenceResult {
  confidence:          EtaConfidenceLevel;
  on_time_rate:        number | null;   // 0.0–1.0, null wenn keine Daten
  sample_count:        number;
  calibration_factor:  number | null;
  zone:                string | null;
  vehicle:             string | null;
  hour_bucket:         number;          // 0..3
  lookup_breadth:      'exact' | 'zone' | 'location' | 'none';
}

export interface EtaConfidenceInput {
  locationId: string;
  zone:       string | null;
  vehicle:    string | null;
  hourOfDay:  number;  // 0–23 UTC
}

// ── Klassifizierung ────────────────────────────────────────────────────────────

function classify(
  onTimeRate: number | null,
  sampleCount: number,
  calibrationFactor: number | null,
): EtaConfidenceLevel {
  if (onTimeRate === null || sampleCount === 0) return 'mittel';

  // Zu wenige Datenpunkte → nie "hoch"
  if (sampleCount < 10) return 'mittel';

  // Systematisch zu optimistisch (calibration_factor >> 1 bedeutet ETAs werden immer zu kurz)
  const factorPenalty = (calibrationFactor ?? 1.0) > 1.3;

  if (onTimeRate >= 0.85 && !factorPenalty) return 'hoch';
  if (onTimeRate >= 0.65) return 'mittel';
  return 'niedrig';
}

// ── Public Function ────────────────────────────────────────────────────────────

export async function computeEtaConfidence(
  input: EtaConfidenceInput,
): Promise<EtaConfidenceResult> {
  const sb = createServiceClient();
  const hourBucket = Math.floor(input.hourOfDay / 6); // 0..3

  // Versuch 1: Exakter Match
  if (input.zone && input.vehicle) {
    const { data: exact } = await sb
      .from('eta_calibration_factors')
      .select('on_time_rate, sample_count, calibration_factor')
      .eq('location_id', input.locationId)
      .eq('zone', input.zone)
      .eq('vehicle', input.vehicle)
      .eq('hour_bucket', hourBucket)
      .maybeSingle();

    if (exact && (exact.sample_count as number) > 0) {
      const onTimeRate = exact.on_time_rate != null ? Number(exact.on_time_rate) : null;
      const calFactor = exact.calibration_factor != null ? Number(exact.calibration_factor) : null;
      const samples = Number(exact.sample_count);
      return {
        confidence:         classify(onTimeRate, samples, calFactor),
        on_time_rate:       onTimeRate,
        sample_count:       samples,
        calibration_factor: calFactor,
        zone:               input.zone,
        vehicle:            input.vehicle,
        hour_bucket:        hourBucket,
        lookup_breadth:     'exact',
      };
    }
  }

  // Versuch 2: Zone-Match (alle hour_buckets aggregieren)
  if (input.zone && input.vehicle) {
    const { data: zoneRows } = await sb
      .from('eta_calibration_factors')
      .select('on_time_rate, sample_count, calibration_factor')
      .eq('location_id', input.locationId)
      .eq('zone', input.zone)
      .eq('vehicle', input.vehicle);

    if (zoneRows && zoneRows.length > 0) {
      const totalSamples = zoneRows.reduce((s, r) => s + Number(r.sample_count), 0);
      if (totalSamples > 0) {
        const weightedOnTime = zoneRows.reduce(
          (s, r) => s + Number(r.on_time_rate ?? 0) * Number(r.sample_count),
          0,
        ) / totalSamples;
        const avgFactor = zoneRows.reduce(
          (s, r) => s + Number(r.calibration_factor ?? 1) * Number(r.sample_count),
          0,
        ) / totalSamples;
        return {
          confidence:         classify(weightedOnTime, totalSamples, avgFactor),
          on_time_rate:       Math.round(weightedOnTime * 10_000) / 10_000,
          sample_count:       totalSamples,
          calibration_factor: Math.round(avgFactor * 10_000) / 10_000,
          zone:               input.zone,
          vehicle:            input.vehicle,
          hour_bucket:        hourBucket,
          lookup_breadth:     'zone',
        };
      }
    }
  }

  // Versuch 3: Standort-Match (alle Zonen/Fahrzeuge aggregieren)
  const { data: locRows } = await sb
    .from('eta_calibration_factors')
    .select('on_time_rate, sample_count, calibration_factor')
    .eq('location_id', input.locationId);

  if (locRows && locRows.length > 0) {
    const totalSamples = locRows.reduce((s, r) => s + Number(r.sample_count), 0);
    if (totalSamples > 0) {
      const weightedOnTime = locRows.reduce(
        (s, r) => s + Number(r.on_time_rate ?? 0) * Number(r.sample_count),
        0,
      ) / totalSamples;
      const avgFactor = locRows.reduce(
        (s, r) => s + Number(r.calibration_factor ?? 1) * Number(r.sample_count),
        0,
      ) / totalSamples;
      return {
        confidence:         classify(weightedOnTime, totalSamples, avgFactor),
        on_time_rate:       Math.round(weightedOnTime * 10_000) / 10_000,
        sample_count:       totalSamples,
        calibration_factor: Math.round(avgFactor * 10_000) / 10_000,
        zone:               input.zone,
        vehicle:            input.vehicle,
        hour_bucket:        hourBucket,
        lookup_breadth:     'location',
      };
    }
  }

  // Kein Daten → neutral
  return {
    confidence:         'mittel',
    on_time_rate:       null,
    sample_count:       0,
    calibration_factor: null,
    zone:               input.zone,
    vehicle:            input.vehicle,
    hour_bucket:        hourBucket,
    lookup_breadth:     'none',
  };
}
