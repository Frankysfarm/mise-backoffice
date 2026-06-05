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
import { createClient } from '@/lib/supabase/server';
import { getActiveTrails, getDriverTrail, getGeofenceEvents } from '@/lib/delivery/gps-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  // Location-Zugriff prüfen
  const { data: empT } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .single();
  if (!empT) return NextResponse.json({ error: 'Kein Mitarbeiter-Profil gefunden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? (empT.location_id as string);
  const driverId   = searchParams.get('driver_id');
  const action     = searchParams.get('action');
  const minutes    = Math.min(parseInt(searchParams.get('minutes') ?? '30', 10), 120);

  // Tenant-Guard: Mitarbeiter darf nur eigene Location abfragen
  if (locationId !== empT.location_id) {
    const { data: loc } = await sb
      .from('locations')
      .select('tenant_id')
      .eq('id', locationId)
      .single();
    const { data: myLoc } = await sb
      .from('locations')
      .select('tenant_id')
      .eq('id', empT.location_id as string)
      .single();
    if (!loc || !myLoc || loc.tenant_id !== myLoc.tenant_id) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
    }
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
