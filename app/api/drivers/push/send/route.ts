import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/server';
import { internalCronUnauthorized, isInternalCronRequest } from '@/lib/internal-cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isInternalCronRequest(req)) return internalCronUnauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!isInternalCronRequest(req)) return internalCronUnauthorized();
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
          url: event.url || '/fahrer/app',
          tag: `batch-${event.batch_id ?? event.id}`,
          urgent: true,
        })),
      ),
    );

    const anyOk = results.some((r) => r.status === 'fulfilled');
    if (anyOk) sent++; else failed++;

    // Browser-only Fahrer sind nur dann dispatchbar, wenn mindestens ein
    // Web-Push-Abo existiert. Scheitern alle Abos, wird die noch nicht
    // angenommene Tour atomar freigegeben. Gibt es parallel einen nativen
    // Kanal, übernimmt dessen eigene Outbox die Zustellgarantie.
    if (!anyOk && event.batch_id) {
      const { data: employee } = await svc.from('employees')
        .select('auth_user_id').eq('id', event.employee_id).maybeSingle();
      const { data: driver } = employee?.auth_user_id
        ? await svc.from('mise_drivers')
            .select('push_enabled,expo_push_token,voip_push_token')
            .eq('auth_user_id', employee.auth_user_id).maybeSingle()
        : { data: null };
      const hasNativeFallback = Boolean(
        driver?.push_enabled && (driver.expo_push_token || driver.voip_push_token),
      );
      if (!hasNativeFallback) {
        const { error: requeueError } = await svc.rpc('requeue_delivery_batch', {
          p_batch_id: event.batch_id,
          p_reason: 'webpush_all_failed',
          p_exclude_minutes: 15,
        });
        if (requeueError) {
          return NextResponse.json({ ok: false, error: `web-push requeue failed: ${requeueError.message}` }, { status: 500 });
        }
      }
    }

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
