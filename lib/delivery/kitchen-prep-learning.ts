/**
 * lib/delivery/kitchen-prep-learning.ts
 *
 * Phase 127: Smart Kitchen Prep Time Learning Engine
 *
 * Lernt echte Zubereitungszeiten aus kitchen_timings (notified_at → ready_at)
 * und baut per-Location, per-Tageszeit-Bucket Prep-Zeit-Profile auf.
 *
 * Diese Profile ersetzen schrittweise den 15-Min-Fixwert in dispatch-engine.ts.
 *
 * Funktionen:
 *  - recordPrepObservation()          — fire-and-forget nach markReady()
 *  - recomputePrepProfilesForLocation() — Statistiken neu berechnen
 *  - recomputePrepProfilesAllLocations() — Cron-Batch
 *  - getSmartPrepEstimate()           — gelernter p75-Wert für aktuellen Slot
 *  - getPrepLearningDashboard()       — Admin-Dashboard-Daten
 *  - prunePrepObservations()          — Cleanup alter Daten
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Stunden-Bucket 0–4 */
export type HourBucket = 0 | 1 | 2 | 3 | 4;

export const BUCKET_LABELS: Record<HourBucket, string> = {
  0: 'Morgen (06–10)',
  1: 'Mittag (11–13)',
  2: 'Nachmittag (14–16)',
  3: 'Abend (17–21)',
  4: 'Spät (22–05)',
};

export interface PrepProfile {
  hourBucket: HourBucket;
  bucketLabel: string;
  observations: number;
  meanPrepMin: number;
  p75PrepMin: number;   // empfohlene Schätzung für Dispatch
  p90PrepMin: number;   // Sicherheitspuffer bei hoher Last
  stddevMin: number;
  avgDeltaMin: number;  // positiv = systematisch unterschätzt
  accuracyPct: number;  // % |delta| ≤ 3 Min
}

export interface PrepAccuracySummary {
  locationId: string;
  totalObservations: number;
  avgActualMin: number;
  avgEstimatedMin: number;
  avgDeltaMin: number;
  stddevMin: number;
  p75Min: number;
  p90Min: number;
  accuracyPct: number;
  lastObservationAt: string | null;
}

export interface PrepOutlier {
  orderId: string;
  bestellnummer: string | null;
  estimatedPrepMin: number;
  actualPrepMin: number;
  deltaMin: number;
  hourOfDay: number;
  dayOfWeek: number;
  itemCount: number;
  recordedAt: string;
}

