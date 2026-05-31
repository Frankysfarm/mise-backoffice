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

  await Promise.all([
    sb().from('mise_drivers')
      .update({ active: false, state: 'offline' })
      .eq('id', m.driver.id),
    m.driver.employee_id
      ? sb().from('driver_status')
          .update({ ist_online: false, online_seit: null })
          .eq('employee_id', m.driver.employee_id)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
