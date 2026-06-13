/**
 * lib/delivery/live-tracking.ts
 *
 * Live Order Tracking + GeoFencing — Phase 107
 *
 * Funktionen:
 *  - computeGeofencing()        — Distanz, Almost-There, Bearing, ETA-Minuten-Rest
 *  - getOrderTrackingData()     — vollständiges Tracking-Payload für eine Bestellung
 *  - recordTrackingSession()    — Analytics: Seitenaufruf / Ping loggen
 *  - getTrackingSessionStats()  — Nutzungsstatistik (Admin)
 *
 * Geofencing-Schwellwerte:
 *  almost_there < 300 m (Benachrichtigung "Fahrer ist gleich da")
 *  very_close   < 100 m (gps-tracker.ts behandelt arrivals separat)
 *
 * Speed-Annahmen für ETA wenn GPS-Speed fehlt:
 *  Fahrrad/Moped: 18 km/h ≙ 5 m/s
 *  Auto:          30 km/h ≙ 8.3 m/s
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Konstanten ─────────────────────────────────────────────────────────────────
const ALMOST_THERE_M = 300;
const DEFAULT_SPEED_BIKE_MS = 18 / 3.6;   // 18 km/h → m/s
const DEFAULT_SPEED_CAR_MS  = 30 / 3.6;   // 30 km/h → m/s

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface GeofencingData {
  distanceM: number | null;
  almostThere: boolean;
  etaMinRemaining: number | null;  // geschätzte Minuten bis Ankunft
  bearingDeg: number | null;       // Himmelsrichtung vom Fahrer zum Kunden (0–360)
}

export interface LiveTrackingDriver {
  lat: number;
  lng: number;
  heading: number | null;
  speedKmh: number | null;
  positionAgeSec: number;
}

export interface LiveTrackingPayload {
  orderId: string;
  bestellnummer: string;
  status: string;
  etaLabel: string | null;
  etaEarliest: string | null;
  etaLatest: string | null;
  batchState: string | null;
  stopsBefore: number | null;
  driver: LiveTrackingDriver | null;
  driverName: string | null;
  geo: GeofencingData;
}

// ── 1. Geofencing-Berechnung ───────────────────────────────────────────────────

/**
 * Berechnet Distanz, Almost-There-Flag, Peilung und Rest-ETA
 * zwischen Fahrer-Position und Kunden-Adresse.
 */
export function computeGeofencing(
  driver: { lat: number; lng: number; speedKmh?: number | null },
  customer: { lat: number; lng: number },
  vehicleType: 'bike' | 'car' = 'bike',
): GeofencingData {
  const distanceKm = haversineKm(driver, customer);
  const distanceM  = Math.round(distanceKm * 1000);
  const almostThere = distanceM < ALMOST_THERE_M;

  // Rest-ETA: Distanz / Speed
  const speedMs = driver.speedKmh != null && driver.speedKmh > 1
    ? driver.speedKmh / 3.6
    : vehicleType === 'car' ? DEFAULT_SPEED_CAR_MS : DEFAULT_SPEED_BIKE_MS;
  const etaMinRemaining = Math.ceil(distanceM / speedMs / 60);

  // Peilung (bearing): Nord = 0°, Ost = 90°, Süd = 180°, West = 270°
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng  = toRad(customer.lng - driver.lng);
  const lat1  = toRad(driver.lat);
  const lat2  = toRad(customer.lat);
  const y     = Math.sin(dLng) * Math.cos(lat2);
  const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { distanceM, almostThere, etaMinRemaining, bearingDeg: Math.round(bearingDeg) };
}

// ── 2. Tracking-Payload laden ──────────────────────────────────────────────────

/**
 * Lädt vollständige Tracking-Daten für eine Bestellung inklusive Geofencing.
 * Öffentlicher Endpunkt — kein Auth nötig, aber bestellnummer ist Lookup-Key.
 */
