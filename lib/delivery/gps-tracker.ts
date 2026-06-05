/**
 * lib/delivery/gps-tracker.ts
 *
 * Fahrer-GPS-Tracking + Geofencing Engine — Phase 34
 *
 * Funktionen:
 *  - recordGpsPoint()        — GPS-Breadcrumb speichern + mise_drivers.last_lat/lng aktualisieren
 *  - checkGeofences()        — Proximity-Check: Restaurant-Ankunft / Kunden-Ankunft
 *  - getActiveTrails()       — Alle Fahrerspuren einer Location (für Dispatch-Karte)
 *  - getDriverTrail()        — Spur eines einzelnen Fahrers (letzten N Minuten)
 *  - getGeofenceEvents()     — Geofence-Ereignisse für Fahrer/Batch
 *  - pruneOldTrails()        — Cleanup (aufgerufen durch Cron)
 *
 * Geofence-Radien:
 *  - Restaurant-Ankunft : 150 m
 *  - Kunden-Ankunft     : 100 m
 *
 * Koordinaten immer in lat/lng (WGS84), Distanzen in Metern.
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { haversineKm } from '@/lib/google-maps';
import { recordCustomerEvent } from './customer-notify';

// ── Singleton service client ───────────────────────────────────────────────────
let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => fetch(i as RequestInfo, { ...init, cache: 'no-store' }) },
    },
  );
  return _sb;
}

// ── Radien ─────────────────────────────────────────────────────────────────────
const GEOFENCE_RESTAURANT_M = 150;
const GEOFENCE_CUSTOMER_M   = 100;

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_kmh?: number | null;
  heading_deg?: number | null;
  recorded_at?: string;
}

export interface RecordGpsParams {
  driverId: string;
  locationId: string;
  batchId?: string | null;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_kmh?: number | null;
  heading_deg?: number | null;
}

export type GeofenceType =
  | 'arrived_restaurant'
  | 'arrived_customer'
  | 'departed_restaurant';

export interface GeofenceEvent {
  type: GeofenceType;
  orderId: string | null;
  distanceM: number;
}

export interface GeofenceCheckResult {
  events: GeofenceEvent[];
  newDriverState: 'at_restaurant' | null;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
}

export interface DriverTrailSummary {
  driver_id: string;
  driver_name: string;
  driver_state: string;
  vehicle: string;
  location_id: string;
  trail_points: TrailPoint[];
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
}

export interface GeofenceEventRow {
  id: string;
  driver_id: string;
  batch_id: string | null;
  event_type: GeofenceType;
  order_id: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  triggered_at: string;
  auto_processed: boolean;
}

// ── Hilfsfunktion: Haversine-Distanz in Metern ────────────────────────────────
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * 1000;
}

// ── 1. GPS-Punkt speichern ─────────────────────────────────────────────────────

/**
 * Speichert einen GPS-Breadcrumb und aktualisiert mise_drivers.last_lat/lng.
 * Fire-and-forget-freundlich — wirft bei DB-Fehlern keinen fatalen Error.
 */
export async function recordGpsPoint(params: RecordGpsParams): Promise<void> {
  const client = sb();

  await Promise.all([
    client.from('driver_gps_trail').insert({
      driver_id:   params.driverId,
      location_id: params.locationId,
      batch_id:    params.batchId ?? null,
      lat:         params.lat,
      lng:         params.lng,
      accuracy_m:  params.accuracy_m ?? null,
      speed_kmh:   params.speed_kmh ?? null,
      heading_deg: params.heading_deg ?? null,
      recorded_at: new Date().toISOString(),
    }),
    client.from('mise_drivers')
      .update({
        last_lat:          params.lat,
        last_lng:          params.lng,
        last_position_at:  new Date().toISOString(),
      })
      .eq('id', params.driverId),
  ]);
}

// ── 2. Geofencing-Check ───────────────────────────────────────────────────────

/**
 * Prüft ob Fahrer im Geofence-Radius eines relevanten Ziels ist.
 * Lädt aktuelle Batch-Stops + Restaurant-Koordinaten aus DB.
 * Vermeidet Duplikat-Events durch Zeitfenster-Guard (3 Minuten).
 */
