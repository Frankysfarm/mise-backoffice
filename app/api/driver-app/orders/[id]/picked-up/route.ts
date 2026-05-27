import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver-app/orders/[id]/picked-up
 * Body: { driverId: string }
 * Driver hat Order beim Restaurant abgeholt → status='unterwegs'.
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
    .update({ status: 'unterwegs', abgeholt_am: new Date().toISOString() })
    .eq('id', id)
    .eq('mise_driver_id', driverId)
    .in('status', ['fertig'])
    .select('id, status, mise_driver_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Order nicht abholbereit / nicht zugewiesen' }, { status: 409 });

  await svc.from('mise_drivers').update({ state: 'en_route' }).eq('id', driverId);
  return NextResponse.json({ ok: true, order: data });
}