export async function getOrderTrackingData(
  bestellnummer: string,
): Promise<LiveTrackingPayload | null> {
  const sb = createServiceClient();

  // Bestellung laden
  const { data: order } = await sb
    .from('customer_orders')
    .select(
      'id, bestellnummer, status, typ, eta_earliest, eta_latest, '
      + 'mise_batch_id, mise_driver_id, location_id, kunde_lat, kunde_lng',
    )
    .eq('bestellnummer', bestellnummer)
    .eq('typ', 'lieferung')
    .maybeSingle();

  if (!order) return null;

  // ETA-Label formatieren
  let etaLabel: string | null = null;
  if (order.eta_earliest && order.eta_latest) {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString('de-DE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
      });
    etaLabel = `${fmt(order.eta_earliest as string)}–${fmt(order.eta_latest as string)}`;
  }

  // Ohne Batch → frühes Tracking
  if (!order.mise_batch_id) {
    return {
      orderId:      order.id as string,
      bestellnummer: order.bestellnummer as string,
      status:       order.status as string,
      etaLabel,
      etaEarliest:  order.eta_earliest as string | null,
      etaLatest:    order.eta_latest as string | null,
      batchState:   null,
      stopsBefore:  null,
      driver:       null,
      driverName:   null,
      geo:          { distanceM: null, almostThere: false, etaMinRemaining: null, bearingDeg: null },
    };
  }

  // Batch + Stops + Fahrer parallel laden
  const [batchRes, stopsRes] = await Promise.all([
    sb
      .from('mise_delivery_batches')
      .select('id, state, driver_id')
      .eq('id', order.mise_batch_id as string)
      .maybeSingle(),
    sb
      .from('mise_delivery_batch_stops')
      .select('id, order_id, type, sequence, completed_at')
      .eq('batch_id', order.mise_batch_id as string)
      .order('sequence', { ascending: true }),
  ]);

  const batch = batchRes.data;
  const stops = stopsRes.data ?? [];

  // Stops vor diesem
  const thisStop = stops.find(
    (s) => s.order_id === order.id && s.type === 'dropoff',
  );
  const stopsBefore = thisStop
    ? stops.filter(
        (s) =>
          s.type === 'dropoff' &&
          (s.sequence as number) < (thisStop.sequence as number) &&
          !s.completed_at,
      ).length
    : null;

  // Fahrer-Position + Fahrzeugtyp + Name
  const driverId = (batch?.driver_id ?? order.mise_driver_id) as string | null;
  let driver: LiveTrackingDriver | null = null;
  let driverName: string | null = null;
  let vehicleType: 'bike' | 'car' = 'bike';

  if (driverId) {
    const [locRes, driverRes] = await Promise.all([
      sb
        .from('mise_driver_locations')
        .select('lat, lng, heading, speed_kmh, recorded_at')
        .eq('driver_id', driverId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('mise_drivers')
        .select('employee_id, vehicle')
        .eq('id', driverId)
        .maybeSingle(),
    ]);

    if (locRes.data) {
      const loc = locRes.data;
      driver = {
        lat:            loc.lat as number,
        lng:            loc.lng as number,
        heading:        (loc.heading as number | null) ?? null,
        speedKmh:       (loc.speed_kmh as number | null) ?? null,
        positionAgeSec: Math.floor(
          (Date.now() - new Date(loc.recorded_at as string).getTime()) / 1000,
        ),
      };
    }

    if (driverRes.data) {
      vehicleType = (driverRes.data.vehicle as string | null) === 'car' ? 'car' : 'bike';
      if (driverRes.data.employee_id) {
        const { data: emp } = await sb
          .from('employees')
          .select('vorname')
          .eq('id', driverRes.data.employee_id as string)
          .maybeSingle();
        if (emp?.vorname) driverName = emp.vorname as string;
      }
    }
  }

  // Geofencing berechnen
  const kundePos = order.kunde_lat != null && order.kunde_lng != null
    ? { lat: order.kunde_lat as number, lng: order.kunde_lng as number }
    : null;

  const geo: GeofencingData = driver && kundePos
    ? computeGeofencing(
        { lat: driver.lat, lng: driver.lng, speedKmh: driver.speedKmh },
        kundePos,
        vehicleType,
      )
    : { distanceM: null, almostThere: false, etaMinRemaining: null, bearingDeg: null };

  return {
    orderId:       order.id as string,
    bestellnummer: order.bestellnummer as string,
    status:        order.status as string,
    etaLabel,
    etaEarliest:   order.eta_earliest as string | null,
    etaLatest:     order.eta_latest as string | null,
    batchState:    (batch?.state as string | null) ?? null,
    stopsBefore,
    driver,
    driverName,
    geo,
  };
}