export async function checkGeofences(
  driverId: string,
  lat: number,
  lng: number,
  locationId: string,
): Promise<GeofenceCheckResult> {
  const client = sb();
  const events: GeofenceEvent[] = [];
  const pos = { lat, lng };

  // Aktiven Batch des Fahrers laden
  const { data: driverRow } = await client
    .from('mise_drivers')
    .select('id, state, active_batch_id, location_id')
    .eq('id', driverId)
    .single();

  if (!driverRow) return { events: [], newDriverState: null };

  const state = driverRow.state as string;
  const batchId = driverRow.active_batch_id as string | null;

  // Kein aktiver Batch → kein Geofencing nötig
  if (!batchId) return { events: [], newDriverState: null };

  // Duplikat-Guard: letzte Geofence-Events der letzten 3 Minuten
  const { data: recentEvents } = await client
    .from('driver_geofence_events')
    .select('event_type')
    .eq('driver_id', driverId)
    .eq('batch_id', batchId)
    .gte('triggered_at', new Date(Date.now() - 3 * 60 * 1000).toISOString());

  const recentTypes = new Set((recentEvents ?? []).map((e) => e.event_type as string));

  // Restaurant-Ankunft prüfen (state=assigned → Fahrer auf dem Weg zum Restaurant)
  if (state === 'assigned' && !recentTypes.has('arrived_restaurant')) {
    const { data: location } = await client
      .from('locations')
      .select('lat, lng')
      .eq('id', locationId)
      .single();

    if (location?.lat != null && location?.lng != null) {
      const dm = distanceM(pos, { lat: location.lat as number, lng: location.lng as number });
      if (dm <= GEOFENCE_RESTAURANT_M) {
        events.push({ type: 'arrived_restaurant', orderId: null, distanceM: dm });
        await logGeofenceEvent({
          driverId,
          locationId,
          batchId,
          eventType: 'arrived_restaurant',
          orderId: null,
          lat,
          lng,
          distanceM: dm,
        });
      }
    }
  }

  // Kunden-Ankunft prüfen (state=en_route → Fahrer auf dem Weg zum Kunden)
  if (state === 'en_route' && !recentTypes.has('arrived_customer')) {
    const { data: stops } = await client
      .from('mise_delivery_batch_stops')
      .select('id, order_id, lat, lng, type, sequence')
      .eq('batch_id', batchId)
      .eq('type', 'dropoff')
      .order('sequence', { ascending: true });

    for (const stop of stops ?? []) {
      if (stop.lat == null || stop.lng == null) continue;
      const dm = distanceM(pos, { lat: stop.lat as number, lng: stop.lng as number });
      if (dm <= GEOFENCE_CUSTOMER_M) {
        const orderId = stop.order_id as string;
        const dedupKey = `arrived_customer_${orderId}`;
        if (recentTypes.has(dedupKey)) continue;

        events.push({ type: 'arrived_customer', orderId, distanceM: dm });
        await logGeofenceEvent({
          driverId,
          locationId,
          batchId,
          eventType: 'arrived_customer',
          orderId,
          lat,
          lng,
          distanceM: dm,
        });
        // Customer Event Feed: Fahrer ist in der Nähe (fire-and-forget)
        recordCustomerEvent(orderId, locationId, 'driver_nearby', {
          driver_id: driverId,
          batch_id:  batchId,
          distance_m: dm,
        }).catch(() => {});
        break; // nur nächster Stop relevant
      }
    }
  }

  // Driver-State-Update: bei Restaurant-Ankunft → at_restaurant
  let newDriverState: 'at_restaurant' | null = null;
  if (events.some((e) => e.type === 'arrived_restaurant')) {
    await client.from('mise_drivers')
      .update({ state: 'at_restaurant' })
      .eq('id', driverId)
      .eq('state', 'assigned'); // nur wenn noch 'assigned' (race-condition-safe)
    newDriverState = 'at_restaurant';
  }

  return { events, newDriverState };
}

// ── 3. Geofence-Event loggen ──────────────────────────────────────────────────

async function logGeofenceEvent(params: {
  driverId: string;
  locationId: string;
  batchId: string;
  eventType: GeofenceType;
  orderId: string | null;
  lat: number;
  lng: number;
  distanceM: number;
}): Promise<void> {
  await sb().from('driver_geofence_events').insert({
    driver_id:      params.driverId,
    location_id:    params.locationId,
    batch_id:       params.batchId,
    event_type:     params.eventType,
    order_id:       params.orderId,
    lat:            params.lat,
    lng:            params.lng,
    distance_m:     params.distanceM,
    triggered_at:   new Date().toISOString(),
    auto_processed: true,
  });
}

