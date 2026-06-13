/**
 * lib/delivery/positioning.ts
 *
 * Smart Driver Pre-Positioning Engine — Phase 99
 *
 * Analysiert Nachfrage-Prognosen + aktuelle Fahrer-Positionen und empfiehlt
 * idle Fahrern proaktiv, sich in optimale Zonen zu verlagern — bevor Orders eingehen.
 *
 * Logik:
 *  - Hohe Nachfrage (≥4 Orders/h erwartet): Fahrer sollen nah am Restaurant sein (<2km)
 *  - Mittlere Nachfrage (1–3 Orders/h): Fahrer auf Außenzonen verteilen
 *  - Nur Fahrer ohne aktive Tour + mit gültiger GPS-Position erhalten Vorschläge
 *  - Max 1 offener Vorschlag pro Fahrer gleichzeitig
 *  - Vorschläge laufen nach 20 Min ab (Fahrer-App zeigt Ablauf-Countdown)
 *
 * Cron: runPositioningAllLocations() alle 10 Min (isRatingTick)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';
import { getForecast } from './forecast';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface PositioningSuggestion {
  id: string;
  location_id: string;
  driver_id: string;
  target_zone: string;
  target_lat: number | null;
  target_lng: number | null;
  target_label: string;
  reason: string;
  demand_score: number;
  response: 'pending' | 'accepted' | 'rejected' | 'expired';
  responded_at: string | null;
  expires_at: string;
  created_at: string;
  driver_name?: string | null;
  driver_vehicle?: string | null;
  driver_distance_km?: number | null;  // aktuelle Distanz vom Restaurant
}

export interface PositioningStats {
  location_id: string;
  total_suggestions: number;
  accepted: number;
  rejected: number;
  expired: number;
  pending: number;
  acceptance_rate_pct: number | null;
  avg_response_min: number | null;
  last_generated_at: string | null;
}

export interface PositioningGenerateResult {
  location_id: string;
  created: number;
  expired: number;
  idle_drivers: number;
  skipped_already_covered: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/** Berechnet Ziel-Koordinaten für eine Richtungsempfehlung (N/S/E/W vom Restaurant). */
function offsetCoords(
  baseLat: number,
  baseLng: number,
  distanceKm: number,
  directionDeg: number, // 0=Nord, 90=Ost, 180=Süd, 270=West
): { lat: number; lng: number } {
  const R = 6371;
  const rad = Math.PI / 180;
  const brng = directionDeg * rad;
  const lat1 = baseLat * rad;
  const lng1 = baseLng * rad;
  const d = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  );

  return { lat: lat2 / rad, lng: lng2 / rad };
}

/** Gibt Spread-Richtungen für N Fahrer zurück (gleichmäßig verteilt). */
function getSpreadDirections(count: number): number[] {
  const directions: number[] = [];
  for (let i = 0; i < count; i++) {
    directions.push((360 / count) * i);
  }
  return directions;
}

// ─────────────────────────────────────────────────────────────────────────────
// generatePositioningSuggestions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hauptfunktion: Generiert Positionierungs-Vorschläge für alle idle Fahrer einer Location.
 */
