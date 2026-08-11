import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';
import { markPickedUp, promoteNextScheduled } from '@/lib/delivery/kitchen-sync';

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

  const { data: paidOrd, error: orderReadError } = await c
    .from('customer_orders')
    .select('status,bezahlt,zahlungsart')
    .eq('id', orderId)
    .maybeSingle();
  if (orderReadError) {
    console.error('[driver/delivered] order read failed', orderReadError);
    return NextResponse.json({ error: 'Bestellstatus konnte nicht geladen werden' }, { status: 500 });
  }
  if (!paidOrd) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }
  if (paidOrd.status !== 'unterwegs') {
    return NextResponse.json(
      { error: 'Bestellung wurde noch nicht abgeholt', code: 'order_not_picked_up' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { error: stopError } = await c
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
  if (stopError) {
    console.error('[driver/delivered] stop update failed', stopError);
    return NextResponse.json({ error: 'Zustellung konnte nicht gespeichert werden' }, { status: 500 });
  }

  const ordUpdate: Record<string, unknown> = { status: 'geliefert' };
  if (!paidOrd.bezahlt && (paidOrd.zahlungsart === 'bar' || paidOrd.zahlungsart == null)) {
    ordUpdate.bezahlt = true;
    ordUpdate.zahlungsart = 'bar';
    ordUpdate.stripe_payment_id = `cash:driver:${m.driver.id}:${now}`;
  }
  const { error: orderUpdateError } = await c
    .from('customer_orders')
    .update(ordUpdate)
    .eq('id', orderId);
  if (orderUpdateError) {
    console.error('[driver/delivered] order update failed', orderUpdateError);
    return NextResponse.json({ error: 'Bestellstatus konnte nicht gespeichert werden' }, { status: 500 });
  }

  // Sind alle Stops erledigt? → Batch completed
  const { data: openStops, error: openStopsError } = await c
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batch.id)
    .is('completed_at', null);
  if (openStopsError) {
    console.error('[driver/delivered] open stops read failed', openStopsError);
    return NextResponse.json({ error: 'Tourabschluss konnte nicht geprüft werden' }, { status: 500 });
  }

  if (!openStops || openStops.length === 0) {
    const [batchUpdate, statusUpdate] = await Promise.all([
      c.from('mise_delivery_batches')
        .update({ state: 'completed', completed_at: now })
        .eq('id', batch.id),
      c.from('driver_status')
        .update({ aktueller_batch_id: null })
        .eq('aktueller_batch_id', batch.id),
    ]);
    if (batchUpdate.error || statusUpdate.error) {
      console.error('[driver/delivered] completion update failed', {
        batch: batchUpdate.error,
        driverStatus: statusUpdate.error,
      });
      return NextResponse.json({ error: 'Tourabschluss konnte nicht gespeichert werden' }, { status: 500 });
    }
  }

  // JIT-Koch-Gate: diese Order ist erledigt -> aus der Koch-Warteschlange nehmen
  try { await markPickedUp(orderId); } catch { /* noop */ }
  // Meilenstein: Fahrer fast fertig (<=1 offener Stopp) -> naechste WARTENDE Order kochen lassen (Fahrer auf Rueckweg)
  try {
    const { data: ab } = await c
      .from('mise_delivery_batches').select('id')
      .eq('driver_id', batch.driver_id)
      .in('state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress']);
    const ids = (ab ?? []).map((b) => b.id as string);
    let remaining = 0;
    if (ids.length) {
      const { data: rs } = await c
        .from('mise_delivery_batch_stops').select('id')
        .in('batch_id', ids).eq('type', 'dropoff').is('completed_at', null);
      remaining = rs?.length ?? 0;
    }
    if (remaining <= 1) {
      const { data: ord } = await c.from('customer_orders').select('location_id').eq('id', orderId).single();
      if (ord?.location_id) await promoteNextScheduled(ord.location_id as string);
    }
  } catch { /* noop */ }

  return NextResponse.json({ ok: true, batch_completed: !openStops || openStops.length === 0 });
}
