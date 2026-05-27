import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel-Cron ruft als GET, wir akzeptieren beides
export async function GET() { return run(); }
export async function POST() { return run(); }

async function run() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? 'mailto:ops@mise.app';

  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);

  const svc = createServiceClient();

  const { data: pending, error } = await svc
    .from('customer_push_outbox')
    .select('*')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;

  for (const event of pending ?? []) {
    const { data: subs } = await svc
      .from('customer_push_subscriptions')
      .select('*')
      .eq('order_id', event.order_id);

    const results = await Promise.allSettled(
      (subs ?? []).map((s) => {
        const payload = JSON.stringify({
          title: event.title,
          body: event.body,
          tag: `order-${event.order_id}`,
          url: `/track/${event.order_id}`,
          unsubscribe_token: s.unsubscribe_token,
        });
        return webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh_key, auth: s.auth_key },
        }, payload);
      }),
    );

    const anyOk = results.some((r) => r.status === 'fulfilled');
    if (anyOk) sent++; else failed++;

    await svc
      .from('customer_push_outbox')
      .update({ sent_at: new Date().toISOString(), error: anyOk ? null : 'All subscriptions failed' })
      .eq('id', event.id);

    // Expired Subscriptions aufräumen (Gone / Not Registered)
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const sub = subs?.[i];
      if (!sub) continue;
      if (res.status === 'rejected' && (res.reason?.statusCode === 404 || res.reason?.statusCode === 410)) {
        await svc.from('customer_push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: pending?.length ?? 0, sent, failed });
}
