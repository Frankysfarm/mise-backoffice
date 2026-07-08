/**
 * GET /api/delivery/driver/naechster-stop?driver_id=<uuid>
 *
 * Phase 714 — Nächster-Stop-Countdown
 * Gibt den nächsten noch nicht abgeschlossenen Lieferstop für den Fahrer zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AVG_SPEED_KMH = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  // Find the active batch for this driver
  const { data: batch } = await sb
    .from('delivery_batches')
    .select('id, orders_count, distance_km')
    .eq('driver_id', driverId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch) return NextResponse.json({ adresse: null });

  // Find the next pending stop
  const { data: stop } = await sb
    .from('delivery_stops')
    .select('id, address, order_id, sequence, distance_km')
    .eq('batch_id', batch.id)
    .eq('status', 'pending')
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stop) return NextResponse.json({ adresse: null });

  // Count total stops and done stops
  const { count: totalStops } = await sb
    .from('delivery_stops')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batch.id);

  const { count: doneStops } = await sb
    .from('delivery_stops')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batch.id)
    .eq('status', 'completed');

  // Fetch customer info
  let kundeName = 'Kunde';
  let bestellNr = `#${stop.id.slice(0, 4)}`;

  if (stop.order_id) {
    const { data: order } = await sb
      .from('orders')
      .select('customer_name, order_number')
      .eq('id', stop.order_id)
      .maybeSingle();
    if (order) {
      kundeName = order.customer_name ?? kundeName;
      bestellNr = order.order_number ? `#${order.order_number}` : bestellNr;
    }
  }

  const distanzKm = stop.distance_km ?? 2.0;
  const etaMinuten = Math.max(1, Math.round((distanzKm / AVG_SPEED_KMH) * 60));

  return NextResponse.json({
    adresse: stop.address ?? 'Adresse unbekannt',
    kundeName,
    bestellNr,
    etaMinuten,
    distanzKm: Math.round(distanzKm * 10) / 10,
    sequence: (doneStops ?? 0) + 1,
    gesamtStops: totalStops ?? batch.orders_count ?? 1,
  });
}
