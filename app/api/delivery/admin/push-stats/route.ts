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
import { createServiceClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const svc = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Die Outbox-Tabellen tragen keine tenant_id. Deshalb werden erlaubte
  // Empfänger zuerst aus der Mandantenzuordnung des Admins aufgelöst.
  const [{ data: driverMemberships }, { data: employees }] = await Promise.all([
    svc.from('mise_driver_tenants')
      .select('driver_id')
      .eq('tenant_id', actor.tenant_id as string),
    svc.from('employees')
      .select('id')
      .eq('tenant_id', actor.tenant_id as string),
  ]);
  const driverIds = (driverMemberships ?? []).map((row) => row.driver_id as string);
  const employeeIds = (employees ?? []).map((row) => row.id as string);

  const [miseRes, webRes, pendingMise, pendingWeb] = await Promise.all([
    // mise: Expo/VoIP Pushes letzte 24h
    driverIds.length > 0 ? svc
      .from('mise_push_outbox')
      .select('id, sent_at, failed_at, type, created_at', { count: 'exact' })
      .in('driver_id', driverIds)
      .gte('created_at', since) : Promise.resolve({ data: [], count: 0 }),

    // webpush: VAPID Pushes letzte 24h
    employeeIds.length > 0 ? svc
      .from('driver_push_outbox')
      .select('id, sent_at, error, created_at', { count: 'exact' })
      .in('employee_id', employeeIds)
      .gte('created_at', since) : Promise.resolve({ data: [], count: 0 }),

    // mise: pending jetzt
    driverIds.length > 0 ? svc
      .from('mise_push_outbox')
      .select('id', { count: 'exact', head: true })
      .in('driver_id', driverIds)
      .is('sent_at', null)
      .is('failed_at', null) : Promise.resolve({ data: null, count: 0 }),

    // webpush: pending jetzt
    employeeIds.length > 0 ? svc
      .from('driver_push_outbox')
      .select('id', { count: 'exact', head: true })
      .in('employee_id', employeeIds)
      .is('sent_at', null) : Promise.resolve({ data: null, count: 0 }),
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
