/**
 * POST /api/delivery/customer/refresh-tracking
 *
 * Storefront-Tracking-Token-Refresh — erneut Tracking-Link senden.
 * Phase 486
 *
 * Body: { order_id }
 * Response: { ok: true, trackingUrl: string, orderId: string }
 * Auth: public endpoint (no auth required)
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RefreshTrackingBody {
  order_id: string;
}

interface CustomerOrder {
  id: string;
  status: string;
  location_id: string;
  rating_token: string | null;
}

export async function POST(req: NextRequest) {
  let body: RefreshTrackingBody;
  try {
    body = (await req.json()) as RefreshTrackingBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { order_id } = body;
  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: orderData, error: orderError } = await supabase
    .from('customer_orders')
    .select('id, status, location_id, rating_token')
    .eq('id', order_id)
    .single();

  if (orderError || !orderData) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const order = orderData as unknown as CustomerOrder;

  if (order.status === 'geliefert' || order.status === 'cancelled') {
    return NextResponse.json({ error: 'Bestellung bereits abgeschlossen' }, { status: 400 });
  }

  const newToken = randomBytes(12).toString('hex');

  const { error: updateError } = await supabase
    .from('customer_orders')
    .update({ rating_token: newToken })
    .eq('id', order_id);

  if (updateError) {
    console.error('[refresh-tracking POST] update error:', updateError);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }

  const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/track/${newToken}`;

  return NextResponse.json({ ok: true, trackingUrl, orderId: order_id });
}
