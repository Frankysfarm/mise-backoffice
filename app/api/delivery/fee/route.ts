/**
 * GET /api/delivery/fee
 *
 * Berechnet die Liefergebühr für eine Adresse + Bestellwert.
 * Öffentlicher Endpunkt — kein Login erforderlich (für Storefront-Checkout).
 *
 * Query-Parameter:
 *   location_id   UUID des Restaurant-Standorts
 *   lat           Kunden-Breitengrad (z.B. 52.5200)
 *   lng           Kunden-Längengrad (z.B. 13.4050)
 *   order_total   Bestellwert in EUR (z.B. 24.50)
 *
 * Antwort (200):
 *   zone, zone_label, zone_color, distance_km, eta_min,
 *   base_fee_eur, surge_multiplier, surge_surcharge_eur,
 *   total_fee_eur, is_free_delivery, free_delivery_above_eur,
 *   min_order_eur, is_min_order_met, breakdown
 *
 * Fehler:
 *   400 — fehlende oder ungültige Parameter
 *   422 — Adresse liegt außerhalb des Liefergebiets
 *   500 — interner Fehler
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryFeeQuote } from '@/lib/delivery/delivery-fee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const locationId  = searchParams.get('location_id');
  const latStr      = searchParams.get('lat');
  const lngStr      = searchParams.get('lng');
  const totalStr    = searchParams.get('order_total');

  if (!locationId || !latStr || !lngStr || !totalStr) {
    return NextResponse.json(
      { error: 'Fehlende Parameter: location_id, lat, lng, order_total erforderlich' },
      { status: 400 },
    );
  }

  const lat        = parseFloat(latStr);
  const lng        = parseFloat(lngStr);
  const orderTotal = parseFloat(totalStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Ungültige Koordinaten (lat/lng)' }, { status: 400 });
  }
  if (isNaN(orderTotal) || orderTotal < 0) {
    return NextResponse.json({ error: 'Ungültiger Bestellwert (order_total)' }, { status: 400 });
  }

  try {
    const quote = await getDeliveryFeeQuote(locationId, { lat, lng }, orderTotal);
    return NextResponse.json(quote);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('keine GPS-Koordinaten')) {
      return NextResponse.json({ error: 'Location nicht konfiguriert' }, { status: 422 });
    }
    console.error('[api/delivery/fee]', msg);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
