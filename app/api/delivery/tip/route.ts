/**
 * POST /api/delivery/tip
 *
 * Öffentlicher Storefront-Endpoint: Trinkgeld für eine Bestellung setzen.
 * Kein Auth erforderlich — Validierung über orderId.
 *
 * Body: { orderId: string; tipEur: number; locationId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { recordTip, getTipConfig } from '@/lib/delivery/tips';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const config = await getTipConfig(locationId);
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { orderId?: string; tipEur?: number; locationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { orderId, tipEur } = body;

  if (!orderId || typeof tipEur !== 'number') {
    return NextResponse.json({ error: 'orderId and tipEur required' }, { status: 400 });
  }

  if (tipEur < 0 || tipEur > 100) {
    return NextResponse.json({ error: 'tipEur out of range (0–100)' }, { status: 400 });
  }

  try {
    const result = await recordTip(orderId, tipEur);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[tip] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
