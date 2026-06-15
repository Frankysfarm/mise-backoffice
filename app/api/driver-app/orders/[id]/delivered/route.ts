import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { recordDelivery } from '@/lib/delivery/driver-streaks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver-app/orders/[id]/delivered
 * Body: { driverId: string }
 * Driver hat erfolgreich zugestellt → status='geliefert'. Driver wird wieder verfügbar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const driverId = String(body?.driverId ?? '').trim();
  if (!driverId) return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });

  const deliveredAt = new Date().toISOString();
  const svc = createServiceClient();
  const { data, error } = await svc.from('customer_orders')
    .update({ status: 'geliefert', geliefert_am: deliveredAt })
    .eq('id', id)
    .eq('mise_driver_id', driverId)
    .in('status', ['unterwegs'])
    .select('id, status, mise_driver_id, location_id, eta_latest')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Order nicht unterwegs' }, { status: 409 });

  // Driver wieder verfügbar — prüfe ob er noch andere Orders hat
  const { count: openOrdersCount } = await svc.from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('mise_driver_id', driverId)
    .in('status', ['unterwegs']);

  if ((openOrdersCount ?? 0) === 0) {
    await svc.from('mise_drivers').update({ state: 'returning' }).eq('id', driverId);
  }

  // Phase 194: Streak-Tracking — pünktliche Lieferung = geliefert_am ≤ eta_latest
  if (data.location_id) {
    const wasOnTime = data.eta_latest
      ? deliveredAt <= (data.eta_latest as string)
      : true;
    recordDelivery(data.location_id as string, driverId, id, wasOnTime).catch(() => {});
  }

  return NextResponse.json({ ok: true, order: data });
}
