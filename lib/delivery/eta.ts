/**
 * lib/delivery/eta.ts
 *
 * Dynamische ETA-Berechnung.
 * Berechnet frühestes und spätestes Lieferfenster für eine Bestellung.
 *
 * Faktoren:
 *  - Küchen-Restzeit (prep_time - vergangene Zeit)
 *  - Fahrzeit zum Restaurant (haversine + Fahrzeugtyp)
 *  - Fahrzeit zur Lieferadresse
 *  - Zone-Basis-ETA als Minimum
 *  - Puffer für Stops auf Tour (wenn gebündelt)
 */
import 'server-only';
import { haversineKm } from '@/lib/google-maps';
import { createServiceClient } from '@/lib/supabase/server';
import { getZoneConfig } from './zones';
import type { ZoneName } from './zones';

export interface EtaInput {
  locationId: string;
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
  driverLat: number | null;
  driverLng: number | null;
  vehicle: 'bike' | 'car';
  zone: ZoneName;
  prepMinRemaining: number;  // noch verbleibende Küchen-Zeit in Minuten
  stopsBefore: number;       // Anzahl Stops vor dieser Bestellung in der Tour
  nowUtc?: Date;
}

export interface EtaResult {
  earliestUtc: Date;
  latestUtc: Date;
  windowMinutes: number;
  displayLabel: string;  // z.B. "19:20–19:40"
  basedOn: 'kitchen' | 'driver' | 'zone';
}

const SPEED_KMH: Record<'bike' | 'car', number> = { bike: 18, car: 30 };
const STOP_OVERHEAD_MIN = 3;   // Minuten pro zusätzlichem Stop
const BUFFER_MIN = 5;           // Sicherheitspuffer

export async function calculateEta(input: EtaInput): Promise<EtaResult> {
  const now = input.nowUtc ?? new Date();
  const zones = await getZoneConfig(input.locationId);
  const zoneConf = zones.find((z) => z.name === input.zone) ?? zones[zones.length - 1];

  const speed = SPEED_KMH[input.vehicle];

  // Fahrzeit: Fahrer → Restaurant → Kunde
  let driveToRestaurantMin = 0;
  if (input.driverLat != null && input.driverLng != null) {
    const km = haversineKm(
      { lat: input.driverLat, lng: input.driverLng },
      { lat: input.restaurantLat, lng: input.restaurantLng },
    );
    driveToRestaurantMin = (km / speed) * 60;
  }

  const kmToCustomer = haversineKm(
    { lat: input.restaurantLat, lng: input.restaurantLng },
    { lat: input.customerLat, lng: input.customerLng },
  );
  const driveToCustomerMin = (kmToCustomer / speed) * 60;

  const stopOverheadMin = input.stopsBefore * STOP_OVERHEAD_MIN;

  // Wann ist Essen frühestens fertig?
  const kitchenDoneMin = input.prepMinRemaining;

  // Wann kommt Fahrer frühestens ans Restaurant?
  const driverAtRestaurantMin = driveToRestaurantMin;

  // Pickup = Max aus Küche-fertig und Fahrer-da
  const pickupMin = Math.max(kitchenDoneMin, driverAtRestaurantMin) + stopOverheadMin;

  // Lieferzeit = Pickup + Fahrt zum Kunden
  const deliveryMin = pickupMin + driveToCustomerMin;

  // Minimum durch Zone-Basis-ETA
  const zoneMinMin = zoneConf.eta_base_min;
  const effectiveMin = Math.max(deliveryMin, zoneMinMin);

  let basedOn: EtaResult['basedOn'] = 'driver';
  if (effectiveMin === zoneMinMin) basedOn = 'zone';
  else if (kitchenDoneMin > driverAtRestaurantMin) basedOn = 'kitchen';

  const earliest = new Date(now.getTime() + effectiveMin * 60_000);
  const latest   = new Date(now.getTime() + (effectiveMin + BUFFER_MIN + 10) * 60_000);

  return {
    earliestUtc: earliest,
    latestUtc:   latest,
    windowMinutes: Math.round(latest.getTime() - earliest.getTime()) / 60_000,
    displayLabel: formatEtaLabel(earliest, latest),
    basedOn,
  };
}

function formatEtaLabel(earliest: Date, latest: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  return `${fmt(earliest)}–${fmt(latest)}`;
}

/**
 * Schnelle ETA-Schätzung ohne DB-Lookup (nur haversine + Zone-Default).
 * Für sofortige UI-Anzeige während der Bestellaufgabe.
 */
export function quickEta(
  distanceKm: number,
  vehicle: 'bike' | 'car',
  prepMin: number,
  nowUtc: Date = new Date(),
): { earliest: Date; latest: Date; label: string } {
  const speed = SPEED_KMH[vehicle];
  const driveMin = (distanceKm / speed) * 60;
  const totalMin = Math.max(prepMin, driveMin) + driveMin + BUFFER_MIN;
  const earliest = new Date(nowUtc.getTime() + totalMin * 60_000);
  const latest   = new Date(nowUtc.getTime() + (totalMin + 10) * 60_000);
  return {
    earliest,
    latest,
    label: formatEtaLabel(earliest, latest),
  };
}