export interface PrepLearningDashboard {
  summary: PrepAccuracySummary | null;
  profiles: PrepProfile[];
  outliers: PrepOutlier[];
  currentEstimate: number;  // empfohlener Wert für aktuelle Stunde
  defaultFallback: number;  // Fallback wenn keine Daten
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toHourBucket(hourUtc: number): HourBucket {
  // Berlin-Approximation: +1h / +2h im Sommer — für Bucket-Berechnung reicht UTC+1
  const hourLocal = (hourUtc + 1) % 24;
  if (hourLocal >= 6 && hourLocal < 11) return 0;   // Morgen
  if (hourLocal >= 11 && hourLocal < 14) return 1;  // Mittag
  if (hourLocal >= 14 && hourLocal < 17) return 2;  // Nachmittag
  if (hourLocal >= 17 && hourLocal < 22) return 3;  // Abend
  return 4;                                          // Spät
}

const DEFAULT_PREP_MIN = 15;

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Zeichnet eine Prep-Time-Beobachtung auf, nachdem eine Bestellung fertig ist.
 * Liest notified_at (Kochstart) und ready_at aus kitchen_timings.
 * Fire-and-forget: wirft keine Fehler an den Aufrufer.
 */
export async function recordPrepObservation(
  orderId: string,
  locationId: string,
): Promise<void> {
  try {
    const sb = createServiceClient();

    const { data: timing } = await sb
      .from('kitchen_timings')
      .select('notified_at, ready_at, prep_min')
      .eq('order_id', orderId)
      .single();

    if (!timing || !timing.notified_at || !timing.ready_at) return;

    const notifiedAt = new Date(timing.notified_at as string);
    const readyAt = new Date(timing.ready_at as string);
    const actualPrepMin = (readyAt.getTime() - notifiedAt.getTime()) / 60_000;

    // Sanity-Check: zwischen 1 und 90 Minuten
    if (actualPrepMin < 1 || actualPrepMin > 90) return;

    const estimatedPrepMin = (timing.prep_min as number) ?? DEFAULT_PREP_MIN;
    const now = new Date();
    const hourOfDay = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    const hourBucket = toHourBucket(hourOfDay);

    // Anzahl Artikel aus customer_orders holen
    const { data: order } = await sb
      .from('customer_orders')
      .select('item_count')
      .eq('id', orderId)
      .single();

    const itemCount = (order?.item_count as number | null) ?? 1;

    await sb.from('kitchen_prep_observations').upsert(
      {
        location_id:        locationId,
        order_id:           orderId,
        item_count:         itemCount,
        estimated_prep_min: estimatedPrepMin,
        actual_prep_min:    Math.round(actualPrepMin * 10) / 10,
        hour_of_day:        hourOfDay,
        day_of_week:        dayOfWeek,
        hour_bucket:        hourBucket,
        recorded_at:        now.toISOString(),
      },
      { onConflict: 'order_id' },
    );
  } catch {
    // fire-and-forget: nie den Aufrufer blockieren
  }
}

/**
 * Berechnet Prep-Zeit-Profile für eine Location neu.
 * Nutzt die letzten 90 Tage Beobachtungen.
 */
export async function recomputePrepProfilesForLocation(locationId: string): Promise<{
  profilesUpdated: number;
}> {
  const sb = createServiceClient();

  // Alle Bucket-Statistiken aus DB via View
  const { data: bucketStats } = await sb
    .from('v_prep_bucket_stats')
    .select('*')
    .eq('location_id', locationId);

  if (!bucketStats || bucketStats.length === 0) return { profilesUpdated: 0 };

  const upserts = bucketStats.map((row) => {
    const obs = (row.observations as number) ?? 0;
    const meanMin = (row.mean_prep_min as number) ?? DEFAULT_PREP_MIN;
    const p75Min = (row.p75_prep_min as number) ?? meanMin + 3;
    const p90Min = (row.p90_prep_min as number) ?? meanMin + 7;
    const stddevMin = (row.stddev_min as number) ?? 3;
    const avgDeltaMin = (row.avg_delta_min as number) ?? 0;

    // Genauigkeit: Anteil mit |delta| ≤ 3 min (berechnet client-seitig; view hat kein accuracy_pct)
    const accuracyPct = 0; // wird in separater Query berechnet

    return {
      location_id:   locationId,
      hour_bucket:   row.hour_bucket as number,
      observations:  obs,
      mean_prep_min: Math.round(meanMin * 10) / 10,
      p75_prep_min:  Math.round(p75Min * 10) / 10,
      p90_prep_min:  Math.round(p90Min * 10) / 10,
      stddev_min:    Math.round(stddevMin * 10) / 10,
      avg_delta_min: Math.round(avgDeltaMin * 10) / 10,
      accuracy_pct:  accuracyPct,
      last_updated:  new Date().toISOString(),
    };
  });

  // Genauigkeit per Bucket aus Rohdaten berechnen
  const { data: rawObs } = await sb
    .from('kitchen_prep_observations')
    .select('hour_bucket, actual_prep_min, estimated_prep_min')
    .eq('location_id', locationId)
    .gte('recorded_at', new Date(Date.now() - 90 * 86400_000).toISOString());

  if (rawObs) {
    const bucketAccuracy: Record<number, { correct: number; total: number }> = {};
    for (const obs of rawObs) {
      const b = obs.hour_bucket as number;
      if (!bucketAccuracy[b]) bucketAccuracy[b] = { correct: 0, total: 0 };
      bucketAccuracy[b].total++;
      const delta = Math.abs((obs.actual_prep_min as number) - (obs.estimated_prep_min as number));
      if (delta <= 3) bucketAccuracy[b].correct++;
    }
    for (const u of upserts) {
      const acc = bucketAccuracy[u.hour_bucket];
      if (acc && acc.total > 0) {
        u.accuracy_pct = Math.round((acc.correct / acc.total) * 1000) / 10;
      }
    }
  }

  const { error } = await sb
    .from('kitchen_prep_profiles')
    .upsert(upserts, { onConflict: 'location_id,hour_bucket' });

  if (error) throw new Error(`prep_profiles upsert failed: ${error.message}`);

  return { profilesUpdated: upserts.length };
}

/**
 * Cron-Batch: Alle aktiven Locations neu berechnen.
 */
export async function recomputePrepProfilesAllLocations(): Promise<{
  locations: number;
  profilesUpdated: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations || locations.length === 0) {
    return { locations: 0, profilesUpdated: 0, errors: 0 };
  }

