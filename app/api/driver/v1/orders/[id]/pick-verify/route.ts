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
 * Item-Verification (Spec §9). Schreibt das pick_verification jsonb
 * an den entsprechenden pickup-Stop. Prüft NICHT (yet) ob alle Items
 * dabei sind — der Client zeigt CTA nur enabled bei vollem Set.
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
  const { data: stop } = await c
    .from('mise_delivery_batch_stops')
    .select('id,batch_id,type,order_id')
    .eq('order_id', orderId)
    .eq('type', 'pickup')
    .maybeSingle();
  if (!stop) {
    return NextResponse.json({ error: 'Pickup-Stop nicht gefunden' }, { status: 404 });
  }

  // Ownership: der Stop muss zu einem Batch gehören das diesem Driver gehört
  const { data: batch } = await c
    .from('mise_delivery_batches')
    .select('id,driver_id,state')
    .eq('id', stop.batch_id)
    .single();
  if (!batch || batch.driver_id !== m.driver.id) {
    return NextResponse.json({ error: 'Nicht autorisiert für diese Bestellung' }, { status: 403 });
  }

  await c
    .from('mise_delivery_batch_stops')
    .update({
      pick_verification: {
        verified_item_ids: body.verified_item_ids,
        photo_url: body.photo_url ?? null,
        verified_at: new Date().toISOString(),
      },
      arrived_at: new Date().toISOString(),
    })
    .eq('id', stop.id);

  // Driver state → at_restaurant
  await c
    .from('mise_drivers')
    .update({ state: 'at_restaurant' })
    .eq('id', m.driver.id);

  return NextResponse.json({ ok: true });
}
