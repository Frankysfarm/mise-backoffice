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
