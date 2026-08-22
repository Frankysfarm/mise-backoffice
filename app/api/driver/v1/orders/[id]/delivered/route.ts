import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';
import { markPickedUp, promoteNextScheduled } from '@/lib/delivery/kitchen-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  photo_url?: string | null;
  signature?: string | null;
}

type DeliveryResult = {
  ok?: boolean;
  code?: 'active_stop_missing' | 'order_not_picked_up';
  error?: string;
  batch_id?: string;
  batch_completed?: boolean;
  already_delivered?: boolean;
};

/** Atomically completes one owned dropoff and, on the final stop, its tour. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const member = await getDriverFromBearer(req);
  if (!member) return unauthorized();
  const { id: orderId } = await ctx.params;

  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* empty proof is allowed */ }
  if (body.photo_url != null && (typeof body.photo_url !== 'string' || body.photo_url.length > 2_048)) {
    return badRequest('photo_url ist ungültig');
  }
  if (body.signature != null && (typeof body.signature !== 'string' || body.signature.length > 200_000)) {
    return badRequest('signature ist ungültig');
  }

  const client = sb();
  const { data, error } = await client.rpc('complete_driver_delivery', {
    p_order_id: orderId,
    p_driver_id: member.driver.id,
    p_delivery_proof: {
      photo_url: body.photo_url ?? null,
      signature: body.signature ?? null,
    },
  });
  if (error) {
    console.error('[driver/delivered] atomic transition failed', error);
    return NextResponse.json({ error: 'Zustellung konnte nicht gespeichert werden' }, { status: 500 });
  }

  const result = (data ?? {}) as DeliveryResult;
  if (!result.ok) {
    const status = result.code === 'active_stop_missing' ? 404 : 409;
    return NextResponse.json(
      { error: result.error ?? 'Zustellung ist in diesem Zustand nicht möglich', code: result.code },
      { status },
    );
  }
  if (result.already_delivered) return NextResponse.json(result);

  // Non-critical follow-up work runs only after the atomic delivery commit.
  try { await markPickedUp(orderId); } catch { /* queue sync must not undo delivery */ }
  try {
    const { data: activeBatches } = await client
      .from('mise_delivery_batches')
      .select('id')
      .eq('driver_id', member.driver.id)
      .in('state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress']);
    const batchIds = (activeBatches ?? []).map((batch) => batch.id as string);
    let remaining = 0;
    if (batchIds.length > 0) {
      const { data: remainingStops } = await client
        .from('mise_delivery_batch_stops')
        .select('id')
        .in('batch_id', batchIds)
        .eq('type', 'dropoff')
        .eq('cancelled', false)
        .is('completed_at', null);
      remaining = remainingStops?.length ?? 0;
    }
    if (remaining <= 1) {
      const { data: order } = await client.from('customer_orders')
        .select('location_id').eq('id', orderId).maybeSingle();
      if (order?.location_id) await promoteNextScheduled(order.location_id as string);
    }
  } catch { /* kitchen promotion is retriable background work */ }

  return NextResponse.json(result);
}