// ── 3. Tracking-Session Analytics ─────────────────────────────────────────────

/**
 * Erstellt oder aktualisiert eine Tracking-Session (Analytics).
 * Fire-and-forget — niemals in den kritischen Pfad einbauen.
 */
export async function recordTrackingSession(params: {
  orderId: string;
  locationId: string | null;
  bestellnummer: string;
  sessionId?: string | null;
  almostThere?: boolean;
  arrived?: boolean;
  userAgent?: string | null;
  ipHash?: string | null;
}): Promise<string | null> {
  const sb = createServiceClient();

  // Existierende Session: Ping-Counter + last_ping_at aktualisieren
  if (params.sessionId) {
    const updatePayload: Record<string, unknown> = {
      last_ping_at: new Date().toISOString(),
    };
    if (params.almostThere) updatePayload.almost_there_at = new Date().toISOString();
    if (params.arrived)     updatePayload.arrived_at      = new Date().toISOString();

    await sb
      .from('order_tracking_sessions')
      .update(updatePayload)
      .eq('id', params.sessionId)
      .catch(() => {});

    // pings++ via separate RPC (non-critical, ignore error if function not deployed)
    await sb
      .rpc('increment_tracking_session_pings' as never, { p_session_id: params.sessionId })
      .catch(() => {});

    return params.sessionId;
  }

  // Neue Session anlegen
  const { data } = await sb
    .from('order_tracking_sessions')
    .insert({
      order_id:      params.orderId,
      location_id:   params.locationId,
      bestellnummer: params.bestellnummer,
      user_agent:    params.userAgent ?? null,
      ip_hash:       params.ipHash ?? null,
      ...(params.almostThere ? { almost_there_at: new Date().toISOString() } : {}),
      ...(params.arrived     ? { arrived_at:      new Date().toISOString() } : {}),
    })
    .select('id')
    .maybeSingle();

  return (data?.id as string | null) ?? null;
}

export interface TrackingSessionStats {
  date: string;
  uniqueOrders: number;
  totalSessions: number;
  avgPingsPerSession: number;
  sessionsWithAlmostThere: number;
  sessionsWithArrival: number;
}

/**
 * Lädt Tracking-Nutzungsstatistik für eine Location (letzten N Tage).
 */
export async function getTrackingSessionStats(
  locationId: string,
  days = 7,
): Promise<TrackingSessionStats[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('v_tracking_session_stats')
    .select('*')
    .eq('location_id', locationId)
    .gte('session_date', since)
    .order('session_date', { ascending: false });

  return (data ?? []).map((r) => ({
    date:                    r.session_date as string,
    uniqueOrders:            (r.unique_orders as number) ?? 0,
    totalSessions:           (r.total_sessions as number) ?? 0,
    avgPingsPerSession:      (r.avg_pings_per_session as number) ?? 0,
    sessionsWithAlmostThere: (r.sessions_with_almost_there as number) ?? 0,
    sessionsWithArrival:     (r.sessions_saw_arrival as number) ?? 0,
  }));
}
