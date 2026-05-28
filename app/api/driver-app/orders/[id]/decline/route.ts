import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver-app/orders/[id]/decline
 * Body: { driverId: string, reason?: string }
 * Driver lehnt zugewiesene Order ab → mise_driver_id zurück auf NULL,
 * Frank-Dispatcher kann anderen Driver zuweisen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const driverId = String(body?.driverId ?? '').trim();
  const reason = String(body?.reason ?? '').trim() || null;
  if (!driverId) return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc.from('customer_orders')
    .update({
      mise_driver_id: null,
      driver_decline_reason: reason,
      driver_declined_count: 1, // TODO: increment via RPC
    })
    .eq('id', id)
    .eq('mise_driver_id', driverId)
    .select('id, status, mise_driver_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Decline fehlgeschlagen' }, { status: 404 });

  await svc.from('mise_drivers').update({ state: 'idle' }).eq('id', driverId);

  // Frank-Dispatcher manuell auslösen damit der nächste Driver zugewiesen wird
  try { await svc.rpc('fn_frank_assign_nearest_driver', { p_order_id: id }); } catch { /* ignore dispatch errors */ }

  return NextResponse.json({ ok: true });
}
