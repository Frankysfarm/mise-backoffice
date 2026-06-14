/**
 * POST /api/delivery/vouchers/validate
 *
 * Öffentlicher Endpunkt für die Storefront-Checkout-Seite.
 * Prüft Gutschein-Code, Mindestbestellwert und Per-Kunden-Limit.
 * Gibt Rabattbetrag zurück — keine Einlösung (nur Vorab-Prüfung).
 *
 * Body: { code, location_id, customer_phone, order_total_eur, delivery_fee_eur? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateVoucher } from '@/lib/delivery/vouchers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const code           = typeof body.code === 'string' ? body.code : '';
  const locationId     = typeof body.location_id === 'string' ? body.location_id : '';
  const customerPhone  = typeof body.customer_phone === 'string' ? body.customer_phone : '';
  const orderTotal     = Number(body.order_total_eur ?? 0);
  const deliveryFee    = Number(body.delivery_fee_eur ?? 0);
  const customerSegment = typeof body.customer_segment === 'string' ? body.customer_segment : undefined;

  if (!code || !locationId || !customerPhone) {
    return NextResponse.json(
      { valid: false, discount_eur: 0, error: 'code, location_id und customer_phone sind erforderlich.' },
      { status: 400 },
    );
  }

  const result = await validateVoucher(
    code,
    locationId,
    customerPhone,
    orderTotal,
    deliveryFee,
    customerSegment,
  );

  return NextResponse.json(result);
}
