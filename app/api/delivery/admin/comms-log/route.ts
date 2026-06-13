/**
 * GET  /api/delivery/admin/comms-log
 *   ?action=dashboard|log|stats|drivers
 *   &channel=push|broadcast|in_app|system
 *   &message_type=...
 *   &driver_id=...
 *   &status=sent|delivered|read|failed
 *   &from=ISO&to=ISO
 *   &limit=50&offset=0
 *
 * POST /api/delivery/admin/comms-log
 *   action=send_direct  — direkte Push-Nachricht an Fahrer
 *   action=mark_read    — Nachricht als gelesen markieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCommLogDashboard,
  getCommunicationLog,
  getCommLogStats,
  getDriverCommSummaries,
  markCommRead,
  markCommDelivered,
  sendDirectDriverMessage,
  type CommChannel,
  type CommType,
  type CommStatus,
} from '@/lib/delivery/comms-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(
  sb: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  qLocationId: string | null,
): Promise<string | null> {
  if (qLocationId) return qLocationId;
  const { data } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', data.tenant_id as string)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(sb, user.id, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getCommLogDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  if (action === 'log') {
    const result = await getCommunicationLog({
      locationId,
      driverId:    searchParams.get('driver_id')     ?? undefined,
      channel:     (searchParams.get('channel')      ?? undefined) as CommChannel | undefined,
      messageType: (searchParams.get('message_type') ?? undefined) as CommType   | undefined,
      status:      (searchParams.get('status')       ?? undefined) as CommStatus  | undefined,
      fromDate:    searchParams.get('from')           ?? undefined,
      toDate:      searchParams.get('to')             ?? undefined,
      limit:       Number(searchParams.get('limit')  ?? 50),
      offset:      Number(searchParams.get('offset') ?? 0),
    });
    return NextResponse.json(result);
  }

  if (action === 'stats') {
    const stats = await getCommLogStats(locationId);
    return NextResponse.json({ stats });
  }

  if (action === 'drivers') {
    const drivers = await getDriverCommSummaries(locationId);
    return NextResponse.json({ drivers });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (body.action as string) ?? '';

  if (action === 'mark_read') {
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
    await markCommRead(id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_delivered') {
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
    await markCommDelivered(id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'send_direct') {
    const locationId = await resolveLocationId(
      sb, user.id, (body.location_id as string | null) ?? null,
    );
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const driverId = body.driver_id as string | undefined;
    const msgBody  = body.body as string | undefined;
    const msgTitle = body.title as string | undefined;
    if (!driverId || !msgBody) {
      return NextResponse.json({ error: 'driver_id und body sind Pflicht' }, { status: 400 });
    }

    // Absender-Name aus employees holen
    const { data: emp } = await sb
      .from('employees')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

    const result = await sendDirectDriverMessage({
      locationId,
      driverId,
      title:       msgTitle ?? 'Nachricht vom Dispatch',
      body:        msgBody,
      sentByName:  (emp?.name as string | null) ?? undefined,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
