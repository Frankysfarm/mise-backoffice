import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';
import { rerouteBundle } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/orders/:id/picked-up
 *
 * Driver verlässt das Restaurant. Setzt:
 *   - pickup-Stop completed_at
 *   - batch.state = 'in_progress'
 *   - batch.picked_up_at = now
 *   - driver.state = 'en_route'
 *   - customer_orders.status = 'picked_up'
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  const { id: orderId } = await ctx.params;

  const c = sb();
  const { data: stop } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,type')
    .eq('order_id', orderId)
    .eq('type', 'pickup')
    .maybeSingle();
  if (!stop) {
    return NextResponse.json({ error: 'Pickup-Stop nicht gefunden' }, { status: 404 });
  }

  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select('id,driver_id')
    .eq('id', stop.batch_id)
    .single();
  if (!batch || batch.driver_id !== m.driver.id) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await c
    .from('mise_delivery_batch_stops')
    .update({ completed_at: now })
    .eq('id', stop.id);

  await c
    .from('mise_delivery_batches')
    .update({ state: 'in_progress', picked_up_at: now })
    .eq('id', batch.id);

  await c.from('mise_drivers').update({ state: 'en_route' }).eq('id', m.driver.id);

  await c
    .from('customer_orders')
    .update({ status: 'unterwegs' })
    .eq('id', orderId);

  // Route ERST berechnen, wenn ALLE Bestellungen der Tour abgeholt sind
  const { data: remainingPickups } = await c
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('type', 'pickup')
    .is('completed_at', null);
  if (!remainingPickups || remainingPickups.length === 0) {
    try { await rerouteBundle(batch.id); } catch { /* Route-Fehler darf Pickup nicht blockieren */ }
  }

  return NextResponse.json({ ok: true });
}
