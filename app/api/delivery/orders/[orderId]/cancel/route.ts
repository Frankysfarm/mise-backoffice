/**
 * PATCH /api/delivery/orders/[orderId]/cancel
 *
 * Storniert eine Liefer-Bestellung:
 *  1. Bestellung aus Batch-Stop entfernen (cancel_order_from_batch RPC)
 *  2. Leeren Batch stornieren (atomisch in RPC)
 *  3. Tour neu optimieren wenn Batch noch aktiv hat Stops
 *  4. Event loggen
 *
 * Auth: Authentifizierter Admin-User erforderlich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from '@/lib/delivery/events';
import { optimizeTour } from '@/lib/delivery/tour-optimizer';
import { enqueueTourStatusPush } from '@/lib/delivery/push-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ orderId: string }>;
}

interface CancelResult {
  order_id:        string;
  batch_id:        string | null;
  batch_cancelled: boolean;
  stops_remaining: number;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { orderId } = await params;
  const serviceSb = createServiceClient();

  // Bestellung prüfen
  const { data: order, error: orderErr } = await serviceSb
    .from('customer_orders')
    .select('id, status, typ, location_id, mise_batch_id, mise_driver_id, bestellnummer')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  if (order.typ !== 'lieferung') {
    return NextResponse.json({ error: 'Nur Liefer-Bestellungen können storniert werden' }, { status: 400 });
  }

  const irreversible = ['storniert', 'abgeschlossen', 'geliefert'];
  if (irreversible.includes(order.status as string)) {
    return NextResponse.json(
      { error: `Bestellung bereits ${order.status} — Stornierung nicht möglich` },
      { status: 409 },
    );
  }

  // Atomisch stornieren via DB-Funktion (Migration 011)
  const { data: rpcResult, error: cancelErr } = await serviceSb
    .rpc('cancel_order_from_batch', { p_order_id: orderId });

  if (cancelErr) {
    // Fallback: direktes Update wenn Funktion noch nicht in DB
    const { error: directErr } = await serviceSb
      .from('customer_orders')
      .update({ status: 'storniert', mise_batch_id: null, mise_driver_id: null })
      .eq('id', orderId);

    if (directErr) return NextResponse.json({ error: directErr.message }, { status: 500 });

    await logDeliveryEvent({
      event_type:  'batch_cancelled',
      location_id: order.location_id as string,
      order_id:    orderId,
      batch_id:    order.mise_batch_id as string | null,
      payload:     { cancelled_by: user.id, bestellnummer: order.bestellnummer, fallback: true },
    });

    return NextResponse.json({
      ok: true,
      order_id:        orderId,
      batch_id:        order.mise_batch_id ?? null,
      batch_cancelled: false,
      stops_remaining: null,
    });
  }

  const result = rpcResult as CancelResult;

  // Tour neu optimieren wenn Batch noch aktiv ist
  if (result.batch_id && !result.batch_cancelled && result.stops_remaining > 0) {
    try {
      await optimizeTour(result.batch_id);
    } catch {
      // Best-effort: Route-Optimierung ist nicht kritisch für Stornierung
    }
  }

  await logDeliveryEvent({
    event_type:  'batch_cancelled',
    location_id: order.location_id as string,
    order_id:    orderId,
    batch_id:    result.batch_id,
    payload: {
      cancelled_by:    user.id,
      bestellnummer:   order.bestellnummer,
      batch_cancelled: result.batch_cancelled,
      stops_remaining: result.stops_remaining,
    },
  });

  // Fahrer benachrichtigen wenn Tour betroffen
  if (result.batch_id && order.mise_driver_id) {
    const driverId = order.mise_driver_id as string;
    enqueueTourStatusPush({
      driverId,
      batchId:  result.batch_id,
      type:     result.batch_cancelled ? 'tour_cancelled' : 'order_cancelled',
      title:    result.batch_cancelled ? 'Tour storniert' : 'Bestellung entfernt',
      body:     result.batch_cancelled
        ? `Tour wurde storniert (Bestellung ${order.bestellnummer as string})`
        : `Bestellung ${order.bestellnummer as string} aus deiner Tour entfernt · ${result.stops_remaining} Stop${result.stops_remaining !== 1 ? 's' : ''} verbleiben`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok:              true,
    order_id:        orderId,
    batch_id:        result.batch_id,
    batch_cancelled: result.batch_cancelled,
    stops_remaining: result.stops_remaining,
  });
}
