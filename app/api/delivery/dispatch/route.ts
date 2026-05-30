/**
 * POST /api/delivery/dispatch
 *
 * Triggert den Smart-Dispatch-Tick manuell oder für eine spezifische Order.
 * Schutz: x-internal-token Header ODER authentifizierter User (für Frontend).
 */
import { NextRequest, NextResponse } from 'next/server';
import { smartDispatchTick, dispatchSingleOrder } from '@/lib/delivery/dispatch-engine';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Interner Cron-Token
  const expected = process.env.BISS_INTERNAL_TOKEN;
  if (expected && expected.length >= 16 && req.headers.get('x-internal-token') === expected) {
    return true;
  }
  // Authentifizierter Admin-User
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return !!user;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { order_id?: string } = {};
  try { body = await req.json(); } catch { /* leer ok */ }

  if (body.order_id) {
    const sb = createServiceClient();
    const { data: o, error } = await sb
      .from('customer_orders')
      .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at, dispatch_attempts, dispatch_escalated_at')
      .eq('id', body.order_id)
      .single();
    if (error || !o) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }
    const radiusFactor = ((o as Record<string, unknown>).dispatch_attempts as number ?? 0) >= 3 ? 1.5 : 1.0;
    const result = await dispatchSingleOrder(o as Parameters<typeof dispatchSingleOrder>[0], radiusFactor);
    return NextResponse.json({ ok: true, result });
  }

  const result = await smartDispatchTick();
  return NextResponse.json({ ok: true, ...result });
}
