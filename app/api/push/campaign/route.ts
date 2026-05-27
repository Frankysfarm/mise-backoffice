import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sendet eine Marketing-Push-Kampagne an Kunden.
 * Nur für Manager+ des jeweiligen Tenants.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb.from('employees').select('tenant_id, rolle').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ ok: false, error: 'Kein Tenant' }, { status: 403 });

  const body = await req.json();
  const { tenant_id, title, body: pushBody, url, segment } = body as {
    tenant_id: string;
    title: string;
    body: string;
    url?: string;
    segment: 'all' | 'last_30' | 'new_3' | 'test';
  };

  if (tenant_id !== emp.tenant_id) {
    return NextResponse.json({ ok: false, error: 'Tenant-Mismatch' }, { status: 403 });
  }
  if (!title?.trim() || !pushBody?.trim()) {
    return NextResponse.json({ ok: false, error: 'Titel und Text sind Pflicht' }, { status: 400 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? 'mailto:ops@mise.app';
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: 'VAPID nicht konfiguriert' }, { status: 503 });
  }
  webpush.setVapidDetails(contact, publicKey, privateKey);

  const svc = createServiceClient();

  // Test-Modus: Nur an den aktuellen User (falls eingeloggt als Kunde)
  if (segment === 'test') {
    // Wir senden eine echte Push, wenn der Manager selbst eine Subscription in seinem Tenant hat.
    const { data: testSubs } = await svc
      .from('customer_push_subscriptions')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!testSubs || testSubs.length === 0) {
      return NextResponse.json({ ok: false, error: 'Keine Test-Subscription verfügbar. Abonniere zuerst selbst über /track/...' });
    }

    try {
      const sub = testSubs[0];
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      }, JSON.stringify({
        title, body: pushBody,
        tag: `test-${Date.now()}`,
        url: url || '/',
        unsubscribe_token: sub.unsubscribe_token,
      }));
      return NextResponse.json({ ok: true, test: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Test-Push fehlgeschlagen' });
    }
  }

  // Segment-Query bauen
  let query = svc.from('customer_push_subscriptions').select('*')
    .eq('tenant_id', tenant_id)
    .eq('marketing_opt_in', true);

  if (segment === 'last_30') {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    query = query.gte('created_at', cutoff);
  }
  // Für 'new_3' (Stammkunden) bräuchten wir einen Join über orders — für MVP simpler: nehme alle Subs die >= 3 Orders haben
  // TODO: Sauberer Stammkunden-Filter via View/RPC, später.

  const { data: subs, error: subsErr } = await query;
  if (subsErr) return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 });

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: false, error: 'Keine Empfänger im gewählten Segment' });
  }

  // Direkt senden (kein Outbox-Zwischenschritt für Marketing-Campaigns — einfacher)
  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      }, JSON.stringify({
        title, body: pushBody,
        tag: `campaign-${Date.now()}`,
        url: url || '/',
        unsubscribe_token: sub.unsubscribe_token,
      }));
      sent++;
    } catch (e: any) {
      failed++;
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await svc.from('customer_push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  // Historie schreiben
  await svc.from('customer_push_outbox').insert({
    order_id: null,
    status: 'campaign',
    title,
    body: pushBody,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, sent, failed, queued: subs.length });
}
