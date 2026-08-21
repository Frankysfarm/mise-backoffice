import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';
import { rerouteBundle } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PickupResult = {
  ok?: boolean;
  code?: 'active_stop_missing' | 'qr_handoff_required' | 'order_not_ready' | 'pick_not_confirmed';
  error?: string;
  batch_id?: string;
  already_picked_up?: boolean;
  should_reroute?: boolean;
};

/**
 * Compatibility pickup endpoint for offer-based tours. Internal-fleet tours
 * commit custody through the complete bag-QR handoff instead.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const member = await getDriverFromBearer(req);
  if (!member) return unauthorized();
  const { id: orderId } = await ctx.params;

  const client = sb();
  const { data, error } = await client.rpc('complete_driver_pickup', {
    p_order_id: orderId,
    p_driver_id: member.driver.id,
  });
  if (error) {
    console.error('[driver/picked-up] atomic transition failed', error);
    return NextResponse.json({ error: 'Abholung konnte nicht gespeichert werden' }, { status: 500 });
  }

  const result = (data ?? {}) as PickupResult;
  if (!result.ok) {
    const status = result.code === 'active_stop_missing' ? 404 : 409;
    return NextResponse.json(
      { error: result.error ?? 'Abholung ist in diesem Zustand nicht möglich', code: result.code },
      { status },
    );
  }

  if (result.should_reroute && result.batch_id) {
    try {
      await rerouteBundle(result.batch_id);
    } catch (routeError) {
      // The custody transition is already committed. Route calculation has a
      // Haversine fallback and can safely be retried independently.
      console.error('[driver/picked-up] reroute failed after committed pickup', routeError);
    }
  }

  return NextResponse.json({
    ok: true,
    batch_id: result.batch_id,
    already_picked_up: Boolean(result.already_picked_up),
  });
}
