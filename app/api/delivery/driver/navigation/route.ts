/**
 * GET /api/delivery/driver/navigation
 *   ?batch_id=uuid
 *   &stop_index=0           (aktueller Stop-Index in der Tour)
 *   &driver_lat=xx.xx
 *   &driver_lng=xx.xx
 *   &vehicle=car|bike
 *   &to_lat=xx.xx           (Ziel-Koordinaten des aktuellen Stopps)
 *   &to_lng=xx.xx
 *
 * Gibt Turn-by-Turn Navigationsschritte für das aktuelle Segment zurück.
 * Nutzt Google Directions API (gecacht in DB für 2h).
 *
 * Auth: Fahrer-Login erforderlich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getNavState, buildNaviDeepLinks } from '@/lib/delivery/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const batchId   = searchParams.get('batch_id');
  const stopIndex = parseInt(searchParams.get('stop_index') ?? '0', 10);
  const driverLat = parseFloat(searchParams.get('driver_lat') ?? '');
  const driverLng = parseFloat(searchParams.get('driver_lng') ?? '');
  const toLat     = parseFloat(searchParams.get('to_lat') ?? '');
  const toLng     = parseFloat(searchParams.get('to_lng') ?? '');
  const vehicle   = (searchParams.get('vehicle') ?? 'car') as 'car' | 'bike';

  if (!batchId || isNaN(driverLat) || isNaN(driverLng) || isNaN(toLat) || isNaN(toLng)) {
    return NextResponse.json(
      { error: 'batch_id, driver_lat, driver_lng, to_lat, to_lng sind Pflichtfelder' },
      { status: 400 },
    );
  }

  const svc = createServiceClient();

  // Fahrer validieren und location_id ermitteln
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!driver?.location_id) {
    return NextResponse.json({ error: 'Kein Fahrer-Profil gefunden' }, { status: 404 });
  }

  // Sicherstellen, dass der Batch zu diesem Fahrer gehört
  const { data: batch } = await svc
    .from('mise_delivery_batches')
    .select('id, driver_id, location_id, stops:mise_batch_stops(id, reihenfolge, order:customer_orders(kunde_lat, kunde_lng))')
    .eq('id', batchId)
    .eq('location_id', driver.location_id)
    .single();

  if (!batch) {
    return NextResponse.json({ error: 'Batch nicht gefunden' }, { status: 404 });
  }

  // Restaurant-Koordinaten für Startpunkt holen
  const { data: loc } = await svc
    .from('locations')
    .select('latitude, longitude')
    .eq('id', driver.location_id)
    .single();

  const fromLat = driverLat;
  const fromLng = driverLng;

  // Alle verbleibenden Stopps für Deep-Links
  type BatchStop = {
    reihenfolge: number;
    order: { kunde_lat: number | null; kunde_lng: number | null } | null;
  };
  const allStops = ((batch.stops ?? []) as unknown as BatchStop[])
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .slice(stopIndex)
    .filter((s) => s.order?.kunde_lat && s.order?.kunde_lng)
    .map((s) => ({ lat: s.order!.kunde_lat!, lng: s.order!.kunde_lng! }));

  const deepLinks = buildNaviDeepLinks({ stops: allStops, vehicle });

  try {
    const navState = await getNavState({
      batchId,
      locationId: driver.location_id,
      stopIndex,
      from: { lat: fromLat, lng: fromLng },
      to: { lat: toLat, lng: toLng },
      vehicle,
      driverLat,
      driverLng,
    });

    return NextResponse.json({
      ...navState,
      deep_links: deepLinks,
      restaurant: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
    });
  } catch (err) {
    // Fallback: Nur Deep-Links zurückgeben wenn Navigation-API fehlschlägt
    console.error('[navigation] getNavState error:', err);
    return NextResponse.json({
      current_step: null,
      next_step: null,
      steps_remaining: 0,
      distance_remaining_m: 0,
      duration_remaining_s: 0,
      segment: { total_dist_m: 0, total_dur_s: 0, steps: [] },
      cached: false,
      deep_links: deepLinks,
      restaurant: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
      error: 'Routenberechnung nicht verfügbar',
    });
  }
}
