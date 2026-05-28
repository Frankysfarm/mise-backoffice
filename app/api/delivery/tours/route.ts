/**
 * GET  /api/delivery/tours   — Aktive Touren für eine Location
 * POST /api/delivery/tours   — (intern) neue Tour manuell anlegen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  // Auth-Check über Session (Admin-Route)
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const state = searchParams.get('state') ?? 'active';
  const activeStates = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'];
  const stateFilter = state === 'active' ? activeStates : [state];

  const { data: batches, error } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, state, zone, dispatch_score, total_distance_km, total_eta_min,
      kitchen_start_at, estimated_pickup_at, estimated_delivery_at,
      stop_count, optimized, created_at,
      driver:mise_drivers(id, name, vehicle, last_lat, last_lng, state),
      stops:mise_delivery_batch_stops(
        id, order_id, type, sequence, lat, lng, address,
        order:customer_orders(id, bestellnummer, delivery_zone, eta_earliest, eta_latest, status)
      )
    `)
    .in('state', stateFilter)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tours: batches ?? [] });
}
