/**
 * lib/delivery/driver-geofence.ts
 *
 * Phase 333 — Driver Geofence Engine
 *
 * Pull-basierter Cron-Scanner: prüft jede Minute die letzte bekannte
 * GPS-Position aller aktiven Fahrer gegen offene Liefer-Stops.
 *
 * Ringe:
 *   Ring 1 (default 300m): driver_nearby       "Fahrer ist gleich bei dir"
 *   Ring 2 (default 150m): driver_almost_there "Fahrer in ~2 Minuten"
 *
 * Dedup: status_push_log (UNIQUE order_id + event_type) verhindert Doppel-Sends.
 *
 * Ergänzt den push-basierten GPS-Tracker (gps-tracker.ts), der bei jedem
 * GPS-Update läuft. Die Geofence-Engine deckt den Fall ab, dass keine neuen
 * GPS-Punkte eintreffen (z.B. Offline-Fahrer, langsame Aktualisierung).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';
import { notifyCustomerViaPush } from './customer-web-push';
import { recordCustomerEvent, type CustomerEventType } from './customer-notify';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface GeofenceConfig {
  enabled: boolean;
  ring1_m: number;
  ring2_m: number;
}

export interface GeofenceScanResult {
  locationId:    string;
  driversScanned: number;
  stopsChecked:  number;
  ring1Fired:    number;
  ring2Fired:    number;
  errors:        number;
}

export interface GeofenceEventRow {
  id:             string;
  driver_id:      string;
  driver_name:    string;
  order_id:       string;
  bestellnummer:  string | null;
  ring:           1 | 2;
  event_type:     string;
  distance_m:     number;
  triggered_at:   string;
}

export interface GeofenceDashboard {
  config:         GeofenceConfig;
  stats: {
    scansToday:   number;
    driversToday: number;
    ring1Today:   number;
    ring2Today:   number;
  };
  recentEvents:   GeofenceEventRow[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: GeofenceConfig = {
  enabled: true,
  ring1_m: 300,
  ring2_m: 150,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * 1000;
}

// ── 1. Konfiguration ──────────────────────────────────────────────────────────

export async function getGeofenceConfig(locationId: string): Promise<GeofenceConfig> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_geofence_config')
    .select('enabled, ring1_m, ring2_m')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_CONFIG };
  return {
    enabled: data.enabled as boolean,
    ring1_m: data.ring1_m as number,
    ring2_m: data.ring2_m as number,
  };
}

export async function upsertGeofenceConfig(
  locationId: string,
  input: Partial<GeofenceConfig>,
): Promise<GeofenceConfig> {
  const svc = createServiceClient();
  const existing = await getGeofenceConfig(locationId);
  const next: GeofenceConfig = {
    enabled: input.enabled ?? existing.enabled,
    ring1_m: input.ring1_m ?? existing.ring1_m,
    ring2_m: input.ring2_m ?? existing.ring2_m,
  };

  await svc.from('driver_geofence_config').upsert(
    { location_id: locationId, ...next },
    { onConflict: 'location_id' },
  );
  return next;
}

// ── 2. Kern-Scanner (eine Location) ──────────────────────────────────────────

export async function scanLocationDrivers(locationId: string): Promise<GeofenceScanResult> {
  const result: GeofenceScanResult = {
    locationId,
    driversScanned: 0,
    stopsChecked:   0,
    ring1Fired:     0,
    ring2Fired:     0,
    errors:         0,
  };

  const svc = createServiceClient();

  // Config laden
  const cfg = await getGeofenceConfig(locationId);
  if (!cfg.enabled) return result;

  // Aktive Fahrer en_route mit bekannter Position laden
  const { data: drivers, error: dErr } = await svc
    .from('mise_drivers')
    .select('id, name, active_batch_id, last_lat, last_lng')
    .eq('location_id', locationId)
    .eq('state', 'en_route')
    .eq('active', true)
    .not('active_batch_id', 'is', null)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null);

  if (dErr) {
    console.error('[geofence] loadDrivers error:', dErr.message);
    result.errors++;
    return result;
  }

  result.driversScanned = (drivers ?? []).length;

  for (const driver of drivers ?? []) {
    const batchId  = driver.active_batch_id as string;
    const driverPos = { lat: driver.last_lat as number, lng: driver.last_lng as number };

    // Offene Dropoff-Stops laden
    const { data: stops, error: sErr } = await svc
      .from('mise_delivery_batch_stops')
      .select('id, order_id, lat, lng')
      .eq('batch_id', batchId)
      .eq('type', 'dropoff')
      .is('completed_at', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .not('order_id', 'is', null);

    if (sErr) {
      result.errors++;
      continue;
    }

    for (const stop of stops ?? []) {
      result.stopsChecked++;
      const orderId = stop.order_id as string;
      const stopPos = { lat: stop.lat as number, lng: stop.lng as number };
      const dm = distanceM(driverPos, stopPos);

      // Ring 2 (engster Radius) zuerst prüfen
      if (dm <= cfg.ring2_m) {
        const fired = await fireGeofencePush(svc, orderId, locationId, 'driver_almost_there', dm);
        if (fired) result.ring2Fired++;
      } else if (dm <= cfg.ring1_m) {
        const fired = await fireGeofencePush(svc, orderId, locationId, 'driver_nearby', dm);
        if (fired) result.ring1Fired++;
      }
    }
  }

  // Scan-Ergebnis loggen
  await svc.from('driver_geofence_scan_log').insert({
    location_id:     locationId,
    drivers_scanned: result.driversScanned,
    stops_checked:   result.stopsChecked,
    ring1_fired:     result.ring1Fired,
    ring2_fired:     result.ring2Fired,
    errors:          result.errors,
  });

  return result;
}

// ── 3. Push feuern (mit Dedup) ────────────────────────────────────────────────

async function fireGeofencePush(
  svc: ReturnType<typeof createServiceClient>,
  orderId:    string,
  locationId: string,
  event:      CustomerEventType,
  distanceM:  number,
): Promise<boolean> {
  // Dedup: status_push_log (UNIQUE order_id + event_type)
  const { data: already } = await svc
    .from('status_push_log')
    .select('id')
    .eq('order_id', orderId)
    .eq('event_type', event)
    .maybeSingle();

  if (already) return false;

  // Kunden-E-Mail laden
  const { data: order } = await svc
    .from('customer_orders')
    .select('bestellnummer, kunde_email')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return false;

  try {
    await Promise.all([
      notifyCustomerViaPush(
        locationId,
        orderId,
        event,
        (order.kunde_email as string | null) ?? undefined,
        order.bestellnummer ? `/track/${order.bestellnummer}` : undefined,
      ),
      recordCustomerEvent(orderId, locationId, event, {
        triggered_by: 'geofence_engine',
        distance_m:   distanceM,
      }),
    ]);

    // Dedup-Eintrag schreiben
    await svc.from('status_push_log').insert({
      order_id:    orderId,
      location_id: locationId,
      event_type:  event,
    });
  } catch (err) {
    console.error('[geofence] fireGeofencePush:', err instanceof Error ? err.message : err, { orderId, event });
    return false;
  }

  return true;
}

// ── 4. Alle Locations (Cron) ─────────────────────────────────────────────────

export async function scanAllLocations(): Promise<{
  locations: number;
  driversScanned: number;
  ring1Fired: number;
  ring2Fired: number;
  errors: number;
}> {
  const svc = createServiceClient();

  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  let driversScanned = 0;
  let ring1Fired = 0;
  let ring2Fired = 0;
  let errors = 0;

  for (const loc of locations ?? []) {
    try {
      const r = await scanLocationDrivers(loc.id as string);
      driversScanned += r.driversScanned;
      ring1Fired     += r.ring1Fired;
      ring2Fired     += r.ring2Fired;
      errors         += r.errors;
    } catch (err) {
      console.error('[geofence] scanAllLocations:', loc.id, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return {
    locations: (locations ?? []).length,
    driversScanned,
    ring1Fired,
    ring2Fired,
    errors,
  };
}

// ── 5. Dashboard ──────────────────────────────────────────────────────────────

export async function getGeofenceDashboard(locationId: string): Promise<GeofenceDashboard> {
  const svc = createServiceClient();
  const todayUtc = new Date().toISOString().slice(0, 10);
  const todayStart = `${todayUtc}T00:00:00.000Z`;

  const [config, scanRows, eventRows] = await Promise.all([
    getGeofenceConfig(locationId),

    svc
      .from('driver_geofence_scan_log')
      .select('drivers_scanned, ring1_fired, ring2_fired')
      .eq('location_id', locationId)
      .gte('scanned_at', todayStart),

    // Letzte 50 geofence push events aus status_push_log (driver_nearby + driver_almost_there)
    svc
      .from('status_push_log')
      .select('order_id, event_type, fired_at')
      .eq('location_id', locationId)
      .in('event_type', ['driver_nearby', 'driver_almost_there'])
      .gte('fired_at', todayStart)
      .order('fired_at', { ascending: false })
      .limit(50),
  ]);

  const scans = scanRows.data ?? [];
  const stats = {
    scansToday:   scans.length,
    driversToday: scans.reduce((s, r) => s + (r.drivers_scanned as number), 0),
    ring1Today:   scans.reduce((s, r) => s + (r.ring1_fired as number), 0),
    ring2Today:   scans.reduce((s, r) => s + (r.ring2_fired as number), 0),
  };

  // Bestellnummern für die Event-Zeilen laden
  const orderIds = [...new Set((eventRows.data ?? []).map((r) => r.order_id as string))];
  let orderMap: Map<string, string | null> = new Map();
  if (orderIds.length > 0) {
    const { data: orders } = await svc
      .from('customer_orders')
      .select('id, bestellnummer')
      .in('id', orderIds);
    for (const o of orders ?? []) {
      orderMap.set(o.id as string, (o.bestellnummer as string | null) ?? null);
    }
  }

  const recentEvents: GeofenceEventRow[] = (eventRows.data ?? []).map((r) => ({
    id:            r.order_id as string, // use order_id as row key
    driver_id:     '',
    driver_name:   '—',
    order_id:      r.order_id as string,
    bestellnummer: orderMap.get(r.order_id as string) ?? null,
    ring:          (r.event_type as string) === 'driver_almost_there' ? 2 : 1,
    event_type:    r.event_type as string,
    distance_m:    0,
    triggered_at:  r.fired_at as string,
  }));

  return { config, stats, recentEvents };
}

// ── 6. Cleanup ────────────────────────────────────────────────────────────────

export async function pruneGeofenceScanLogs(daysToKeep = 7): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_geofence_scan_logs', { days_old: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
