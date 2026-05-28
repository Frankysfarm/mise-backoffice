/**
 * POST /api/delivery/dispatch
 *
 * Triggert den Smart-Dispatch-Tick manuell oder für eine spezifische Order.
 * Schutz: x-internal-token Header.
 */
import { NextRequest, NextResponse } from 'next/server';
import { smartDispatchTick, dispatchSingleOrder } from '@/lib/delivery/dispatch-engine';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function checkToken(req: NextRequest): boolean {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  if (!expected || expected.length < 16) return false;
  return req.headers.get('x-internal-token') === expected;
}

export async function POST(req: NextRequest) {
  if (!checkToken(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { order_id?: string } = {};
  try { body = await req.json(); } catch { /* leer ok */ }

  if (body.order_id) {
    const sb = createServiceClient();
    const { data: o, error } = await sb
      .from('customer_orders')
      .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at')
      .eq('id', body.order_id)
      .single();
    if (error || !o) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }
    const result = await dispatchSingleOrder(o as Parameters<typeof dispatchSingleOrder>[0]);
    return NextResponse.json({ ok: true, result });
  }

  const result = await smartDispatchTick();
  return NextResponse.json({ ok: true, ...result });
}
