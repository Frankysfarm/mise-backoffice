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

  let body: { batch_id?: string } = {};
  try { body = (await req.json()) as { batch_id?: string }; } catch { /* noop */ }

  const c = sb();
  let query = c
    .from('mise_delivery_batches')
    .select('id, driver_id, state')
    .eq('driver_id', m.driver.id)
    .eq('state', 'pending_acceptance');
  if (typeof body.batch_id === 'string' && body.batch_id.length > 10) {
    query = query.eq('id', body.batch_id);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }
  const { data: batch } = await query.maybeSingle();

  if (!batch) {
    return NextResponse.json(
      { error: 'Keine offene Bestellung zum Annehmen' },
      { status: 404 },
    );
  }

  const { data: accepted, error } = await c.rpc('accept_delivery_batch', {
    p_batch_id: batch.id,
    p_driver_id: m.driver.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!accepted) return NextResponse.json({ error: 'Tour wurde bereits geändert oder neu verteilt' }, { status: 409 });

  return NextResponse.json({ ok: true, batch_id: batch.id });
}
