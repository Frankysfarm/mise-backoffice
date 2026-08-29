import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getValidTableSession, isSameOriginRequest } from '@/lib/orders/table-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TYPES = new Set(['service', 'nachbestellen', 'rechnung', 'bezahlen', 'besteck', 'problem']);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const tableId = String(body?.tableId ?? '').trim();
  const requestType = String(body?.requestType ?? '').trim();
  const message = String(body?.message ?? '').trim().slice(0, 500) || null;
  const orderId = String(body?.orderId ?? '').trim() || null;
  if (!/^[0-9a-f-]{36}$/i.test(tableId) || !REQUEST_TYPES.has(requestType)) {
    return NextResponse.json({ error: 'Serviceanfrage ungültig' }, { status: 400 });
  }

  const session = await getValidTableSession(request, tableId);
  if (!session) {
    return NextResponse.json({ error: 'Tischsitzung ist abgelaufen. Bitte QR-Code erneut scannen.' }, { status: 401 });
  }
  const service = createServiceClient();
  const { data: table } = await service
    .from('restaurant_tables')
    .select('id,service_department_id')
    .eq('id', tableId)
    .eq('tenant_id', session.tenant_id)
    .eq('location_id', session.location_id)
    .eq('qr_version', session.qr_version)
    .eq('aktiv', true)
    .maybeSingle();
  if (!table) return NextResponse.json({ error: 'Tisch ist nicht mehr aktiv.' }, { status: 409 });

  let assignedTo: string | null = null;
  if (table.service_department_id) {
    const { data: responsibility } = await service
      .from('department_responsibility_assignments')
      .select('employee_id')
      .eq('department_id', table.service_department_id)
      .eq('responsibility_role', 'hauptverantwortung')
      .eq('aktiv', true)
      .lte('valid_from', new Date().toISOString().slice(0, 10))
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    assignedTo = responsibility?.employee_id ?? null;
  }

  const { data: created, error } = await service
    .from('table_service_requests')
    .insert({
      tenant_id: session.tenant_id,
      location_id: session.location_id,
      table_id: tableId,
      session_id: session.id,
      order_id: orderId,
      request_type: requestType,
      message,
      assigned_department_id: table.service_department_id,
      assigned_to: assignedTo,
    })
    .select('id,status,created_at')
    .single();
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Diese Anfrage ist bereits beim Service offen.' }, { status: 409 });
  }
  if (error || !created) {
    return NextResponse.json({ error: 'Serviceanfrage konnte nicht gespeichert werden.' }, { status: 500 });
  }

  if (assignedTo) {
    await service.from('notifications').insert({
      employee_id: assignedTo,
      typ: 'warnung',
      titel: 'Neue Tischanfrage',
      nachricht: requestType === 'service' ? 'Ein Gast ruft den Service.' : `Neue Anfrage: ${requestType}`,
      link: '/neo/app/tischbestellung?tab=service',
    });
  }
  return NextResponse.json(created, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
