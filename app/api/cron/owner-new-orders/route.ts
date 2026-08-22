import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import webpush from 'web-push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-cron-key') || new URL(req.url).searchParams.get('key');
  if (!process.env.CRON_KEY || key !== process.env.CRON_KEY) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const pub = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_CONTACT ?? 'mailto:ops@mise-gastro.de', pub, priv);

  const svc = createServiceClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  // neue, noch nicht gepushte Bestellungen der letzten 10 Min
  const { data: orders } = await svc.from('customer_orders')
    .select('id, tenant_id, bestellnummer, gesamtbetrag, typ, kunde_name')
    .eq('status', 'neu').is('owner_pushed_at', null).gte('created_at', since).limit(50);
  let sent = 0;
  for (const o of (orders ?? []) as any[]) {
    // Atomar beanspruchen: nur wenn owner_pushed_at noch NULL — verhindert Doppel-Push bei überlappenden Cron-Läufen
    const { data: claimed } = await svc.from('customer_orders').update({ owner_pushed_at: new Date().toISOString() }).eq('id', o.id).is('owner_pushed_at', null).select('id');
    if (!claimed || claimed.length === 0) continue; // schon von parallelem Lauf beansprucht
    if (!o.tenant_id) continue;
    const { data: subs } = await svc.from('owner_push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('tenant_id', o.tenant_id);
    const betrag = Number(o.gesamtbetrag ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 });
    const payload = JSON.stringify({ title: '🛎 Neue Bestellung', body: `#${String(o.bestellnummer ?? '').slice(-5)} · ${betrag} € · ${o.typ === 'abholung' ? 'Abholung' : 'Lieferung'}${o.kunde_name ? ' · ' + o.kunde_name : ''}`, url: '/neo/app/lieferzentrale', tag: `order-${o.id}`, urgent: true });
    await Promise.allSettled((subs ?? []).map((s: any) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } }, payload).catch(() => {})));
    sent++;
  }
  return NextResponse.json({ ok: true, pushed: sent });
}
