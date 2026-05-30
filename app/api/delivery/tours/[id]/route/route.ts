/**
 * GET /api/delivery/tours/[id]/route
 *
 * Gibt die dekodierte Fahrroute einer Tour zurück.
 * Wird von der Fahrer-App Karten-Ansicht genutzt, um die tatsächliche
 * Straßenroute statt gerader Linien anzuzeigen.
 *
 * Response:
 * {
 *   batch_id: string
 *   polyline_points: Array<{ lat: number; lng: number }>  — dekodierte Google Polyline
 *   stop_markers:    Array<{ lat, lng, sequence, type, order_id, address, done }>
 *   has_google_route: boolean  — false = nur Stop-Koordinaten (Fallback)
 *   total_distance_km: number | null
 *   total_eta_min:     number | null
 * }
 *
 * Auth: Fahrer-Session (mise_drivers) ODER Admin-Session.
 *       Kein Token-Bypass nötig — die App fragt immer mit Auth-Cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decodePolyline } from '@/lib/delivery/polyline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: batchId } = await params;

  // Auth: Supabase Session (Admin oder Fahrer-App via Cookie)
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  // Batch laden — polyline + Metadaten
  const { data: batch, error: batchErr } = await svc
    .from('mise_delivery_batches')
    .select('id, polyline, total_distance_km, total_eta_min, state, driver_id')
    .eq('id', batchId)
    .maybeSingle();

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });
  }

  // Stops mit Stop-Koordinaten + Order-Daten laden
  const { data: stops } = await svc
    .from('mise_delivery_batch_stops')
    .select('id, order_id, type, sequence, lat, lng, address, completed_at')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  const stopMarkers = (stops ?? []).map((s) => ({
    id:        s.id,
    order_id:  s.order_id,
    type:      s.type as 'pickup' | 'dropoff',
    sequence:  s.sequence as number,
    lat:       s.lat as number,
    lng:       s.lng as number,
    address:   s.address as string | null,
    done:      s.completed_at != null,
  }));

  // Google-Polyline dekodieren wenn vorhanden
  const encodedPolyline = batch.polyline as string | null;
  const polylinePoints = decodePolyline(encodedPolyline);
  const hasGoogleRoute = polylinePoints.length > 2;

  // Fallback: wenn kein Google-Polyline, direkte Stop-Koordinaten als Linie
  const routePoints = hasGoogleRoute
    ? polylinePoints
    : stopMarkers
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({ lat: s.lat, lng: s.lng }));

  return NextResponse.json({
    batch_id:          batchId,
    batch_state:       batch.state,
    polyline_points:   routePoints,
    stop_markers:      stopMarkers,
    has_google_route:  hasGoogleRoute,
    total_distance_km: batch.total_distance_km as number | null,
    total_eta_min:     batch.total_eta_min as number | null,
  });
}
