/**
 * POST /api/driver-app/me/gps
 *
 * Empfängt kontinuierliche GPS-Updates von der Fahrer-App.
 * Speichert Breadcrumb, aktualisiert last_lat/lng auf mise_drivers,
 * und prüft Geofences (Restaurant-Ankunft / Kunden-Ankunft).
 *
 * Body:
 * {
 *   driverId:    string   (UUID)
 *   locationId:  string   (UUID)
 *   lat:         number
 *   lng:         number
 *   batchId?:    string | null
 *   accuracy_m?: number | null
 *   speed_kmh?:  number | null
 *   heading_deg?: number | null
 * }
 *
 * Response:
 * {
 *   ok: true
 *   geofenceEvents?: Array<{
 *     type:      'arrived_restaurant' | 'arrived_customer' | 'departed_restaurant'
 *     orderId:   string | null
 *     distanceM: number
 *   }>
 *   newDriverState?: 'at_restaurant' | null
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { recordGpsPoint, checkGeofences } from '@/lib/delivery/gps-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const driverId   = typeof body.driverId   === 'string' ? body.driverId.trim()   : '';
  const locationId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  const lat        = typeof body.lat        === 'number' ? body.lat        : null;
  const lng        = typeof body.lng        === 'number' ? body.lng        : null;

  if (!driverId || !locationId || lat === null || lng === null) {
    return NextResponse.json(
      { error: 'driverId, locationId, lat und lng sind Pflichtfelder' },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'Ungültige GPS-Koordinaten' },
      { status: 422 },
    );
  }

  const batchId    = typeof body.batchId    === 'string' ? body.batchId    : null;
  const accuracy_m  = typeof body.accuracy_m  === 'number' ? body.accuracy_m  : null;
  const speed_kmh   = typeof body.speed_kmh   === 'number' ? body.speed_kmh   : null;
  const heading_deg = typeof body.heading_deg === 'number'
    ? Math.round(body.heading_deg) as number
    : null;

  // GPS-Punkt speichern + Driver-Position aktualisieren
  await recordGpsPoint({ driverId, locationId, batchId, lat, lng, accuracy_m, speed_kmh, heading_deg });

  // Geofencing prüfen
  const { events, newDriverState } = await checkGeofences(driverId, lat, lng, locationId);

  const response: Record<string, unknown> = { ok: true };
  if (events.length > 0)     response.geofenceEvents  = events;
  if (newDriverState !== null) response.newDriverState = newDriverState;

  return NextResponse.json(response);
}
