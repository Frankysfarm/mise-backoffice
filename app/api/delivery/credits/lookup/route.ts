/**
 * GET /api/delivery/credits/lookup?token=xxx
 *
 * Öffentlicher Endpunkt — kein Auth.
 * Storefront prüft damit einen Credit-Token vor dem Checkout.
 *
 * Response:
 *   200  { token, amountEur, status, expiresAt, customerName, reason, valid: true }
 *   400  { error: 'token_required' }
 *   404  { error: 'not_found' }
 *   200  { valid: false, reason: 'expired'|'redeemed'|'cancelled' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { lookupCreditByToken } from '@/lib/delivery/credits';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  const credit = await lookupCreditByToken(token);
  if (!credit) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (credit.status !== 'issued') {
    return NextResponse.json({ valid: false, reason: credit.status });
  }

  if (credit.expiresAt && new Date(credit.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }

  return NextResponse.json({
    valid:        true,
    token:        credit.token,
    amountEur:    credit.amountEur,
    status:       credit.status,
    expiresAt:    credit.expiresAt,
    customerName: credit.customerName,
    reason:       credit.reason,
  });
}
