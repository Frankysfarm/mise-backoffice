import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAdminContext, isAdminContext } from '../../_lib/tenant-from-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DutyAction = 'pause' | 'resume' | 'end';

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!isAdminContext(ctx)) return ctx;
  if (!['manager', 'backoffice', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Nur Manager dürfen den Fahrer-Dienststatus ändern' }, { status: 403 });
  }

  let body: { driver_id?: string; action?: DutyAction };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }
  if (!body.driver_id || !['pause', 'resume', 'end'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'Fahrer und Aktion fehlen' }, { status: 400 });
  }

  const client = createServiceClient();
  const { data: membership } = await client.from('mise_driver_tenants')
    .select('driver_id')
    .eq('driver_id', body.driver_id)
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Fahrer gehört nicht zu diesem Betrieb' }, { status: 404 });

  const { data: driver } = await client.from('mise_drivers')
    .select('auth_user_id')
    .eq('id', body.driver_id)
    .maybeSingle();
  const { data: employee } = driver?.auth_user_id
    ? await client.from('employees').select('location_id')
        .eq('auth_user_id', driver.auth_user_id).eq('tenant_id', ctx.tenant_id).maybeSingle()
    : { data: null };

  let result: { data: unknown; error: { message: string } | null };
  if (body.action === 'pause') {
    result = await client.rpc('pause_driver_dispatch_session', {
      p_driver_id: body.driver_id,
      p_reason: 'admin',
      p_allow_active_batch: true,
    });
  } else if (body.action === 'resume') {
    if (!employee?.location_id) return NextResponse.json({ error: 'Fahrerstandort fehlt' }, { status: 409 });
    result = await client.rpc('resume_driver_dispatch_session', {
      p_driver_id: body.driver_id,
      p_location_id: employee.location_id,
    });
  } else {
    result = await client.rpc('end_driver_dispatch_session', { p_driver_id: body.driver_id });
  }

  if (result.error) {
    const activeBatch = result.error.message.includes('active delivery batch');
    return NextResponse.json(
      { error: activeBatch ? 'Der Fahrer hat noch eine aktive Tour. Stoppe nur neue Zuweisungen oder warte bis zum Abschluss.' : result.error.message },
      { status: activeBatch ? 409 : 503 },
    );
  }
  return NextResponse.json({ ok: true, duty: result.data });
}
