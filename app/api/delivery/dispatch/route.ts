/**
 * POST /api/delivery/dispatch
 *
 * Triggert den Smart-Dispatch-Tick manuell oder für eine spezifische Order.
 * Schutz: x-internal-token Header ODER aktiver Delivery-Admin. Interaktive
 * Aufrufe bleiben immer auf den Standort des eingeloggten Mitarbeiters begrenzt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { smartDispatchTick, dispatchSingleOrder } from '@/lib/delivery/dispatch-engine';
import { createServiceClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';
import type { CurrentEmployee } from '@/lib/auth/getCurrentEmployee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Authorization =
  | { kind: 'internal'; actor: null }
  | { kind: 'admin'; actor: CurrentEmployee }
  | { kind: 'forbidden'; actor: null };

async function authorize(req: NextRequest): Promise<Authorization> {
  // Interner Cron-Token
  const expected = process.env.BISS_INTERNAL_TOKEN;
  if (expected && expected.length >= 16 && req.headers.get('x-internal-token') === expected) {
    return { kind: 'internal', actor: null };
  }
  const actor = await getDeliveryAdminActor();
  return actor ? { kind: 'admin', actor } : { kind: 'forbidden', actor: null };
}

export async function POST(req: NextRequest) {
  const authorization = await authorize(req);
  if (authorization.kind === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { order_id?: string; location_id?: string } = {};
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
    if (
      authorization.kind === 'admin' &&
      (!o.location_id || !await isDeliveryAdminLocation(authorization.actor, o.location_id))
    ) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }
    const radiusFactor = ((o as Record<string, unknown>).dispatch_attempts as number ?? 0) >= 3 ? 1.5 : 1.0;
    const result = await dispatchSingleOrder(o as Parameters<typeof dispatchSingleOrder>[0], radiusFactor);
    return NextResponse.json({ ok: true, result });
  }

  if (authorization.kind === 'admin') {
    const locationId = body.location_id ?? authorization.actor.location_id;
    if (!locationId) {
      return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 409 });
    }
    if (!await isDeliveryAdminLocation(authorization.actor, locationId)) {
      return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 });
    }
    const result = await smartDispatchTick({ locationId, runGlobalMaintenance: false });
    return NextResponse.json({ ok: true, ...result });
  }

  const result = await smartDispatchTick({ runGlobalMaintenance: true });
  return NextResponse.json({ ok: true, ...result });
}