// ── 4. Aktive Fahrerspuren (für Dispatch-Karte) ───────────────────────────────

/**
 * Gibt alle aktiven Fahrerspuren einer Location zurück (letzten 30 Min).
 * Graceful Fallback wenn Migration 029 noch nicht eingespielt.
 */
export async function getActiveTrails(locationId: string): Promise<DriverTrailSummary[]> {
  const client = sb();

  // Fahrer für Location laden
  const { data: drivers } = await client
    .from('mise_drivers')
    .select('id, name, state, vehicle, location_id, last_lat, last_lng, last_position_at')
    .eq('location_id', locationId)
    .neq('state', 'offline');

  if (!drivers?.length) return [];

  const driverIds = drivers.map((d) => d.id as string);

  // Trail-Punkte laden — Graceful Fallback wenn Tabelle fehlt
  let trailsByDriver: Map<string, TrailPoint[]> = new Map();
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: trails } = await client
      .from('driver_gps_trail')
      .select('driver_id, lat, lng, speed_kmh, recorded_at')
      .in('driver_id', driverIds)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: true });

    for (const p of trails ?? []) {
      const dId = p.driver_id as string;
      if (!trailsByDriver.has(dId)) trailsByDriver.set(dId, []);
      trailsByDriver.get(dId)!.push({
        lat:         p.lat as number,
        lng:         p.lng as number,
        speed_kmh:   p.speed_kmh as number | null,
        recorded_at: p.recorded_at as string,
      });
    }
  } catch {
    // Migration 029 fehlt — nur statische Positionen zurückgeben
  }

  return drivers.map((d) => ({
    driver_id:    d.id as string,
    driver_name:  d.name as string,
    driver_state: d.state as string,
    vehicle:      d.vehicle as string,
    location_id:  d.location_id as string,
    trail_points: trailsByDriver.get(d.id as string) ?? [],
    last_lat:     d.last_lat as number | null,
    last_lng:     d.last_lng as number | null,
    last_seen:    d.last_position_at as string | null,
  }));
}

// ── 5. Einzelspur eines Fahrers ───────────────────────────────────────────────

/**
 * Gibt GPS-Trail der letzten N Minuten für einen einzelnen Fahrer zurück.
 * Graceful Fallback → leeres Array wenn Tabelle fehlt.
 */
export async function getDriverTrail(
  driverId: string,
  minutes = 30,
): Promise<TrailPoint[]> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  try {
    const { data } = await sb()
      .from('driver_gps_trail')
      .select('lat, lng, speed_kmh, recorded_at')
      .eq('driver_id', driverId)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: true })
      .limit(120);

    return (data ?? []).map((p) => ({
      lat:         p.lat as number,
      lng:         p.lng as number,
      speed_kmh:   p.speed_kmh as number | null,
      recorded_at: p.recorded_at as string,
    }));
  } catch {
    return [];
  }
}

// ── 6. Geofence-Events abfragen ───────────────────────────────────────────────

export async function getGeofenceEvents(params: {
  driverId?: string;
  batchId?: string;
  locationId?: string;
  limit?: number;
}): Promise<GeofenceEventRow[]> {
  let q = sb()
    .from('driver_geofence_events')
    .select('id, driver_id, batch_id, event_type, order_id, lat, lng, distance_m, triggered_at, auto_processed')
    .order('triggered_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.driverId)   q = q.eq('driver_id', params.driverId);
  if (params.batchId)    q = q.eq('batch_id', params.batchId);
  if (params.locationId) q = q.eq('location_id', params.locationId);

  const { data } = await q;
  return (data ?? []) as GeofenceEventRow[];
}

// ── 7. Cleanup ────────────────────────────────────────────────────────────────

/**
 * Bereinigt alte Trail-Punkte (>24h) und Geofence-Events (>7 Tage).
 * Aufgerufen durch Cron-Job oder Maintenance-Route.
 */
export async function pruneOldTrails(): Promise<{ trailRows: number; geofenceRows: number }> {
  try {
    const { data } = await sb().rpc('cleanup_old_gps_trails');
    const row = (data as Array<{ deleted_trail_rows: number; deleted_geofence_rows: number }> | null)?.[0];
    return {
      trailRows:    row?.deleted_trail_rows ?? 0,
      geofenceRows: row?.deleted_geofence_rows ?? 0,
    };
  } catch {
    return { trailRows: 0, geofenceRows: 0 };
  }
}
