/**
 * GET /api/delivery/admin/gps-trails?location_id=...
 *
 * Liefert alle aktiven Fahrerspuren einer Location für die Dispatch-Karte.
 * Gibt pro Fahrer die Trail-Punkte der letzten 30 Minuten zurück.
 *
 * Response:
 * {
 *   drivers: Array<{
 *     driver_id:    string
 *     driver_name:  string
 *     driver_state: string
 *     vehicle:      string
 *     trail_points: Array<{ lat, lng, speed_kmh, recorded_at }>
 *     last_lat:     number | null
 *     last_lng:     number | null
 *     last_seen:    string | null
 *   }>
 *   location_id: string
 *   generated_at: string
 *   _fallback?: true   — wenn Migration 029 noch nicht eingespielt
 * }
 *
 * GET /api/delivery/admin/gps-trails?location_id=...&driver_id=...&minutes=60
 *
 * Einzelspur eines Fahrers (letzten N Minuten).
 *
 * GET /api/delivery/admin/gps-trails?location_id=...&action=geofence_events
 *
 * Aktuelle Geofence-Events der Location.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveTrails, getDriverTrail, getGeofenceEvents } from '@/lib/delivery/gps-tracker';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? actor.location_id;
  const driverId   = searchParams.get('driver_id');
  const action     = searchParams.get('action');
  const minutes    = Math.min(parseInt(searchParams.get('minutes') ?? '30', 10), 120);

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  if (driverId) {
    const { data: membership } = await createServiceClient()
      .from('mise_driver_tenants')
      .select('driver_id')
      .eq('driver_id', driverId)
      .eq('tenant_id', actor.tenant_id as string)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Fahrer nicht autorisiert' }, { status: 403 });
  }

  // Geofence-Events
  if (action === 'geofence_events') {
    const events = await getGeofenceEvents({
      locationId,
      driverId:  driverId ?? undefined,
      limit:     50,
    });
    return NextResponse.json({ events, location_id: locationId, generated_at: new Date().toISOString() });
  }

  // Einzelspur
  if (driverId) {
    const trail = await getDriverTrail(driverId, minutes);
    return NextResponse.json({
      driver_id:    driverId,
      trail_points: trail,
      minutes,
      generated_at: new Date().toISOString(),
    });
  }

  // Alle aktiven Spuren
  const drivers = await getActiveTrails(locationId);
  const hasFallback = drivers.length > 0 && drivers.every((d) => d.trail_points.length === 0);

  const response: Record<string, unknown> = {
    drivers,
    location_id:  locationId,
    generated_at: new Date().toISOString(),
  };
  if (hasFallback) response._fallback = true;

  return NextResponse.json(response);
}
