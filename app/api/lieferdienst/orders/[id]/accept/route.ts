import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lieferdienst/orders/[id]/accept
 * Body: { etaMinutes?: number }
 *
 * Setzt Bestellung auf 'bestätigt' + speichert ETA.
 * Triggert trg_queue_customer_push → Kunde bekommt Push.
 */
export async function POST(
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
  const etaMinutes = Number(body?.etaMinutes) || null;

  const svc = createServiceClient();
  const patch: Record<string, unknown> = {
    status: 'bestätigt',
    bestaetigt_am: new Date().toISOString(),
  };
  if (etaMinutes != null && etaMinutes > 0) {
    patch.geschaetzte_zubereitung_min = etaMinutes;
  }

  const { data: current, error: readError } = await svc.from('customer_orders')
    .select('id, status, bestaetigt_am, geschaetzte_zubereitung_min')
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id)
    .eq('location_id', locationId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  if (current.status === 'bestätigt') {
    return NextResponse.json({ ok: true, order: current, unchanged: true });
  }
  if (current.status !== 'neu') {
    return NextResponse.json(
      { error: `Bestellung mit Status ${current.status} kann nicht angenommen werden` },
      { status: 409 },
    );
  }

  const { data, error } = await svc.from('customer_orders')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id)
    .eq('location_id', locationId)
    .eq('status', 'neu')
    .select('id, status, bestaetigt_am, geschaetzte_zubereitung_min')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Bestellstatus wurde zwischenzeitlich geändert' }, { status: 409 });
  return NextResponse.json({ ok: true, order: data });
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
