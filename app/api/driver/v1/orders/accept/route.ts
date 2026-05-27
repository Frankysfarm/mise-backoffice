import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/orders/accept
 *
 * Driver bestätigt seine aktuelle pending_acceptance-Tour. Setzt batch.state
 * auf 'assigned' + accepted_at = now. Nach acceptance werden keine
 * Re-Push-Notifications mehr enqueued.
 *
 * Driver kann nur SEINE eigene aktive pending_acceptance-Tour annehmen.
 */
export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  const c = sb();
  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select('id, driver_id, state')
    .eq('driver_id', m.driver.id)
    .eq('state', 'pending_acceptance')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch) {
    return NextResponse.json(
      { error: 'Keine offene Bestellung zum Annehmen' },
      { status: 404 },
    );
  }

  const { error } = await c
    .from('mise_delivery_batches')
    .update({ state: 'assigned', accepted_at: new Date().toISOString() })
    .eq('id', batch.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, batch_id: batch.id });
}
