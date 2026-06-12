/**
 * GET /api/delivery/loyalty/balance
 *   ?email=...&location_id=...
 *
 * Öffentlicher Endpunkt — kein Auth erforderlich.
 * Gibt Kontostand, Tier und max. einlösbare Punkte zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/delivery/loyalty-points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email      = searchParams.get('email')?.trim() ?? '';
  const locationId = searchParams.get('location_id')?.trim() ?? '';

  if (!email || !locationId) {
    return NextResponse.json({ error: 'email und location_id erforderlich' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  const balance = await getBalance(email, locationId);

  if (!balance) {
    return NextResponse.json({
      found: false,
      totalPoints: 0,
      lifetimePoints: 0,
      tier: 'bronze',
      maxRedeemPoints: 0,
      maxRedeemEur: 0,
    });
  }

  return NextResponse.json({ found: true, ...balance });
}
