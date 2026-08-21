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

  const client = sb();
  const { data: batch, error: batchError } = await client
    .from('mise_delivery_batches')
    .select('id')
    .eq('id', id)
    .eq('driver_id', m.driver.id)
    .in('state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .maybeSingle();
  if (batchError) return NextResponse.json({ error: 'Tour konnte nicht geprüft werden' }, { status: 500 });
  if (!batch) return NextResponse.json({ error: 'Tour gehört nicht zu diesem Fahrer' }, { status: 403 });

  const { data: stop, error } = await client
    .from('mise_delivery_batch_stops')
    .update({ arrived_at: new Date().toISOString() })
    .eq('id', stopId)
    .eq('batch_id', id)
    .eq('cancelled', false)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stop) return NextResponse.json({ error: 'Aktiver Stopp nicht gefunden' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
