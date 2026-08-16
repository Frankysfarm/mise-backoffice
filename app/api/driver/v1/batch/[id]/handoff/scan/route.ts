import { NextRequest, NextResponse } from 'next/server';

import { getDriverFromBearer, sb, unauthorized } from '@/app/api/driver/v1/_lib/driver-auth';
import { buildPickupQr, isPickupFallbackCode, parseAndVerifyPickupQr } from '@/lib/delivery/pickup-qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScanBody = { value?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const member = await getDriverFromBearer(req);
  if (!member) return unauthorized();
  const { id: batchId } = await ctx.params;

  let body: ScanBody = {};
  try { body = await req.json() as ScanBody; } catch { /* handled below */ }
  const raw = body.value?.trim() ?? '';
  if (!raw) return NextResponse.json({ error: 'QR-Code fehlt' }, { status: 400 });

  const client = sb();
  const { data: batch } = await client.from('mise_delivery_batches')
    .select('id,driver_id,state,assignment_mode,handoff_state')
    .eq('id', batchId)
    .eq('driver_id', member.driver.id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Tour gehört nicht zu diesem Fahrer' }, { status: 403 });
  if (batch.assignment_mode !== 'own_fleet') {
    return NextResponse.json({ error: 'Diese Tour verwendet keine QR-Übergabe' }, { status: 409 });
  }

  let decoded = parseAndVerifyPickupQr(raw);
  if (!decoded && isPickupFallbackCode(raw)) {
    const code = raw.toUpperCase();
    const { data: orders, error } = await client.from('customer_orders')
      .select('id,delivery_bag_count')
      .eq('mise_batch_id', batchId)
      .not('status', 'in', '(storniert,geliefert,abgeschlossen)');
    if (error) return NextResponse.json({ error: 'Tour konnte nicht geprüft werden' }, { status: 500 });
    for (const order of orders ?? []) {
      const count = Math.max(1, Math.min(12, Number(order.delivery_bag_count) || 1));
      for (let bagIndex = 1; bagIndex <= count; bagIndex++) {
        const candidate = buildPickupQr(order.id as string, bagIndex);
        if (candidate.fallbackCode === code) {
          decoded = candidate;
          break;
        }
      }
      if (decoded) break;
    }
  }

  if (!decoded) {
    return NextResponse.json(
      { error: 'Dieser Code ist ungültig oder gehört nicht zu Mise Delivery' },
      { status: 400 },
    );
  }

  const { data: result, error } = await client.rpc('scan_delivery_pickup_bag', {
    p_batch_id: batchId,
    p_driver_id: member.driver.id,
    p_order_id: decoded.orderId,
    p_bag_index: decoded.bagIndex,
  });
  if (error) {
    console.error('[driver/handoff/scan] rpc failed', error);
    return NextResponse.json({ error: 'Übergabe konnte nicht gespeichert werden' }, { status: 500 });
  }
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error ?? 'Code gehört nicht zu dieser Tour' }, { status: 409 });
  }

  return NextResponse.json(result);
}
