/**
 * GET /api/delivery/orders/[orderId]
 *
 * Liefert Bestellstatus + ETA + Fahrer-Info für DynamischeEtaBand (Phase 405/410).
 * Öffentlicher Endpunkt — kein Auth erforderlich.
 *
 * Response:
 *   status, eta_earliest, eta_latest, batch_state,
 *   driver_name, driver_phone (nur wenn status = unterwegs),
 *   stops_before (Stops vor diesem in der Tour)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ orderId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const sb = createServiceClient();

  const { data: order } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, status, typ, eta_earliest, eta_latest, mise_batch_id, mise_driver_id, location_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  }

  let driverName: string | null = null;
  let driverPhone: string | null = null;
  let batchState: string | null = null;
  let stopsBefore = 0;

  if (order.mise_batch_id) {
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('state')
      .eq('id', order.mise_batch_id as string)
      .maybeSingle();
    batchState = (batch?.state as string | null) ?? null;

    const { data: stops } = await sb
      .from('mise_delivery_batch_stops')
      .select('id, completed_at, order_id, sequence_order')
      .eq('batch_id', order.mise_batch_id as string)
      .order('sequence_order', { ascending: true });

    if (stops) {
      const thisStop = stops.find((s) => s.order_id === order.id);
      if (thisStop) {
        stopsBefore = stops.filter(
          (s) =>
            s.sequence_order < thisStop.sequence_order &&
            s.completed_at === null,
        ).length;
      }
    }
  }

  if (order.mise_driver_id && order.status === 'unterwegs') {
    const { data: driver } = await sb
      .from('mise_drivers')
      .select('employee_id')
      .eq('id', order.mise_driver_id as string)
      .maybeSingle();

    if (driver?.employee_id) {
      const { data: emp } = await sb
        .from('employees')
        .select('vorname, telefon')
        .eq('id', driver.employee_id as string)
        .maybeSingle();

      if (emp) {
        driverName  = (emp.vorname as string | null) ?? null;
        driverPhone = (emp.telefon as string | null) ?? null;
      }
    }
  }

  return NextResponse.json({
    order_id:     order.id,
    bestellnummer: order.bestellnummer,
    status:       order.status,
    typ:          order.typ,
    eta_earliest: order.eta_earliest,
    eta_latest:   order.eta_latest,
    batch_state:  batchState,
    stops_before: stopsBefore,
    driver_name:  driverName,
    driver_phone: driverPhone,
  });
}
