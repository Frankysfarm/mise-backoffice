/**
 * lib/delivery/navigation.ts — Phase 83
 *
 * Turn-by-Turn Navi-Engine für die Fahrer-App.
 *
 * Holt Google Directions Steps für das aktuelle Segment (Fahrer→Stopp),
 * cached im DB, ermittelt den aktuellen Schritt anhand der GPS-Position
 * und generiert Deep-Links für externe Navi-Apps.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface NavStep {
  index: number;
  instruction: string;        // Bereinigter Text (HTML-Tags entfernt)
  distance_m: number;
  duration_s: number;
  maneuver: string | null;    // z.B. "turn-left", "straight", "roundabout-left"
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}

export interface NavSegment {
  total_dist_m: number;
  total_dur_s: number;
  steps: NavStep[];
}

export interface NavState {
  current_step: NavStep | null;
  next_step: NavStep | null;
  steps_remaining: number;
  distance_remaining_m: number;
  duration_remaining_s: number;
  segment: NavSegment;
  cached: boolean;
}

export interface NavDeepLinks {
  google: string;
  apple: string;
  waze: string;
  /** Best-guess für iOS (Apple Maps), Android (Google), sonst Google */
  auto_ios: string;
  auto_android: string;
}

// ── HTML-Stripping ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<div[^>]*>/gi, ' ')
    .replace(/<\/div>/gi, '')
    .replace(/<wbr\/>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Google Directions API mit Steps ───────────────────────────────────────────

interface GoogleStep {
  distance: { value: number };
  duration: { value: number };
  html_instructions: string;
  maneuver?: string;
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes: Array<{
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
      steps: GoogleStep[];
    }>;
  }>;
}

async function fetchDirectionsSteps(args: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: 'driving' | 'bicycling';
}): Promise<NavSegment> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Graceful fallback ohne API-Key: 1 Schritt mit Haversine-Distanz
    const distKm = haversineKm(args.from, args.to);
    const speedKmh = args.mode === 'bicycling' ? 18 : 30;
    const durationS = Math.round((distKm / speedKmh) * 3600);
    return {
      total_dist_m: Math.round(distKm * 1000),
      total_dur_s: durationS,
      steps: [{
        index: 0,
        instruction: 'Fahren Sie zum Ziel',
        distance_m: Math.round(distKm * 1000),
        duration_s: durationS,
        maneuver: 'straight',
        start_lat: args.from.lat,
        start_lng: args.from.lng,
        end_lat: args.to.lat,
        end_lng: args.to.lng,
      }],
    };
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${args.from.lat},${args.from.lng}`);
  url.searchParams.set('destination', `${args.to.lat},${args.to.lng}`);
  url.searchParams.set('mode', args.mode);
  url.searchParams.set('language', 'de');
  url.searchParams.set('region', 'de');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Google Directions HTTP ${res.status}`);

  const data = (await res.json()) as GoogleDirectionsResponse;
  if (data.status !== 'OK' || !data.routes[0]) {
    throw new Error(`Directions ${data.status}: ${data.error_message ?? '-'}`);
  }

  const leg = data.routes[0].legs[0];
  const steps: NavStep[] = leg.steps.map((s, i) => ({
    index: i,
    instruction: stripHtml(s.html_instructions),
    distance_m: s.distance.value,
    duration_s: s.duration.value,
    maneuver: s.maneuver ?? null,
    start_lat: s.start_location.lat,
    start_lng: s.start_location.lng,
    end_lat: s.end_location.lat,
    end_lng: s.end_location.lng,
  }));

  return {
    total_dist_m: leg.distance.value,
    total_dur_s: leg.duration.value,
    steps,
  };
}

// ── Cache (DB) ─────────────────────────────────────────────────────────────────

async function getCachedSegment(
  batchId: string,
  stopIndex: number,
  vehicle: string,
): Promise<NavSegment | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('driver_navigation_routes')
      .select('total_dist_m, total_dur_s, steps, fetched_at')
      .eq('batch_id', batchId)
      .eq('stop_index', stopIndex)
      .eq('vehicle', vehicle)
      .single();

    if (!data) return null;

    // Verwerfe Cache der älter als 2h ist
    const ageMs = Date.now() - new Date(data.fetched_at as string).getTime();
    if (ageMs > 2 * 60 * 60 * 1000) return null;

    return {
      total_dist_m: data.total_dist_m as number,
      total_dur_s: data.total_dur_s as number,
      steps: data.steps as NavStep[],
    };
  } catch {
    return null;
  }
}

async function cacheSegment(
  batchId: string,
  locationId: string,
  stopIndex: number,
  vehicle: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  segment: NavSegment,
): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from('driver_navigation_routes').upsert(
      {
        batch_id: batchId,
        location_id: locationId,
        stop_index: stopIndex,
        vehicle,
        from_lat: from.lat,
        from_lng: from.lng,
        to_lat: to.lat,
        to_lng: to.lng,
        total_dist_m: segment.total_dist_m,
        total_dur_s: segment.total_dur_s,
        steps: segment.steps,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'batch_id,stop_index,vehicle' },
    );
  } catch {
    // Cache-Fehler sind nicht kritisch
  }
}

