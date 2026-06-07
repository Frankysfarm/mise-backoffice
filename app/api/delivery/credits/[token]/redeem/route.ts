/**
 * POST /api/delivery/credits/[token]/redeem
 *
 * Öffentlicher Endpunkt — Auth via Token + location_id.
 * Wird nach erfolgreicher Bestellerstellung vom Storefront aufgerufen.
 *
 * Body: { order_id: string, location_id: string }
 *
 * Response:
 *   200  { ok: true, amountEur: number }
 *   400  { ok: false, reason: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { redeemCreditOnOrder } from '@/lib/delivery/credits';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse> {
  const token = params.token?.trim();
  if (!token || token.length < 10) {
    return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 400 });
  }

  let body: { order_id?: string; location_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
  }

  const { order_id, location_id } = body;
  if (!order_id || !location_id) {
    return NextResponse.json({ ok: false, reason: 'order_id and location_id required' }, { status: 400 });
  }

  const result = await redeemCreditOnOrder(token, order_id, location_id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true, amountEur: result.amountEur });
}