  let totalProfiles = 0;
  let errors = 0;

  for (const loc of locations) {
    try {
      const result = await recomputePrepProfilesForLocation(loc.id as string);
      totalProfiles += result.profilesUpdated;
    } catch {
      errors++;
    }
  }

  return { locations: locations.length, profilesUpdated: totalProfiles, errors };
}

/**
 * Gibt die empfohlene Prep-Zeit für die aktuelle Stunde zurück.
 * Nutzt den gelernten p75-Wert (pünktliche Fertigstellung in 75% der Fälle).
 * Fallback: DEFAULT_PREP_MIN wenn keine Daten vorhanden.
 */
export async function getSmartPrepEstimate(
  locationId: string,
  nowUtc: Date = new Date(),
): Promise<number> {
  try {
    const sb = createServiceClient();
    const bucket = toHourBucket(nowUtc.getUTCHours());

    const { data } = await sb
      .from('kitchen_prep_profiles')
      .select('p75_prep_min, observations')
      .eq('location_id', locationId)
      .eq('hour_bucket', bucket)
      .single();

    if (!data || (data.observations as number) < 5) return DEFAULT_PREP_MIN;

    return Math.round(data.p75_prep_min as number);
  } catch {
    return DEFAULT_PREP_MIN;
  }
}

/**
 * Admin-Dashboard: Zusammenfassung + Profile + Ausreißer + aktueller Schätzwert.
 */
export async function getPrepLearningDashboard(
  locationId: string,
): Promise<PrepLearningDashboard> {
  const sb = createServiceClient();

  const [summaryRes, profilesRes, outliersRes] = await Promise.all([
    sb
      .from('v_prep_accuracy_30d')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('kitchen_prep_profiles')
      .select('*')
      .eq('location_id', locationId)
      .order('hour_bucket'),
    sb
      .from('v_prep_outliers_7d')
      .select('*')
      .eq('location_id', locationId)
      .limit(20),
  ]);

  const summary: PrepAccuracySummary | null = summaryRes.data
    ? {
        locationId,
        totalObservations: summaryRes.data.total_observations as number,
        avgActualMin:       summaryRes.data.avg_actual_min as number,
        avgEstimatedMin:    summaryRes.data.avg_estimated_min as number,
        avgDeltaMin:        summaryRes.data.avg_delta_min as number,
        stddevMin:          summaryRes.data.stddev_min as number,
        p75Min:             summaryRes.data.p75_min as number,
        p90Min:             summaryRes.data.p90_min as number,
        accuracyPct:        summaryRes.data.accuracy_pct as number,
        lastObservationAt:  summaryRes.data.last_observation_at as string | null,
      }
    : null;

  const profiles: PrepProfile[] = (profilesRes.data ?? []).map((r) => ({
    hourBucket:   r.hour_bucket as HourBucket,
    bucketLabel:  BUCKET_LABELS[r.hour_bucket as HourBucket],
    observations: r.observations as number,
    meanPrepMin:  r.mean_prep_min as number,
    p75PrepMin:   r.p75_prep_min as number,
    p90PrepMin:   r.p90_prep_min as number,
    stddevMin:    r.stddev_min as number,
    avgDeltaMin:  r.avg_delta_min as number,
    accuracyPct:  r.accuracy_pct as number,
  }));

  const outliers: PrepOutlier[] = (outliersRes.data ?? []).map((r) => ({
    orderId:          r.order_id as string,
    bestellnummer:    r.bestellnummer as string | null,
    estimatedPrepMin: r.estimated_prep_min as number,
    actualPrepMin:    r.actual_prep_min as number,
    deltaMin:         r.delta_min as number,
    hourOfDay:        r.hour_of_day as number,
    dayOfWeek:        r.day_of_week as number,
    itemCount:        r.item_count as number,
    recordedAt:       r.recorded_at as string,
  }));

  const currentEstimate = await getSmartPrepEstimate(locationId);

  return {
    summary,
    profiles,
    outliers,
    currentEstimate,
    defaultFallback: DEFAULT_PREP_MIN,
  };
}

/**
 * Cleanup: Löscht Beobachtungen älter als daysOld Tage via SQL-Funktion.
 */
export async function prunePrepObservations(daysOld = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_prep_observations', { days_old: daysOld });
  return (data as number | null) ?? 0;
}
