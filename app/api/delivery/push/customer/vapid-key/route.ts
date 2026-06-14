/**
 * GET /api/delivery/push/customer/vapid-key
 *
 * Öffentlicher Endpunkt — gibt VAPID Public Key zurück für Browser-Subscription.
 * Kein Login erforderlich.
 */
import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/delivery/customer-web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
