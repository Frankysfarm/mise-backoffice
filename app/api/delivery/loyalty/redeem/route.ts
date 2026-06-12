/**
 * POST /api/delivery/loyalty/redeem
 *
 * Punkte im Checkout einlösen.
 * Body: { email, location_id, points, order_id, order_amount_eur }
 *
 * Kein Auth — Sicherheit durch E-Mail + order_id Kombination.
 * Gibt discountEur zurück, der vom Bestellbetrag abgezogen wird.
 */
import { NextRequest, NextResponse } from 'next/server';
import { redeemPoints, MIN_REDEEM_POINTS } from '@/lib/delivery/loyalty-points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RedeemBody {
  email?: string;
  location_id?: string;
  points?: number;
  order_id?: string;
  order_amount_eur?: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as RedeemBody;

  const { email, location_id, points, order_id, order_amount_eur } = body;

  if (!email || !location_id || !order_id) {
    return NextResponse.json({ ok: false, reason: 'email, location_id und order_id erforderlich' }, { status: 400 });
  }
  if (!points || !Number.isInteger(points) || points < MIN_REDEEM_POINTS) {
    return NextResponse.json({ ok: false, reason: `Mindest-Einlösung: ${MIN_REDEEM_POINTS} Punkte` }, { status: 400 });
  }
  if (!order_amount_eur || order_amount_eur <= 0) {
    return NextResponse.json({ ok: false, reason: 'order_amount_eur erforderlich' }, { status: 400 });
  }

  const result = await redeemPoints({
    customerEmail:  email,
    locationId:     location_id,
    points,
    orderId:        order_id,
    orderAmountEur: order_amount_eur,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