// ── Step-Matching (GPS-Position → aktueller Schritt) ──────────────────────────

/**
 * Findet den aktuellen Navigationsschritt anhand der Fahrerposition.
 * Nimmt den Schritt, dessen Endpunkt am weitesten vorne liegt, wo der
 * Fahrer noch nicht vorbei ist (innerhalb des Schritt-Bereichs).
 */
function findCurrentStepIndex(
  steps: NavStep[],
  driverLat: number,
  driverLng: number,
): number {
  if (steps.length === 0) return 0;
  if (steps.length === 1) return 0;

  // Finde den Schritt, dessen Start dem Fahrer am nächsten ist
  // und dessen Ende noch nicht passiert wurde
  let bestIdx = 0;
  let bestDistM = Infinity;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const distToStartM = haversineKm(
      { lat: driverLat, lng: driverLng },
      { lat: s.start_lat, lng: s.start_lng },
    ) * 1000;

    const distToEndM = haversineKm(
      { lat: driverLat, lng: driverLng },
      { lat: s.end_lat, lng: s.end_lng },
    ) * 1000;

    // Fahrer ist noch vor dem Ende dieses Schritts
    if (distToEndM < bestDistM) {
      bestDistM = distToEndM;
      bestIdx = i;
    }

    // Wenn Fahrer sehr nah am Schritt-Start (< 50m), nimm diesen Schritt
    if (distToStartM < 50) {
      bestIdx = i;
      break;
    }
  }

  return bestIdx;
}

// ── Haupt-Funktion: Navigations-State abrufen ──────────────────────────────────

export async function getNavState(args: {
  batchId: string;
  locationId: string;
  stopIndex: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  vehicle: 'car' | 'bike';
  driverLat: number;
  driverLng: number;
}): Promise<NavState> {
  const mode = args.vehicle === 'bike' ? 'bicycling' : 'driving';

  // Cache prüfen
  let segment = await getCachedSegment(args.batchId, args.stopIndex, args.vehicle);
  const cached = segment !== null;

  if (!segment) {
    segment = await fetchDirectionsSteps({ from: args.from, to: args.to, mode });
    // Async cachen (fire-and-forget)
    cacheSegment(
      args.batchId, args.locationId, args.stopIndex, args.vehicle,
      args.from, args.to, segment,
    ).catch(() => null);
  }

  const currentIdx = findCurrentStepIndex(segment.steps, args.driverLat, args.driverLng);
  const current_step = segment.steps[currentIdx] ?? null;
  const next_step = segment.steps[currentIdx + 1] ?? null;

  // Verbleibende Distanz: Summe aller Steps ab currentIdx
  const distance_remaining_m = segment.steps
    .slice(currentIdx)
    .reduce((sum, s) => sum + s.distance_m, 0);
  const duration_remaining_s = segment.steps
    .slice(currentIdx)
    .reduce((sum, s) => sum + s.duration_s, 0);

  return {
    current_step,
    next_step,
    steps_remaining: segment.steps.length - currentIdx,
    distance_remaining_m,
    duration_remaining_s,
    segment,
    cached,
  };
}

// ── Deep-Links für externe Navi-Apps ─────────────────────────────────────────

export function buildNaviDeepLinks(args: {
  stops: Array<{ lat: number; lng: number; label?: string }>;
  vehicle: 'car' | 'bike';
}): NavDeepLinks {
  if (args.stops.length === 0) {
    return { google: '', apple: '', waze: '', auto_ios: '', auto_android: '' };
  }

  const travelMode = args.vehicle === 'bike' ? 'bicycling' : 'driving';
  const dest = args.stops[args.stops.length - 1];
  const mid = args.stops.slice(0, -1);

  // Google Maps
  const googleBase = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${travelMode}`;
  const googleWaypoints = mid.length > 0
    ? `&waypoints=${mid.map((s) => `${s.lat},${s.lng}`).join('|')}`
    : '';
  const google = googleBase + googleWaypoints;

  // Apple Maps (nur erster Stop als Destination — kein Waypoint-Support in URL-Schema)
  const first = args.stops[0];
  const apple = `maps://maps.apple.com/?daddr=${first.lat},${first.lng}&dirflg=${args.vehicle === 'bike' ? 'w' : 'd'}`;

  // Waze (nur erster Stop)
  const waze = `https://waze.com/ul?ll=${first.lat},${first.lng}&navigate=yes&zoom=17`;

  return {
    google,
    apple,
    waze,
    auto_ios: apple,
    auto_android: google,
  };
}

// ── Cleanup: Alte Caches löschen ──────────────────────────────────────────────

export async function pruneNavCache(): Promise<number> {
  try {
    const sb = createServiceClient();
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('driver_navigation_routes')
      .delete({ count: 'exact' })
      .lt('fetched_at', cutoff);
    return count ?? 0;
  } catch {
    return 0;
  }
}
