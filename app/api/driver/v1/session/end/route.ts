import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  const { data: activeBatch } = await sb()
    .from('mise_delivery_batches')
    .select('id')
    .eq('driver_id', m.driver.id)
    .not('state', 'in', '("completed","cancelled")')
    .maybeSingle();
  if (activeBatch) {
    return NextResponse.json(
      {
        error: 'Du hast eine aktive Tour — schließe sie erst ab.',
        active_batch_id: activeBatch.id,
      },
      { status: 409 },
    );
  }

  const c = sb();
  const { data: ended, error } = await c.rpc('end_driver_dispatch_session', {
    p_driver_id: m.driver.id,
  });
  if (error || !ended) return NextResponse.json({ error: error?.message ?? 'Schicht konnte nicht beendet werden' }, { status: 409 });
  const { data: identity } = await c.from('mise_drivers').select('auth_user_id').eq('id', m.driver.id).maybeSingle();
  const { data: employee } = identity?.auth_user_id
    ? await c.from('employees').select('id').eq('auth_user_id', identity.auth_user_id).maybeSingle()
    : { data: null };
  await Promise.all([
    employee?.id
      ? c.from('driver_status')
          .update({ ist_online: false, online_seit: null })
          .eq('employee_id', employee.id)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
