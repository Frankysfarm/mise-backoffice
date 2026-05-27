import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver-app/orders/[id]/accept
 * Body: { driverId: string }
 * Driver bestätigt die ihm zugewiesene Order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const driverId = String(body?.driverId ?? '').trim();
  if (!driverId) return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc.from('customer_orders')
    .update({ driver_accepted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('mise_driver_id', driverId)
    .select('id, status, mise_driver_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Order nicht zugewiesen' }, { status: 404 });

  await svc.from('mise_drivers').update({ state: 'assigned' }).eq('id', driverId);
  return NextResponse.json({ ok: true, order: data });
}
