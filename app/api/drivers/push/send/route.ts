import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  const provided = req.headers.get('x-internal-token');
  if (!expected || expected.length < 16 || provided !== expected) {
    return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return run();
}

async function run() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? 'mailto:ops@mise.app';

  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  }
  webpush.setVapidDetails(contact, publicKey, privateKey);

  const svc = createServiceClient();

  const { data: pending } = await svc
    .from('driver_push_outbox')
    .select('*')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  let sent = 0, failed = 0;
  for (const event of pending ?? []) {
    const batchId = typeof event.batch_id === 'string' ? event.batch_id : null;
    const { data: batch, error: batchError } = batchId
      ? await svc.from('mise_delivery_batches').select('state,state_version').eq('id', batchId).maybeSingle()
      : { data: null, error: null };
    if (batchError || !batch || !['pending_acceptance', 'assigned', 'at_pickup'].includes(String(batch.state))) {
      failed++;
      await svc.from('driver_push_outbox').update({
        sent_at: new Date().toISOString(), error: batchError ? 'BATCH_LOOKUP_FAILED' : 'BATCH_NOT_PUSHABLE',
      }).eq('id', event.id);
      continue;
    }
    const { data: subs } = await svc
      .from('driver_push_subscriptions')
      .select('*')
      .eq('employee_id', event.employee_id);

    const results = await Promise.allSettled(
      (subs ?? []).map((s) =>
        webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh_key, auth: s.auth_key },
        }, JSON.stringify({
          title: event.title,
          body: event.body,
          notification_id: String(event.id),
          assignment_id: batchId,
          assignment_version: Number(batch.state_version),
          expires_at: event.expires_at ?? null,
          url: event.url || '/fahrer/app',
          tag: `batch-${event.batch_id ?? event.id}`,
          urgent: true,
        })),
      ),
    );

    const anyOk = results.some((r) => r.status === 'fulfilled');
    if (anyOk) sent++; else failed++;

    await svc.from('driver_push_outbox')
      .update({ sent_at: new Date().toISOString(), error: anyOk ? null : 'All failed' })
      .eq('id', event.id);

    // Expired subs aufräumen
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const sub = subs?.[i];
      if (!sub) continue;
      if (res.status === 'rejected' && (res.reason?.statusCode === 404 || res.reason?.statusCode === 410)) {
        await svc.from('driver_push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: pending?.length ?? 0, sent, failed });
}
