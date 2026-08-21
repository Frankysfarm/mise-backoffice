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
  // Der Dropoff ist die eindeutige Order->Batch-Verknüpfung. Bundle-Touren
  // können einen gemeinsamen Pickup haben, aber besitzen pro Order genau einen
  // aktiven Dropoff.
  const { data: stopRows, error: stopReadError } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,mise_delivery_batches!inner(driver_id,state)')
    .eq('order_id', orderId)
    .eq('type', 'dropoff')
    .eq('cancelled', false)
    .eq('mise_delivery_batches.driver_id', m.driver.id)
    .in('mise_delivery_batches.state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .limit(1);
  if (stopReadError) return NextResponse.json({ error: 'Stop konnte nicht geprüft werden' }, { status: 500 });
  const stop = stopRows?.[0] ?? null;
  if (!stop) {
    return NextResponse.json({ error: 'Stop nicht gefunden' }, { status: 404 });
  }

  const { error: updateError } = await c
    .from('mise_delivery_batch_stops')
    .update({ issue_type: body.type, issue_detail: body.detail.slice(0, 500) })
    .eq('id', stop.id);
  if (updateError) return NextResponse.json({ error: 'Problem konnte nicht gespeichert werden' }, { status: 500 });

  // Audit für Frank: Operator sieht das im Backoffice
  await c.from('mise_frank_decisions').insert({
    type: 'cancel',
    driver_id: m.driver.id,
    order_ids: [orderId],
    reason_text: `Driver meldet "${body.type}": ${body.detail.slice(0, 500)}`,
  });

  return NextResponse.json({ ok: true });
}