export async function generatePositioningSuggestions(
  locationId: string,
): Promise<PositioningGenerateResult> {
  const sb = createServiceClient();
  const result: PositioningGenerateResult = {
    location_id: locationId,
    created: 0,
    expired: 0,
    idle_drivers: 0,
    skipped_already_covered: 0,
  };

  // 1. Abgelaufene Suggestions markieren
  const expiredResult = await expireStaleSuggestions(locationId);
  result.expired = expiredResult;

  // 2. Location laden (Restaurant-Koordinaten)
  const { data: loc } = await sb
    .from('locations')
    .select('id, lat, lng, name')
    .eq('id', locationId)
    .maybeSingle();

  if (!loc?.lat || !loc?.lng) return result;

  const restaurantLat = loc.lat as number;
  const restaurantLng = loc.lng as number;

  // 3. Nachfrage-Prognose für nächste 2 Stunden laden
  let expectedOrdersNextHour = 0;
  let expectedOrdersIn2h = 0;
  try {
    const forecast = await getForecast(locationId, 3);
    if (forecast.slots.length > 0) {
      expectedOrdersNextHour = forecast.slots[0]?.expectedOrders ?? 0;
      expectedOrdersIn2h = forecast.slots[1]?.expectedOrders ?? 0;
    }
  } catch {
    // Graceful fallback: keine Prognose verfügbar
  }

  const totalExpected = expectedOrdersNextHour + expectedOrdersIn2h;
  const demandLevel: 'high' | 'medium' | 'low' =
    totalExpected >= 8 ? 'high' : totalExpected >= 3 ? 'medium' : 'low';

  // Bei sehr niedriger Nachfrage: keine Vorschläge nötig
  if (demandLevel === 'low' && totalExpected < 1) return result;

  // 4. Idle Fahrer laden (aktiv, kein aktiver Batch, GPS-Position vorhanden)
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, employee_id, last_lat, last_lng, vehicle, state')
    .is('mise_batch_id', null)
    .eq('active', true)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .limit(20);

  if (!drivers || drivers.length === 0) return result;

  // Nur Fahrer die online sind (state = 'online')
  const idleDrivers = drivers.filter(
    (d) => (d.state as string | null) === 'online',
  );

  result.idle_drivers = idleDrivers.length;
  if (idleDrivers.length === 0) return result;

  // 5. Bereits offene Vorschläge prüfen (pro Fahrer max 1 aktiv)
  const { data: existing } = await sb
    .from('driver_positioning_suggestions')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('response', 'pending')
    .gt('expires_at', new Date().toISOString());

  const alreadySuggested = new Set((existing ?? []).map((r) => r.driver_id as string));

  // 6. Demand-Score berechnen (0-100)
  const demandScore = Math.min(100, Math.round((totalExpected / 12) * 100));

  // 7. Vorschläge generieren
  const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
  const driversToProcess = idleDrivers.filter((d) => !alreadySuggested.has(d.id as string));
  const spreadDirections = getSpreadDirections(Math.max(1, driversToProcess.length));

  for (let i = 0; i < driversToProcess.length; i++) {
    const driver = driversToProcess[i];
    const driverLat = driver.last_lat as number;
    const driverLng = driver.last_lng as number;
    const distanceKm = haversineKm(
      { lat: driverLat, lng: driverLng },
      { lat: restaurantLat, lng: restaurantLng },
    );

    let targetZone: string;
    let targetLat: number;
    let targetLng: number;
    let targetLabel: string;
    let reason: string;

    if (demandLevel === 'high') {
      // Hohe Nachfrage: alle Fahrer nah ans Restaurant
      if (distanceKm <= 2.0) {
        result.skipped_already_covered++;
        continue;
      }
      targetZone = 'home';
      targetLat = restaurantLat;
      targetLng = restaurantLng;
      targetLabel = 'Restaurant & Umgebung (< 2 km)';
      reason = `Hohe Nachfrage erwartet (${Math.round(expectedOrdersNextHour)} Orders/h) — Nähe zum Restaurant optimiert Pickup-Zeit`;
    } else {
      // Mittlere Nachfrage: Fahrer auf Zone B verteilen
      const zoneDistance = 3.5; // Ziel-Abstand in km
      const direction = spreadDirections[i % spreadDirections.length];
      const target = offsetCoords(restaurantLat, restaurantLng, zoneDistance, direction);

      // Prüfen ob Fahrer schon in der Nähe des Zielbereichs ist
      const distToTarget = haversineKm(
        { lat: driverLat, lng: driverLng },
        { lat: target.lat, lng: target.lng },
      );
      if (distToTarget <= 1.5) {
        result.skipped_already_covered++;
        continue;
      }

      targetZone = 'B';
      targetLat = target.lat;
      targetLng = target.lng;
      targetLabel = 'Zone B — Abdeckung verbessern';
      reason = `Gleichmäßige Zonenabdeckung: ${idleDrivers.length} Fahrer für ${Math.round(totalExpected)} erwartete Orders verteilen`;
    }

    await sb.from('driver_positioning_suggestions').insert({
      location_id: locationId,
      driver_id: driver.id as string,
      target_zone: targetZone,
      target_lat: targetLat,
      target_lng: targetLng,
      target_label: targetLabel,
      reason,
      demand_score: demandScore,
      response: 'pending',
      expires_at: expiresAt,
    });

    result.created++;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// expireStaleSuggestions
// ─────────────────────────────────────────────────────────────────────────────

export async function expireStaleSuggestions(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_positioning_suggestions')
    .update({ response: 'expired' })
    .eq('location_id', locationId)
    .eq('response', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return (data ?? []).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiveSuggestions (Admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveSuggestions(
  locationId: string,
): Promise<PositioningSuggestion[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('driver_positioning_suggestions')
    .select('id, location_id, driver_id, target_zone, target_lat, target_lng, target_label, reason, demand_score, response, responded_at, expires_at, created_at')
    .eq('location_id', locationId)
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data || data.length === 0) return [];

  // Fahrer-Namen anreichern
  const driverIds = [...new Set(data.map((r) => r.driver_id as string))];
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, employee_id, vehicle, last_lat, last_lng')
    .in('id', driverIds);

  const empIds = (drivers ?? []).map((d) => d.employee_id as string).filter(Boolean);
  const { data: employees } = await sb
    .from('employees')
    .select('id, name')
    .in('id', empIds);

  const empMap: Record<string, string> = {};
  for (const e of employees ?? []) {
    empMap[e.id as string] = e.name as string;
  }

  const driverMap: Record<string, { name: string; vehicle: string; last_lat: number | null; last_lng: number | null }> = {};
  for (const d of drivers ?? []) {
    driverMap[d.id as string] = {
      name: empMap[d.employee_id as string] ?? 'Fahrer',
      vehicle: d.vehicle as string,
      last_lat: d.last_lat as number | null,
      last_lng: d.last_lng as number | null,
    };
  }

  // Location für Distanzberechnung
  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();

  return data.map((r) => {
    const driver = driverMap[r.driver_id as string];
    let distanceKm: number | null = null;
    if (loc?.lat && loc?.lng && driver?.last_lat && driver?.last_lng) {
      distanceKm = Math.round(
        haversineKm(
          { lat: driver.last_lat, lng: driver.last_lng },
          { lat: loc.lat as number, lng: loc.lng as number },
        ) * 10,
      ) / 10;
    }

    return {
      id: r.id as string,
      location_id: r.location_id as string,
      driver_id: r.driver_id as string,
      target_zone: r.target_zone as string,
      target_lat: r.target_lat as number | null,
      target_lng: r.target_lng as number | null,
      target_label: r.target_label as string,
      reason: r.reason as string,
      demand_score: r.demand_score as number,
      response: r.response as 'pending' | 'accepted' | 'rejected' | 'expired',
      responded_at: r.responded_at as string | null,
      expires_at: r.expires_at as string,
      created_at: r.created_at as string,
      driver_name: driver?.name ?? null,
      driver_vehicle: driver?.vehicle ?? null,
      driver_distance_km: distanceKm,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getDriverActiveSuggestion (Fahrer-App)
// ─────────────────────────────────────────────────────────────────────────────

export async function getDriverActiveSuggestion(
  driverId: string,
  locationId: string,
): Promise<PositioningSuggestion | null> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('driver_positioning_suggestions')
    .select('id, location_id, driver_id, target_zone, target_lat, target_lng, target_label, reason, demand_score, response, responded_at, expires_at, created_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('response', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    location_id: data.location_id as string,
    driver_id: data.driver_id as string,
    target_zone: data.target_zone as string,
    target_lat: data.target_lat as number | null,
    target_lng: data.target_lng as number | null,
    target_label: data.target_label as string,
    reason: data.reason as string,
    demand_score: data.demand_score as number,
    response: data.response as 'pending' | 'accepted' | 'rejected' | 'expired',
    responded_at: data.responded_at as string | null,
    expires_at: data.expires_at as string,
    created_at: data.created_at as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// respondToSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function respondToSuggestion(
  suggestionId: string,
  response: 'accepted' | 'rejected',
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_positioning_suggestions')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('response', 'pending');
}

// ─────────────────────────────────────────────────────────────────────────────
// getPositioningStats (Admin-Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

export async function getPositioningStats(
  locationId: string,
): Promise<PositioningStats> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_positioning_compliance')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  const { data: lastGen } = await sb
    .from('driver_positioning_suggestions')
    .select('created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    location_id: locationId,
    total_suggestions: Number(data?.total_suggestions ?? 0),
    accepted: Number(data?.accepted ?? 0),
    rejected: Number(data?.rejected ?? 0),
    expired: Number(data?.expired ?? 0),
    pending: Number(data?.pending ?? 0),
    acceptance_rate_pct: data?.acceptance_rate_pct != null ? Number(data.acceptance_rate_pct) : null,
    avg_response_min: data?.avg_response_min != null ? Math.round(Number(data.avg_response_min) * 10) / 10 : null,
    last_generated_at: (lastGen?.created_at as string | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPositioningHistory (7-Tage-Verlauf für Chart)
// ─────────────────────────────────────────────────────────────────────────────

export interface PositioningDayStats {
  date: string;         // YYYY-MM-DD
  total: number;
  accepted: number;
  acceptance_rate: number;
}

export async function getPositioningHistory(
  locationId: string,
  days: number = 7,
): Promise<PositioningDayStats[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();

  const { data } = await sb
    .from('driver_positioning_suggestions')
    .select('created_at, response')
    .eq('location_id', locationId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  const byDate = new Map<string, { total: number; accepted: number }>();
  for (const r of data) {
    const date = (r.created_at as string).substring(0, 10);
    const entry = byDate.get(date) ?? { total: 0, accepted: 0 };
    entry.total++;
    if (r.response === 'accepted') entry.accepted++;
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries()).map(([date, stats]) => ({
    date,
    total: stats.total,
    accepted: stats.accepted,
    acceptance_rate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// runPositioningAllLocations (Cron-Batch)
// ─────────────────────────────────────────────────────────────────────────────

export async function runPositioningAllLocations(): Promise<{
  locations: number;
  total_created: number;
  total_expired: number;
}> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  if (!locs || locs.length === 0) {
    return { locations: 0, total_created: 0, total_expired: 0 };
  }

  let totalCreated = 0;
  let totalExpired = 0;

  await Promise.allSettled(
    locs.map(async (loc) => {
      try {
        const res = await generatePositioningSuggestions(loc.id as string);
        totalCreated += res.created;
        totalExpired += res.expired;
      } catch {
        // Graceful: Fehler einer Location blockiert nicht andere
      }
    }),
  );

  return { locations: locs.length, total_created: totalCreated, total_expired: totalExpired };
}