/** Aktualisiert ETA-Felder einer Bestellung in der DB. */
export async function updateOrderEta(
  orderId: string,
  eta: Pick<EtaResult, 'earliestUtc' | 'latestUtc'>,
  sb: import('@supabase/supabase-js').SupabaseClient,
): Promise<void> {
  await sb
    .from('customer_orders')
    .update({
      eta_earliest: eta.earliestUtc.toISOString(),
      eta_latest:   eta.latestUtc.toISOString(),
    })
    .eq('id', orderId);
}

const EN_ROUTE_BUFFER_MIN = 3;   // kleiner Puffer für bereits abgeholte Touren
const DELIVERED_STATUSES = new Set(['geliefert', 'abgeschlossen', 'storniert']);

/**
 * Einfache ETA-Berechnung für en-route Lieferungen.
 * Kein Zonen-Minimum — Fahrer hat Essen bereits, direkte Fahrzeit reicht.
 */
function computeEnRouteEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  vehicle: 'bike' | 'car',
  stopsBeforeMin: number,
  nowUtc: Date = new Date(),
): { earliest: Date; latest: Date } {
  const speed = SPEED_KMH[vehicle];
  const km = haversineKm({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
  const driveMin = (km / speed) * 60;
  const totalMin = driveMin + stopsBeforeMin + EN_ROUTE_BUFFER_MIN;
  return {
    earliest: new Date(nowUtc.getTime() + totalMin * 60_000),
    latest:   new Date(nowUtc.getTime() + (totalMin + EN_ROUTE_BUFFER_MIN) * 60_000),
  };
}

export interface EtaRefreshResult {
  batches_processed: number;
  orders_updated: number;
  orders_skipped: number;
  errors: number;
}

/**
 * Aktualisiert ETAs für alle aktiven `on_route` Batches basierend auf
 * dem aktuellen GPS-Standort des Fahrers. Wird im 2-Min-Cron aufgerufen.
 *
 * Logik pro Batch:
 *  1. Fahrer-GPS laden — wenn fehlt, überspringen
 *  2. Dropoff-Stops in Reihenfolge durchgehen
 *  3. Bereits gelieferte Stops überspringen, virtuelle Position vorrücken
 *  4. ETA = aktuelle Fahrzeit von virtueller Position zum nächsten Kunden
 *  5. customer_orders.eta_earliest / eta_latest aktualisieren
 */
export async function refreshEnRouteEtas(): Promise<EtaRefreshResult> {
  const sb = createServiceClient();

  const { data: batches, error } = await sb
    .from('mise_delivery_batches')
    .select(`
      id,
      location_id,
      driver:mise_drivers(id, vehicle, last_lat, last_lng),
      stops:mise_delivery_batch_stops(
        order_id, type, sequence, lat, lng,
        order:customer_orders(id, status, delivery_zone)
      )
    `)
    .eq('state', 'on_route')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !batches?.length) {
    return { batches_processed: 0, orders_updated: 0, orders_skipped: 0, errors: error ? 1 : 0 };
  }

  let ordersUpdated = 0;
  let ordersSkipped = 0;
  let errors = 0;
  const now = new Date();

  for (const batch of batches) {
    // Supabase generic-client gibt FK-Joins manchmal als Array zurück → normalisieren
    const driverRaw = batch.driver;
    const driver = (Array.isArray(driverRaw)
      ? (driverRaw[0] ?? null)
      : driverRaw) as Record<string, unknown> | null;
    if (!driver?.last_lat || !driver?.last_lng) { ordersSkipped++; continue; }

    const vehicle = (driver.vehicle as 'bike' | 'car') ?? 'bike';
    const allStops = (batch.stops as Record<string, unknown>[])
      .sort((a, b) => (a.sequence as number) - (b.sequence as number));
    const dropoffs = allStops.filter((s) => s.type === 'dropoff');

    // Virtuelle Fahrposition: startet am aktuellen GPS-Standort des Fahrers
    let curLat = driver.last_lat as number;
    let curLng = driver.last_lng as number;
    let stopsCompleted = 0;

    for (const stop of dropoffs) {
      const order = stop.order as Record<string, unknown> | null;
      const stopLat = stop.lat as number | null;
      const stopLng = stop.lng as number | null;

      if (!order || !stopLat || !stopLng) { ordersSkipped++; continue; }

      if (DELIVERED_STATUSES.has(order.status as string)) {
        // Stop bereits erledigt — virtuelle Position vorrücken
        curLat = stopLat;
        curLng = stopLng;
        stopsCompleted++;
        continue;
      }

      try {
        const stopOverheadMin = stopsCompleted * STOP_OVERHEAD_MIN;
        const { earliest, latest } = computeEnRouteEta(
          curLat, curLng, stopLat, stopLng, vehicle, stopOverheadMin, now,
        );

        await sb
          .from('customer_orders')
          .update({
            eta_earliest: earliest.toISOString(),
            eta_latest:   latest.toISOString(),
          })
          .eq('id', order.id as string);

        ordersUpdated++;
      } catch {
        errors++;
      }

      // Virtuelle Position auf diesen Kunden setzen (für nächsten Stop)
      curLat = stopLat;
      curLng = stopLng;
      stopsCompleted++;
    }
  }

  return {
    batches_processed: batches.length,
    orders_updated: ordersUpdated,
    orders_skipped: ordersSkipped,
    errors,
  };
}
