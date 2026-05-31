/**
 * GET /api/delivery/admin/push-stats?location_id=...
 *
 * Push-Benachrichtigungs-Monitoring für Admin-Dashboard.
 * Zeigt Durchsatz (24h) + ausstehende Pushes beider Kanäle:
 *  - mise  (Expo/VoIP — mobile Fahrer-App)
 *  - webpush (VAPID — browser-basierte Fahrer)
 *
 * Auth: Authentifizierter Admin-User.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [miseRes, webRes, pendingMise, pendingWeb] = await Promise.all([
    // mise: Expo/VoIP Pushes letzte 24h
    svc
      .from('mise_push_outbox')
      .select('id, sent_at, failed_at, type, created_at', { count: 'exact' })
      .gte('created_at', since),

    // webpush: VAPID Pushes letzte 24h
    svc
      .from('driver_push_outbox')
      .select('id, sent_at, error, created_at', { count: 'exact' })
      .gte('created_at', since),

    // mise: pending jetzt
    svc
      .from('mise_push_outbox')
      .select('id', { count: 'exact', head: true })
      .is('sent_at', null)
      .is('failed_at', null),

    // webpush: pending jetzt
    svc
      .from('driver_push_outbox')
      .select('id', { count: 'exact', head: true })
      .is('sent_at', null),
  ]);

  const miseRows = miseRes.data ?? [];
  const webRows = webRes.data ?? [];

  const miseSent = miseRows.filter((r) => r.sent_at !== null).length;
  const miseFailed = miseRows.filter((r) => r.failed_at !== null).length;

  const webSent = webRows.filter((r) => r.sent_at !== null).length;
  const webFailed = webRows.filter((r) => r.error !== null).length;

  const miseTotal = miseRows.length;
  const webTotal = webRows.length;

  // Dispatch-Push-Typen aufschlüsseln (letzte 24h)
  const typeBreakdown: Record<string, number> = {};
  for (const r of miseRows) {
    const t = (r.type as string | null) ?? 'unknown';
    typeBreakdown[t] = (typeBreakdown[t] ?? 0) + 1;
  }

  return NextResponse.json({
    mise: {
      total_24h:     miseTotal,
      delivered_24h: miseSent,
      failed_24h:    miseFailed,
      delivery_rate: miseTotal > 0 ? Math.round((miseSent / miseTotal) * 100) : null,
      pending_now:   pendingMise.count ?? 0,
    },
    webpush: {
      total_24h:     webTotal,
      delivered_24h: webSent,
      failed_24h:    webFailed,
      delivery_rate: webTotal > 0 ? Math.round((webSent / webTotal) * 100) : null,
      pending_now:   pendingWeb.count ?? 0,
    },
    type_breakdown: typeBreakdown,
    since,
  });
}
