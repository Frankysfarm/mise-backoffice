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
import {
  getDriverFromBearer,
  sb,
  unauthorized,
} from '../../../driver/v1/_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const member = await getDriverFromBearer(req);
  if (!member) return unauthorized();
  if (!member.driver.active) {
    return NextResponse.json({ error: 'Fahrer ist nicht aktiv' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const locationId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  const lat        = typeof body.lat        === 'number' ? body.lat        : null;
  const lng        = typeof body.lng        === 'number' ? body.lng        : null;

  if (!UUID_RX.test(locationId) || lat === null || lng === null) {
    return NextResponse.json(
      { error: 'locationId, lat und lng sind Pflichtfelder' },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'Ungültige GPS-Koordinaten' },
      { status: 422 },
    );
  }

  const requestedBatchId = typeof body.batchId === 'string' && UUID_RX.test(body.batchId)
    ? body.batchId
    : null;

  // Never trust driverId/locationId from the request. The authenticated driver
  // must belong to the location's tenant, and an optional batch must be theirs.
  const { data: location } = await sb()
    .from('locations')
    .select('id, tenant_id')
    .eq('id', locationId)
    .maybeSingle();
  if (!location?.tenant_id) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 });
  }

  const { data: membership } = await sb()
    .from('mise_driver_tenants')
    .select('driver_id')
    .eq('driver_id', member.driver.id)
    .eq('tenant_id', location.tenant_id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Standort nicht freigegeben' }, { status: 403 });
  }

  let batchId: string | null = null;
  if (requestedBatchId) {
    const { data: batch } = await sb()
      .from('mise_delivery_batches')
      .select('id, location_id')
      .eq('id', requestedBatchId)
      .eq('driver_id', member.driver.id)
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
      .maybeSingle();
    if (!batch || batch.location_id !== locationId) {
      return NextResponse.json({ error: 'Tour nicht freigegeben' }, { status: 403 });
    }
    batchId = batch.id as string;
  }

  const accuracy_m  = typeof body.accuracy_m  === 'number' ? body.accuracy_m  : null;
  const speed_kmh   = typeof body.speed_kmh   === 'number' ? body.speed_kmh   : null;
  const heading_deg = typeof body.heading_deg === 'number'
    ? Math.round(body.heading_deg) as number
    : null;

  // GPS-Punkt speichern + Driver-Position aktualisieren
  await recordGpsPoint({ driverId: member.driver.id, locationId, batchId, lat, lng, accuracy_m, speed_kmh, heading_deg });

  // Geofencing prüfen
  const { events, newDriverState } = await checkGeofences(member.driver.id, lat, lng, locationId);

  const response: Record<string, unknown> = { ok: true };
  if (events.length > 0)     response.geofenceEvents  = events;
  if (newDriverState !== null) response.newDriverState = newDriverState;

  return NextResponse.json(response);
}
