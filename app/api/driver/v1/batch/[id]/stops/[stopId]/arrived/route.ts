// POST: stopId arrived_at setzen
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../../../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> },
) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  const { id, stopId } = await params;

  const { error } = await sb()
    .from('mise_delivery_batch_stops')
    .update({ arrived_at: new Date().toISOString() })
    .eq('id', stopId)
    .eq('batch_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
