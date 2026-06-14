/**
 * POST /api/delivery/push/customer/subscribe
 *   body: { locationId, subscription: {endpoint, keys:{p256dh,auth}}, email?, orderId?, lang? }
 *   → speichert Browser-Push-Subscription
 *
 * DELETE /api/delivery/push/customer/subscribe
 *   body: { endpoint }
 *   → entfernt Subscription
 */
import { NextRequest, NextResponse } from 'next/server';
import { saveSubscription, removeSubscription } from '@/lib/delivery/customer-web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { locationId, subscription, email, orderId, lang } = body as {
    locationId:   string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    email?:       string;
    orderId?:     string;
    lang?:        string;
  };

  if (!locationId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'locationId, subscription.endpoint/keys required' }, { status: 400 });
  }

  try {
    const id = await saveSubscription({
      locationId,
      endpoint:  subscription.endpoint,
      p256dhKey: subscription.keys.p256dh,
      authKey:   subscription.keys.auth,
      email:     email,
      orderId:   orderId,
      userAgent: req.headers.get('user-agent') ?? undefined,
      lang:      lang,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[customer-push/subscribe] POST:', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });

  await removeSubscription(endpoint).catch(() => {});
  return NextResponse.json({ ok: true });
}
