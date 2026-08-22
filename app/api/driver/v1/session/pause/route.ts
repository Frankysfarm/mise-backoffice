import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();

  const { data, error } = await sb().rpc('pause_driver_dispatch_session', {
    p_driver_id: auth.driver.id,
    p_reason: 'manual',
    p_allow_active_batch: false,
  });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    const activeBatch = error?.message?.includes('active delivery batch');
    return NextResponse.json(
      { ok: false, error: activeBatch ? 'Du hast eine aktive Tour — schließe sie erst ab.' : (error?.message ?? 'Pause konnte nicht gestartet werden') },
      { status: activeBatch ? 409 : 503 },
    );
  }
  return NextResponse.json(data);
}
