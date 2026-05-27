import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  photo_url?: string | null;
  signature?: string | null;
}

/**
 * POST /api/driver/v1/orders/:id/delivered
 *
 * Order ist beim Kunden. Setzt dropoff-Stop completed, prüft ob das
 * der letzte Stop war → Batch.state='completed' → Trigger erhöht Counter.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  const { id: orderId } = await ctx.params;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* leerer body ok */
  }

  const c = sb();
  const { data: stop } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,type')
    .eq('order_id', orderId)
    .eq('type', 'dropoff')
    .maybeSingle();
  if (!stop) {
    return NextResponse.json({ error: 'Dropoff-Stop nicht gefunden' }, { status: 404 });
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
    .update({
      completed_at: now,
      delivery_proof: {
        photo_url: body.photo_url ?? null,
        signature: body.signature ?? null,
        delivered_at: now,
      },
    })
    .eq('id', stop.id);

  await c
    .from('customer_orders')
    .update({ status: 'geliefert' })
    .eq('id', orderId);

  // Sind alle Stops erledigt? → Batch completed
  const { data: openStops } = await c
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batch.id)
    .is('completed_at', null);

  if (!openStops || openStops.length === 0) {
    await c
      .from('mise_delivery_batches')
      .update({ state: 'completed', completed_at: now })
      .eq('id', batch.id);
    // Trigger updated driver counters automatisch
  }

  return NextResponse.json({ ok: true, batch_completed: !openStops || openStops.length === 0 });
}
