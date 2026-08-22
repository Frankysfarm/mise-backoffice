import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';
import {
  canTransitionDeliveryOrder,
  isDeliveryOrderStatus,
  type DeliveryOrderStatus,
} from '@/lib/delivery/order-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIMESTAMP_COL: Partial<Record<DeliveryOrderStatus, string>> = {
  'bestätigt': 'bestaetigt_am',
  'in_zubereitung': 'zubereitung_start',
  'fertig': 'fertig_am',
  'unterwegs': 'losgefahren_am',
  'geliefert': 'geliefert_am',
  'abgeholt': 'abgeholt_am',
  'storniert': 'storniert_am',
};

/**
 * PATCH /api/lieferdienst/orders/[id]/status
 * Body: { status: 'neu'|'bestätigt'|'in_zubereitung'|'fertig'|'unterwegs'|'geliefert'|'abgeholt'|'storniert' }
 *
 * Generischer Status-Wechsel. Status='fertig' triggert Frank-Dispatcher.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RX.test(id)) return NextResponse.json({ error: 'Ungültige Bestell-ID' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const requestedLocationId = typeof body?.locationId === 'string' ? body.locationId : null;
  const locationId = actor.location_id ?? requestedLocationId;
  if (!locationId) return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 });
  if (actor.location_id && requestedLocationId && requestedLocationId !== actor.location_id) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }
  const status = String(body?.status ?? '').trim();

  if (!isDeliveryOrderStatus(status)) {
    return NextResponse.json({ error: `Status '${status}' ungültig` }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: current, error: readError } = await svc.from('customer_orders')
    .select('id, status, typ, bestaetigt_am, fertig_am, geliefert_am, mise_driver_id')
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id)
    .eq('location_id', locationId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });

  if (current.status === status) {
    return NextResponse.json({ ok: true, order: current, unchanged: true });
  }
  if (!isDeliveryOrderStatus(current.status as string) || !canTransitionDeliveryOrder(
    current.status as DeliveryOrderStatus,
    status,
    current.typ as string | null,
  )) {
    return NextResponse.json(
      { error: `Statuswechsel ${current.status} → ${status} ist nicht erlaubt` },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { status };
  const tsCol = TIMESTAMP_COL[status];
  if (tsCol) patch[tsCol] = new Date().toISOString();

  const { data, error } = await svc.from('customer_orders')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id)
    .eq('location_id', locationId)
    .eq('status', current.status)
    .select('id, status, bestaetigt_am, fertig_am, geliefert_am, mise_driver_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Bestellstatus wurde zwischenzeitlich geändert' }, { status: 409 });
  return NextResponse.json({ ok: true, order: data });
}
