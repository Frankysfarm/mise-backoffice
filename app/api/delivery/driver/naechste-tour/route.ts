/**
 * GET /api/delivery/driver/naechste-tour?driver_id=<uuid>
 *
 * Phase 704 — Nächste-Tour-Vorab-Info
 * Zeigt dem Fahrer die kommende assigned Batch (noch nicht gestartet)
 * mit Stops, Distanz und geschätzter Fahrzeit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 30 km/h Durchschnitt im Stadtverkehr
const AVG_SPEED_KMH = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  // Find the next assigned batch not yet started
  const { data: batch } = await sb
    .from('delivery_batches')
    .select('id, distance_km, orders_count')
    .eq('driver_id', driverId)
    .eq('status', 'assigned')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!batch) return NextResponse.json({ batch_id: null });

  // Fetch stops for this batch
  const { data: stops } = await sb
    .from('delivery_stops')
    .select('id, address, order_id, sequence')
    .eq('batch_id', batch.id)
    .order('sequence', { ascending: true });

  // Fetch order details (customer name, order number, item count)
  const stopDetails = await Promise.all(
    (stops ?? []).map(async (stop) => {
      if (!stop.order_id) {
        return {
          adresse: stop.address ?? 'Adresse unbekannt',
          kundeName: 'Kunde',
          bestellNr: `#${stop.id.slice(0, 4)}`,
          anzahlArtikel: 0,
        };
      }
      const { data: order } = await sb
        .from('orders')
        .select('order_number, customer_name, items_count')
        .eq('id', stop.order_id)
        .maybeSingle();

      return {
        adresse: stop.address ?? 'Adresse unbekannt',
        kundeName: order?.customer_name ?? 'Kunde',
        bestellNr: order?.order_number ? `#${order.order_number}` : `#${stop.id.slice(0, 4)}`,
        anzahlArtikel: order?.items_count ?? 0,
      };
    }),
  );

  const distanzKm = batch.distance_km ?? stopDetails.length * 2.5;
  const geschaetzteMinuten = Math.round((distanzKm / AVG_SPEED_KMH) * 60);

  return NextResponse.json({
    batch_id: batch.id,
    stops: stopDetails,
    distanzKm: Math.round(distanzKm * 10) / 10,
    geschaetzteMinuten,
  });
}
