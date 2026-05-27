import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  type: 'missing_item' | 'closed' | 'cant_find_customer';
  detail: string;
}

/**
 * POST /api/driver/v1/orders/:id/issue
 *
 * Driver meldet ein Problem. Schreibt issue_type/detail an den Stop —
 * Mise-Backoffice kann das im Operator-UI sehen und reagieren.
 *
 * Achtung: bei missing_item bleibt die Order beim Restaurant — Frank/Operator
 * muss eingreifen. Driver bleibt im at_restaurant state.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  const { id: orderId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }
  if (!['missing_item', 'closed', 'cant_find_customer'].includes(body.type)) {
    return badRequest('type muss missing_item|closed|cant_find_customer sein');
  }
  if (!body.detail || body.detail.length < 4) {
    return badRequest('detail nötig (min 4 Zeichen)');
  }

  const c = sb();
  // Welcher Stop ist relevant? Bei missing_item/closed = pickup, bei cant_find_customer = dropoff
  const stopType = body.type === 'cant_find_customer' ? 'dropoff' : 'pickup';
  const { data: stop } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id')
    .eq('order_id', orderId)
    .eq('type', stopType)
    .maybeSingle();
  if (!stop) {
    return NextResponse.json({ error: 'Stop nicht gefunden' }, { status: 404 });
  }

  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select('id,driver_id')
    .eq('id', stop.batch_id)
    .single();
  if (!batch || batch.driver_id !== m.driver.id) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  await c
    .from('mise_delivery_batch_stops')
    .update({ issue_type: body.type, issue_detail: body.detail })
    .eq('id', stop.id);

  // Audit für Frank: Operator sieht das im Backoffice
  await c.from('mise_frank_decisions').insert({
    type: 'cancel',
    driver_id: m.driver.id,
    order_ids: [orderId],
    reason_text: `Driver meldet "${body.type}": ${body.detail}`,
  });

  return NextResponse.json({ ok: true });
}
