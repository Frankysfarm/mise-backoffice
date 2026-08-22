/**
 * Google Maps Helpers — Geocoding + Directions.
 *
 * Phase 2 (2026-05-05): Wird vom Frank-Dispatcher genutzt um:
 *  - Bestelladressen → Koordinaten zu wandeln (geocode)
 *  - Optimale Multi-Stop-Routen zu berechnen (directions mit waypoints + optimize)
 *
 * Server-Side. Erwartet GOOGLE_MAPS_API_KEY als ENV.
 *
 * WICHTIG: Der API-Key braucht IP-Restrictions die diesen Server zulassen,
 * sonst antwortet Google mit REQUEST_DENIED.
 */
import 'server-only';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id: string | null;
  postal_code: string | null;
}

export interface RouteLeg {
  distance_m: number;
  duration_s: number;
  start_address: string;
  end_address: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
}

export interface RouteResult {
  polyline: string;
  total_distance_m: number;
  total_duration_s: number;
  /** Reihenfolge der Waypoints nach Optimierung (wenn optimize=true). Indizes ins ursprüngliche `waypoints`-Array. */
  optimized_order: number[];
  legs: RouteLeg[];
}

const GOOGLE = 'https://maps.googleapis.com/maps/api';

function key(): string {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error('GOOGLE_MAPS_API_KEY fehlt');
  return k;
}

/**
 * Adresse → Koordinaten + Postleitzahl.
 * Returns null wenn nicht eindeutig auflösbar.
 */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  const url = new URL(`${GOOGLE}/geocode/json`);
  url.searchParams.set('address', address);
  url.searchParams.set('key', key());
  url.searchParams.set('language', 'de');
  url.searchParams.set('region', 'de');

  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`Geocode HTTP ${r.status}`);
  const data = (await r.json()) as {
    status: string;
    error_message?: string;
    results: Array<{
      formatted_address: string;
      place_id: string;
      geometry: { location: { lat: number; lng: number } };
      address_components: Array<{ types: string[]; long_name: string }>;
    }>;
  };
  if (data.status !== 'OK' || data.results.length === 0) {
    if (data.status === 'ZERO_RESULTS') return null;
    throw new Error(`Geocode ${data.status}: ${data.error_message ?? '-'}`);
  }
  const top = data.results[0];
  const postal =
    top.address_components.find((c) => c.types.includes('postal_code'))?.long_name ?? null;
  return {
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    formatted_address: top.formatted_address,
    place_id: top.place_id,
    postal_code: postal,
  };
}

/**
 * Multi-Stop-Route mit optionaler Waypoint-Optimierung.
 *
 * Origin = Driver oder Restaurant; Destination = letzter Stop.
 * Waypoints = mittlere Stops. Wenn `optimize=true`, sortiert Google die
 * Mitte für kürzeste Strecke (TSP). `optimized_order` ist die Reihenfolge.
 *
 * Coords: { lat, lng } werden direkt durchgereicht — Adressen wären langsamer
 * (zusätzlicher Geocoding-Step pro Punkt).
 */
export async function directions(args: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: Array<{ lat: number; lng: number }>;
  optimize?: boolean;
  mode?: 'driving' | 'bicycling';
  departure_time?: 'now' | number;
}): Promise<RouteResult> {
  const url = new URL(`${GOOGLE}/directions/json`);
  url.searchParams.set('origin', `${args.origin.lat},${args.origin.lng}`);
  url.searchParams.set('destination', `${args.destination.lat},${args.destination.lng}`);
  url.searchParams.set('mode', args.mode ?? 'driving');
  url.searchParams.set('language', 'de');
  url.searchParams.set('region', 'de');
  url.searchParams.set('alternatives', 'false');
  if (args.departure_time) {
    url.searchParams.set(
      'departure_time',
      args.departure_time === 'now' ? 'now' : String(args.departure_time),
    );
  }
  if (args.waypoints && args.waypoints.length > 0) {
    const wp = args.waypoints.map((w) => `${w.lat},${w.lng}`).join('|');
    url.searchParams.set('waypoints', (args.optimize ? 'optimize:true|' : '') + wp);
  }
  url.searchParams.set('key', key());

  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`Directions HTTP ${r.status}`);
  const data = (await r.json()) as {
    status: string;
    error_message?: string;
    routes: Array<{
      overview_polyline: { points: string };
      waypoint_order?: number[];
      legs: Array<{
        distance: { value: number };
        duration: { value: number };
        start_address: string;
        end_address: string;
        start_location: { lat: number; lng: number };
        end_location: { lat: number; lng: number };
      }>;
    }>;
  };
  if (data.status !== 'OK' || data.routes.length === 0) {
    throw new Error(`Directions ${data.status}: ${data.error_message ?? '-'}`);
  }
  const route = data.routes[0];
  const legs: RouteLeg[] = route.legs.map((l) => ({
    distance_m: l.distance.value,
    duration_s: l.duration.value,
    start_address: l.start_address,
    end_address: l.end_address,
    start: l.start_location,
    end: l.end_location,
  }));
  const total_distance_m = legs.reduce((s, l) => s + l.distance_m, 0);
  const total_duration_s = legs.reduce((s, l) => s + l.duration_s, 0);

  return {
    polyline: route.overview_polyline.points,
    total_distance_m,
    total_duration_s,
    optimized_order:
      route.waypoint_order ??
      (args.waypoints ? args.waypoints.map((_, i) => i) : []),
    legs,
  };
}

/**
 * Approximierte Distanz in km zwischen zwei Lat/Lng-Punkten (Haversine).
 * Schnell, lokal — für Filter/Vorauswahl bevor wir Google fragen.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
