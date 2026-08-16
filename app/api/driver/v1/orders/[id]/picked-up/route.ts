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
  // Eine Order kann nach Requeue mehrere Stop-Zeilen haben — es zählt der
  // nicht-stornierte Stop im aktiven Batch DIESES Fahrers (maybeSingle ohne
  // Filter kippte sonst bei jeder requeueten Order in 404).
  // Batch über den DROPOFF-Stop der Order lokalisieren: bei Bundle-Touren hängt
  // der (gemeinsame) Pickup-Stop oft nur an EINER Order — die anderen Orders
  // haben keinen eigenen Pickup-Stop und liefen hier fälschlich in 404.
  const { data: stopRows } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,type,mise_delivery_batches!inner(driver_id,state)')
    .eq('order_id', orderId)
    .eq('type', 'dropoff')
    .eq('cancelled', false)
    .eq('mise_delivery_batches.driver_id', m.driver.id)
    .in('mise_delivery_batches.state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .limit(1);
  const stop = stopRows?.[0] ?? null;
  if (!stop) {
    return NextResponse.json({ error: 'Kein aktiver Stop für diese Bestellung' }, { status: 404 });
  }

  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select('id,driver_id,assignment_mode,handoff_state')
    .eq('id', stop.batch_id)
    .single();
  if (!batch || batch.driver_id !== m.driver.id) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  if (batch.assignment_mode === 'own_fleet') {
    return NextResponse.json(
      { error: 'Interne Touren starten ausschließlich über die vollständige QR-Übergabe', code: 'qr_handoff_required' },
      { status: 409 },
    );
  }

  // Die Datenbank erzwingt die Statusfolge. Vor den Tour-Updates explizit
  // prüfen, damit ein noch nicht fertiger Auftrag keine Teiländerungen erzeugt.
  const { data: order, error: orderReadError } = await c
    .from('customer_orders')
    .select('id,status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderReadError) {
    console.error('[driver/picked-up] order read failed', orderReadError);
    return NextResponse.json({ error: 'Bestellstatus konnte nicht geladen werden' }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }
  if (order.status !== 'fertig') {
    return NextResponse.json(
      { error: 'Bestellung ist noch nicht abholbereit', code: 'order_not_ready' },
      { status: 409 },
    );
  }

  // Domänen-Gate: PICKED_UP setzt physisches Picken voraus. Dauerhafte Evidenz
  // ist order_items.pick_confirmed_at (je Artikel via confirm_pick_item).
  // Ohne diese Evidenz wird der Übergang verweigert — kein Client kann ihn fabrizieren.
  const { data: unpickedItems, error: itemsError } = await c
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .is('pick_confirmed_at', null)
    .limit(1);
  if (itemsError) {
    console.error('[driver/picked-up] pick evidence read failed', itemsError);
    return NextResponse.json({ error: 'Pick-Status konnte nicht geprüft werden' }, { status: 500 });
  }
  if (unpickedItems && unpickedItems.length > 0) {
    return NextResponse.json(
      { error: 'Noch nicht alle Artikel als gepickt bestätigt', code: 'pick_not_confirmed' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  // Offene Pickup-Stops des Batches als erledigt markieren (falls vorhanden —
  // bei Bundle-Touren existiert oft nur ein gemeinsamer Pickup-Stop).
  const { error: stopError } = await c
    .from('mise_delivery_batch_stops')
    .update({ completed_at: now })
    .eq('batch_id', stop.batch_id)
    .eq('type', 'pickup')
    .is('completed_at', null);
  if (stopError) {
    console.error('[driver/picked-up] pickup stop update failed', stopError);
    return NextResponse.json({ error: 'Abholung konnte nicht gespeichert werden' }, { status: 500 });
  }

  const { error: batchError } = await c
    .from('mise_delivery_batches')
    .update({ state: 'in_progress', picked_up_at: now })
    .eq('id', batch.id);
  if (batchError) {
    console.error('[driver/picked-up] batch update failed', batchError);
    return NextResponse.json({ error: 'Tourstatus konnte nicht gespeichert werden' }, { status: 500 });
  }

  const { error: driverError } = await c
    .from('mise_drivers')
    .update({ state: 'en_route' })
    .eq('id', m.driver.id);
  if (driverError) {
    console.error('[driver/picked-up] driver update failed', driverError);
    return NextResponse.json({ error: 'Fahrerstatus konnte nicht gespeichert werden' }, { status: 500 });
  }

  const { error: orderUpdateError } = await c
    .from('customer_orders')
    .update({ status: 'unterwegs' })
    .eq('id', orderId);
  if (orderUpdateError) {
    console.error('[driver/picked-up] order update failed', orderUpdateError);
    return NextResponse.json({ error: 'Bestellstatus konnte nicht gespeichert werden' }, { status: 500 });
  }

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
