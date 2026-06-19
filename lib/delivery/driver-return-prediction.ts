/**
 * lib/delivery/driver-return-prediction.ts
 *
 * Phase 274 — Fahrer-Rückkehr-Vorhersage (Predictive Return-to-Base Engine)
 *
 * Berechnet für jeden aktiven Fahrer den voraussichtlichen Rückkehrzeitpunkt
 * zur Basis nach Abschluss aller aktuellen Tour-Stops.
 *
 * Algorithmus:
 *  1. Lade aktiven Batch + offene Stops des Fahrers
 *  2. Schätze Fahrzeit pro Stop (Haversine + Fahrzeuggeschwindigkeit)
 *  3. Addiere Stopp-Overhead (3 Min/Stop) + Rückfahrt zur Location
 *  4. Konfidenz: 0.8 (GPS frisch) | 0.5 (GPS > 5 Min) | 0.3 (kein GPS)
 *
 * Public API:
 *  predictDriverReturn(driverId, locationId)       — Einzelvorhersage + Speichern
 *  predictAllActiveDrivers(locationId)             — Batch für eine Location
 *  predictAllLocations()                           — Cron-Batch aller Locations
 *  getReturnPredictionDashboard(locationId)        — Dashboard-Daten
 *  getDriverReturnPrediction(driverId)             — Letzte Vorhersage für einen Fahrer
 *  pruneOldPredictions(days?)                      — Cleanup-RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED_KMH: Record<'bike' | 'car', number> = { bike: 18, car: 30 };
const STOP_OVERHEAD_MIN = 3;
const GPS_FRESHNESS_MS  = 5 * 60 * 1_000; // 5 Minuten

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReturnPrediction {
  driverId:            string;
  locationId:          string;
  batchId:             string | null;
  predictedAt:         string;
  estimatedReturnUtc:  string;
  remainingStops:      number;
  totalStops:          number;
  predictedRemainingKm: number | null;
  minutesUntilReturn:  number;
  confidence:          number;
  method:              'haversine' | 'historical' | 'fallback' | 'returning';
}

export interface ReturnPredictionWithDriver extends ReturnPrediction {
  driverName:    string | null;
  driverVehicle: 'bike' | 'car';
  driverState:   string;
  locationName:  string | null;
}

export interface ReturnPredictionDashboard {
  locationId:            string;
  activeDrivers:         number;
  returningWithin15Min:  number;
  returningWithin30Min:  number;
  avgMinutesUntilReturn: number;
  highConfidenceCount:   number;
  predictions:           ReturnPredictionWithDriver[];
  returningSoon:         ReturnPredictionWithDriver[];
}

// ── DB Row Types ──────────────────────────────────────────────────────────────

interface DbDriverRow {
  id:                string;
  name:              string | null;
  vehicle:           'bike' | 'car' | null;
  state:             string | null;
  last_lat:          number | null;
  last_lng:          number | null;
  last_position_at:  string | null;
  active:            boolean;
  mise_batch_id?:    string | null;
}

interface DbBatchRow {
  id:         string;
  driver_id:  string;
  state:      string;
  created_at: string;
}

interface DbStopRow {
  id:           string;
  order_id:     string | null;
  stop_type:    string | null;
  state:        string | null;
  lat:          number | null;
  lng:          number | null;
  sequence:     number | null;
  completed_at: string | null;
}

interface DbPredictionRow {
  driver_id:             string;
  location_id:           string;
  batch_id:              string | null;
  predicted_at:          string;
  estimated_return_utc:  string;
  remaining_stops:       number;
  total_stops:           number;
  predicted_remaining_km: number | null;
  minutes_until_return:  number;
  confidence:            number;
  method:                string;
  driver_name:           string | null;
  driver_vehicle:        string | null;
  driver_state:          string | null;
  location_name:         string | null;
}

// ── Core: Einzelfahrer-Vorhersage ─────────────────────────────────────────────

export async function predictDriverReturn(
  driverId:    string,
  locationId:  string,
): Promise<ReturnPrediction | null> {
  const sb  = createServiceClient();
  const now = new Date();

  // Fahrer laden
  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, state, last_lat, last_lng, last_position_at, active')
    .eq('id', driverId)
    .maybeSingle();

  if (!driver || !(driver as DbDriverRow).active) return null;
  const d = driver as DbDriverRow;

  // Location für Rückfahrt laden
  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();

  const locLat = (loc as { lat: number | null; lng: number | null } | null)?.lat ?? null;
  const locLng = (loc as { lat: number | null; lng: number | null } | null)?.lng ?? null;

  const vehicle: 'bike' | 'car' = d.vehicle ?? 'bike';
  const speed = SPEED_KMH[vehicle];

  // Fahrer ist bereits auf dem Rückweg / idle
  if (d.state === 'idle' || d.state === 'returning') {
    // Schätzung: Rückfahrt von letzter bekannter Position
    let returnMin = 0;
    let remainingKm: number | null = null;

    if (d.last_lat != null && d.last_lng != null && locLat != null && locLng != null) {
      const km = haversineKm({ lat: d.last_lat, lng: d.last_lng }, { lat: locLat, lng: locLng });
      returnMin   = (km / speed) * 60;
      remainingKm = km;
    }

    const minutesUntilReturn = Math.round(returnMin);
    const estimatedReturn    = new Date(now.getTime() + returnMin * 60_000);

    const row = {
      driver_id:             driverId,
      location_id:           locationId,
      batch_id:              null,
      predicted_at:          now.toISOString(),
      estimated_return_utc:  estimatedReturn.toISOString(),
      remaining_stops:       0,
      total_stops:           0,
      predicted_remaining_km: remainingKm != null ? Math.round(remainingKm * 100) / 100 : null,
      minutes_until_return:  minutesUntilReturn,
      confidence:            d.last_lat != null ? 0.7 : 0.3,
      method:                'returning' as const,
    };

    await sb.from('driver_return_predictions').upsert(row, {
      onConflict: 'driver_id,date_trunc(\'minute\', predicted_at)',
      ignoreDuplicates: false,
    }).then(() => {});

    return {
      driverId,
      locationId,
      batchId:              null,
      predictedAt:          now.toISOString(),
      estimatedReturnUtc:   estimatedReturn.toISOString(),
      remainingStops:       0,
      totalStops:           0,
      predictedRemainingKm: row.predicted_remaining_km,
      minutesUntilReturn,
      confidence:           row.confidence,
      method:               'returning',
    };
  }

  // Aktiven Batch + Stops laden
  const { data: batchData } = await sb
    .from('mise_delivery_batches')
    .select('id, driver_id, state, created_at')
    .eq('driver_id', driverId)
    .not('state', 'in', '("delivered","cancelled")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const batch = batchData as DbBatchRow | null;

  if (!batch) {
    // Kein aktiver Batch → Fahrer ist verfügbar
    const row = {
      driver_id:             driverId,
      location_id:           locationId,
      batch_id:              null,
      predicted_at:          now.toISOString(),
      estimated_return_utc:  now.toISOString(),
      remaining_stops:       0,
      total_stops:           0,
      predicted_remaining_km: null,
      minutes_until_return:  0,
      confidence:            0.9,
      method:                'fallback' as const,
    };
    await sb.from('driver_return_predictions').upsert(row, {
      onConflict: 'driver_id,date_trunc(\'minute\', predicted_at)',
      ignoreDuplicates: false,
    }).then(() => {});

    return {
      driverId,
      locationId,
      batchId:              null,
      predictedAt:          now.toISOString(),
      estimatedReturnUtc:   now.toISOString(),
      remainingStops:       0,
      totalStops:           0,
      predictedRemainingKm: null,
      minutesUntilReturn:   0,
      confidence:           0.9,
      method:               'fallback',
    };
  }

  // Stops laden (nur offene)
  const { data: stopsData } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, stop_type, state, lat, lng, sequence, completed_at')
    .eq('batch_id', batch.id)
    .order('sequence', { ascending: true });

  const allStops    = (stopsData ?? []) as DbStopRow[];
  const totalStops  = allStops.length;
  const openStops   = allStops.filter(
    (s) => s.state === 'pending' || s.state === 'arrived',
  );
  const remainingStops = openStops.length;

  // GPS-Konfidenz berechnen
  let confidence = 0.3;
  if (d.last_lat != null && d.last_lng != null) {
    const gpsAge = d.last_position_at
      ? now.getTime() - new Date(d.last_position_at).getTime()
      : Infinity;
    confidence = gpsAge < GPS_FRESHNESS_MS ? 0.8 : 0.5;
  }

  // Fahrzeit berechnen: Fahrer → Stop1 → Stop2 → … → Location
  let curLat  = d.last_lat ?? null;
  let curLng  = d.last_lng ?? null;
  let totalMin = 0;
  let totalKm  = 0;

  for (const stop of openStops) {
    if (stop.lat == null || stop.lng == null) {
      totalMin += STOP_OVERHEAD_MIN + 5; // Schätzung ohne GPS
      continue;
    }
    if (curLat != null && curLng != null) {
      const km     = haversineKm({ lat: curLat, lng: curLng }, { lat: stop.lat, lng: stop.lng });
      const travelMin = (km / speed) * 60;
      totalMin += travelMin + STOP_OVERHEAD_MIN;
      totalKm  += km;
    } else {
      totalMin += STOP_OVERHEAD_MIN + 5;
    }
    curLat = stop.lat;
    curLng = stop.lng;
  }

  // Rückfahrt zur Location
  if (curLat != null && curLng != null && locLat != null && locLng != null) {
    const km = haversineKm({ lat: curLat, lng: curLng }, { lat: locLat, lng: locLng });
    totalMin += (km / speed) * 60;
    totalKm  += km;
  } else if (remainingStops === 0) {
    // Bereits zurückgekehrt oder kein GPS — Schätzung 5 Min
    totalMin += 5;
  }

  const minutesUntilReturn = Math.max(0, Math.round(totalMin));
  const estimatedReturn    = new Date(now.getTime() + totalMin * 60_000);
  const predictedKm        = totalKm > 0 ? Math.round(totalKm * 100) / 100 : null;

  const row = {
    driver_id:              driverId,
    location_id:            locationId,
    batch_id:               batch.id,
    predicted_at:           now.toISOString(),
    estimated_return_utc:   estimatedReturn.toISOString(),
    remaining_stops:        remainingStops,
    total_stops:            totalStops,
    predicted_remaining_km: predictedKm,
    minutes_until_return:   minutesUntilReturn,
    confidence:             Math.round(confidence * 100) / 100,
    method:                 'haversine' as const,
  };

  await sb.from('driver_return_predictions').upsert(row, {
    onConflict: 'driver_id,date_trunc(\'minute\', predicted_at)',
    ignoreDuplicates: false,
  }).then(() => {});

  return {
    driverId,
    locationId,
    batchId:             batch.id,
    predictedAt:         now.toISOString(),
    estimatedReturnUtc:  estimatedReturn.toISOString(),
    remainingStops,
    totalStops,
    predictedRemainingKm: predictedKm,
    minutesUntilReturn,
    confidence:          row.confidence,
    method:              'haversine',
  };
}

// ── Batch: alle aktiven Fahrer einer Location ─────────────────────────────────

export async function predictAllActiveDrivers(locationId: string): Promise<{
  predicted: number;
  errors:    number;
}> {
  const sb = createServiceClient();

  // Location-Tenant ermitteln (Fahrer werden über Tenant gefunden)
  const { data: locData } = await sb
    .from('locations')
    .select('id, tenant_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!locData) return { predicted: 0, errors: 0 };

  // Aktive Fahrer laden die gerade unterwegs sind
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('active', true)
    .in('state', ['assigned', 'at_restaurant', 'en_route', 'returning']);

  if (!drivers || drivers.length === 0) return { predicted: 0, errors: 0 };

  const results = await Promise.allSettled(
    (drivers as { id: string }[]).map((d) => predictDriverReturn(d.id, locationId)),
  );

  const predicted = results.filter((r) => r.status === 'fulfilled' && r.value != null).length;
  const errors    = results.filter((r) => r.status === 'rejected').length;

  return { predicted, errors };
}

// ── Cron-Batch: alle aktiven Locations ───────────────────────────────────────

export async function predictAllLocations(): Promise<{
  locations: number;
  predicted: number;
  errors:    number;
}> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  if (!locations || locations.length === 0) return { locations: 0, predicted: 0, errors: 0 };

  let totalPredicted = 0;
  let totalErrors    = 0;

  await Promise.allSettled(
    (locations as { id: string }[]).map(async (loc) => {
      const result = await predictAllActiveDrivers(loc.id);
      totalPredicted += result.predicted;
      totalErrors    += result.errors;
    }),
  );

  return { locations: locations.length, predicted: totalPredicted, errors: totalErrors };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getReturnPredictionDashboard(
  locationId: string,
): Promise<ReturnPredictionDashboard> {
  const sb = createServiceClient();

  // Neueste Vorhersagen je Fahrer für diese Location
  const { data: rows } = await sb
    .from('v_driver_return_latest')
    .select('*')
    .eq('location_id', locationId)
    .order('minutes_until_return', { ascending: true });

  const all = (rows ?? []) as DbPredictionRow[];

  const now         = new Date();
  const in15Min     = new Date(now.getTime() + 15 * 60_000);
  const in30Min     = new Date(now.getTime() + 30 * 60_000);

  const predictions: ReturnPredictionWithDriver[] = all.map((r) => mapRow(r));

  const returningWithin15Min = predictions.filter(
    (p) => new Date(p.estimatedReturnUtc) <= in15Min,
  ).length;

  const returningWithin30Min = predictions.filter(
    (p) => new Date(p.estimatedReturnUtc) <= in30Min,
  ).length;

  const withReturn = predictions.filter((p) => p.minutesUntilReturn > 0);
  const avgMinutesUntilReturn = withReturn.length > 0
    ? Math.round(withReturn.reduce((s, p) => s + p.minutesUntilReturn, 0) / withReturn.length)
    : 0;

  const highConfidenceCount = predictions.filter((p) => p.confidence >= 0.7).length;

  const returningSoon = predictions.filter(
    (p) => new Date(p.estimatedReturnUtc) <= in15Min && new Date(p.estimatedReturnUtc) > now,
  );

  return {
    locationId,
    activeDrivers:         predictions.length,
    returningWithin15Min,
    returningWithin30Min,
    avgMinutesUntilReturn,
    highConfidenceCount,
    predictions,
    returningSoon,
  };
}

// ── Einzelfahrer ──────────────────────────────────────────────────────────────

export async function getDriverReturnPrediction(
  driverId: string,
): Promise<ReturnPredictionWithDriver | null> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_driver_return_latest')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();

  return data ? mapRow(data as DbPredictionRow) : null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldPredictions(days = 3): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_return_predictions', { p_days: days });
  return { pruned: (data as number | null) ?? 0 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapRow(r: DbPredictionRow): ReturnPredictionWithDriver {
  return {
    driverId:             r.driver_id,
    locationId:           r.location_id,
    batchId:              r.batch_id,
    predictedAt:          r.predicted_at,
    estimatedReturnUtc:   r.estimated_return_utc,
    remainingStops:       r.remaining_stops,
    totalStops:           r.total_stops,
    predictedRemainingKm: r.predicted_remaining_km,
    minutesUntilReturn:   r.minutes_until_return,
    confidence:           r.confidence,
    method:               r.method as ReturnPrediction['method'],
    driverName:           r.driver_name,
    driverVehicle:        (r.driver_vehicle as 'bike' | 'car' | null) ?? 'bike',
    driverState:          r.driver_state ?? 'unknown',
    locationName:         r.location_name,
  };
}
