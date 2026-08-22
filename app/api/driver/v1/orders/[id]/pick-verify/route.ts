import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  verified_item_ids: string[];
  photo_url?: string | null;
}

/**
 * POST /api/driver/v1/orders/:id/pick-verify
 * Body: { verified_item_ids: string[], photo_url?: string }
 *
 * Item-Verification (Spec §9). Bestätigt alle zur Bestellung gehörenden
 * order_items und schreibt zusätzlich das pick_verification jsonb an den
 * Pickup-Stop. Die Vollständigkeit wird serverseitig erzwungen.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  const { id: orderId } = await ctx.params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }
  if (!Array.isArray(body.verified_item_ids)) {
    return badRequest('verified_item_ids muss ein Array sein');
  }

  const c = sb();
  const { data: stopRows, error: stopReadError } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,type,order_id,mise_delivery_batches!inner(driver_id,state)')
    .eq('order_id', orderId)
    .eq('type', 'dropoff')
    .eq('cancelled', false)
    .eq('mise_delivery_batches.driver_id', m.driver.id)
    .in('mise_delivery_batches.state', ['assigned', 'at_restaurant'])
    .limit(1);
  if (stopReadError) return NextResponse.json({ error: 'Tour konnte nicht geprüft werden' }, { status: 500 });
  const stop = stopRows?.[0] ?? null;
  if (!stop) {
    return NextResponse.json({ error: 'Aktive Bestellung nicht gefunden' }, { status: 404 });
  }

  const { data: orderItems, error: itemsReadError } = await c
    .from('order_items')
    .select('id')
    .eq('order_id', orderId);
  if (itemsReadError) {
    console.error('[driver/pick-verify] item read failed', itemsReadError);
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht geladen werden' }, { status: 500 });
  }

  const expectedIds = (orderItems ?? []).map((item) => item.id as string).sort();
  const verifiedIds = Array.from(new Set(body.verified_item_ids)).sort();
  if (
    expectedIds.length === 0 ||
    expectedIds.length !== verifiedIds.length ||
    expectedIds.some((id, index) => id !== verifiedIds[index])
  ) {
    return badRequest('Alle Bestellpositionen müssen vollständig bestätigt werden');
  }

  const verifiedAt = new Date().toISOString();
  const { error: itemsUpdateError } = await c
    .from('order_items')
    .update({
      pick_confirmed_at: verifiedAt,
      pick_missing: false,
      pick_missing_note: null,
    })
    .eq('order_id', orderId)
    .in('id', verifiedIds);
  if (itemsUpdateError) {
    console.error('[driver/pick-verify] item update failed', itemsUpdateError);
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht bestätigt werden' }, { status: 500 });
  }

  const { error: verifyError } = await c
    .from('mise_delivery_batch_stops')
    .update({
      pick_verification: {
        verified_item_ids: body.verified_item_ids,
        photo_url: body.photo_url ?? null,
        verified_at: verifiedAt,
      },
      arrived_at: verifiedAt,
    })
    .eq('id', stop.id);
  if (verifyError) {
    console.error('[driver/pick-verify] stop update failed', verifyError);
    return NextResponse.json({ error: 'Abholprüfung konnte nicht gespeichert werden' }, { status: 500 });
  }

  // Driver state → at_restaurant
  const { error: driverError } = await c
    .from('mise_drivers')
    .update({ state: 'at_restaurant' })
    .eq('id', m.driver.id);
  if (driverError) {
    console.error('[driver/pick-verify] driver update failed', driverError);
    return NextResponse.json({ error: 'Fahrerstatus konnte nicht gespeichert werden' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
