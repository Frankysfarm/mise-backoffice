import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Body = {
  order_id: string;
  tenant_id: string;
  tracking_token: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.subscription?.endpoint || !body.subscription.keys?.p256dh || !body.subscription.keys?.auth) {
    return NextResponse.json({ ok: false, error: 'Invalid subscription' }, { status: 400 });
  }
  if (!body.order_id || !body.tenant_id || !body.tracking_token) {
    return NextResponse.json({ ok: false, error: 'Missing tracking capability' }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: order } = await svc
    .from('customer_orders')
    .select('id, tenant_id, kunde_telefon, kunde_email')
    .eq('id', body.order_id)
    .eq('tenant_id', body.tenant_id)
    .eq('tracking_token', body.tracking_token)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 401 });
  }

  const { error } = await svc.from('customer_push_subscriptions').upsert({
    tenant_id: order.tenant_id,
    order_id: order.id,
    telefon: order.kunde_telefon ?? null,
    email: order.kunde_email ?? null,
    endpoint: body.subscription.endpoint,
    p256dh_key: body.subscription.keys.p256dh,
    auth_key: body.subscription.keys.auth,
    marketing_opt_in: true,  // Ein Ja = alles, jederzeit abbestellbar
  }, { onConflict: 'tenant_id,endpoint' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // VAPID-Public-Key für Client
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  return NextResponse.json({ ok: true, publicKey: key });
}
