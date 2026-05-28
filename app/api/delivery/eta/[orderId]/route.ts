/**
 * GET /api/delivery/eta/[orderId]
 * Berechnet und gibt die aktuelle ETA für eine Bestellung zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { calculateEta } from '@/lib/delivery/eta';
import { createClient } from '@/lib/supabase/server';
import type { ZoneName } from '@/lib/delivery/zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = await createClient();

  const { data: o, error } = await sb
    .from('customer_orders')
    .select(`
      id, location_id, kunde_lat, kunde_lng, delivery_zone,
      estimated_prep_min, created_at, status, eta_earliest, eta_latest,
      mise_batch_id,
      batch:mise_delivery_batches(
        id, state,
        driver:mise_drivers(id, last_lat, last_lng, vehicle)
      )
    `)
    .eq('id', params.orderId)
    .maybeSingle();

  if (error || !o) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', o.location_id as string)
    .maybeSingle();

  if (!loc?.lat || !loc?.lng || !o.kunde_lat || !o.kunde_lng) {
    // Gespeicherte ETA zurückgeben falls Koordinaten fehlen
    if (o.eta_earliest && o.eta_latest) {
      return NextResponse.json({
        eta_earliest: o.eta_earliest,
        eta_latest:   o.eta_latest,
        display_label: formatLabel(new Date(o.eta_earliest as string), new Date(o.eta_latest as string)),
        source: 'cached',
      });
    }
    return NextResponse.json({ error: 'ETA nicht berechenbar (Koordinaten fehlen)' }, { status: 422 });
  }

  const batch = Array.isArray(o.batch) ? o.batch[0] : o.batch;
  const driver = batch?.driver && Array.isArray(batch.driver) ? batch.driver[0] : batch?.driver;

  const now = new Date();
  const ageMins = (now.getTime() - new Date(o.created_at as string).getTime()) / 60_000;
  const prepMin = (o.estimated_prep_min as number | null) ?? 15;
  const prepMinRemaining = Math.max(0, prepMin - ageMins);

  const eta = await calculateEta({
    locationId:    o.location_id as string,
    restaurantLat: loc.lat as number,
    restaurantLng: loc.lng as number,
    customerLat:   o.kunde_lat as number,
    customerLng:   o.kunde_lng as number,
    driverLat:     driver?.last_lat ?? null,
    driverLng:     driver?.last_lng ?? null,
    vehicle:       (driver?.vehicle as 'bike' | 'car') ?? 'bike',
    zone:          (o.delivery_zone as ZoneName | null) ?? 'B',
    prepMinRemaining,
    stopsBefore:   0,
    nowUtc:        now,
  });

  // In DB speichern
  await sb.from('customer_orders').update({
    eta_earliest: eta.earliestUtc.toISOString(),
    eta_latest:   eta.latestUtc.toISOString(),
  }).eq('id', params.orderId);

  return NextResponse.json({
    eta_earliest:  eta.earliestUtc.toISOString(),
    eta_latest:    eta.latestUtc.toISOString(),
    display_label: eta.displayLabel,
    based_on:      eta.basedOn,
    source:        'calculated',
  });
}

function formatLabel(earliest: Date, latest: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  return `${fmt(earliest)}–${fmt(latest)}`;
}
