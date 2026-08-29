import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = new Set(['confirm_session', 'accept_request', 'complete_request', 'regenerate_qr']);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id || !actor.location_id || !['manager', 'backoffice', 'admin'].includes(actor.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '');
  const id = String(body?.id ?? '');
  if (!ACTIONS.has(action) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Aktion ungültig' }, { status: 400 });
  }

  const service = createServiceClient();
  if (action === 'confirm_session') {
    const { data, error } = await service.from('table_sessions').update({
      status: 'aktiv', confirmed_by_employee_id: actor.id, confirmed_at: new Date().toISOString(),
    }).eq('id', id).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id)
      .eq('status', 'wartet_auf_bestaetigung').gt('expires_at', new Date().toISOString())
      .select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Sitzung nicht gefunden oder abgelaufen.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept_request' || action === 'complete_request') {
    const patch = action === 'accept_request'
      ? { status: 'angenommen', assigned_to: actor.id, accepted_at: new Date().toISOString() }
      : { status: 'erledigt', completed_at: new Date().toISOString() };
    const expected = action === 'accept_request' ? 'offen' : 'angenommen';
    const { data, error } = await service.from('table_service_requests').update(patch)
      .eq('id', id).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id)
      .eq('status', expected).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Serviceanfrage wurde bereits geändert.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const qrToken = randomUUID();
  const { data: table, error } = await service.from('restaurant_tables')
    .update({ qr_token: qrToken })
    .eq('id', id).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id)
    .select('id,qr_token,qr_version').maybeSingle();
  if (error || !table) return NextResponse.json({ error: 'Tisch nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ ok: true, qrToken: table.qr_token, qrVersion: table.qr_version });
}
