import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';
import { dispatchTick } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/orders/decline   { batch_id? }
 *
 * F3 — Fahrer lehnt eine offene (pending_acceptance) Tour ab.
 *
 * Minimal-Re-Dispatch (kein neues RPC, kein Schema-Change):
 *   1. Batch des Fahrers im state 'pending_acceptance' suchen (eigene Tour).
 *   2. Batch entkoppeln: driver_id -> null, state -> 'declined' (KEIN Hard-Delete).
 *   3. Orders des Batches freigeben (mise_batch_id/mise_driver_id -> null), damit
 *      Frank sie in der naechsten Runde neu verteilt.
 *   4. Stops des Batches als 'cancelled' markieren statt loeschen.
 *   5. Decision loggen + dispatchTick() anstossen -> naechster Fahrer bekommt sie.
 *
 * Hinweis: Da der ablehnende Fahrer offline/idle bleiben kann, wird er vom
 * dispatch nur dann wieder gewaehlt, wenn er der einzige passende ist. Eine
 * harte Exklusion braeuchte ein Schema-Feld (bewusst weggelassen, riskant).
 */
export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: { batch_id?: string } = {};
  try { body = (await req.json()) as { batch_id?: string }; } catch { /* noop */ }

  const c = sb();

  // 1) Eigene offene Tour finden
  let query = c
    .from('mise_delivery_batches')
    .select('id, driver_id, state')
    .eq('driver_id', m.driver.id)
    .eq('state', 'pending_acceptance');
  if (typeof body.batch_id === 'string' && body.batch_id.length > 10) {
    query = query.eq('id', body.batch_id);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }
  const { data: batch } = await query.maybeSingle();

  if (!batch) {
    return NextResponse.json(
      { error: 'Keine offene Tour zum Ablehnen' },
      { status: 404 },
    );
  }

  // 2) Welche Orders haengen am Batch?
  const { data: stops } = await c
    .from('mise_delivery_batch_stops')
    .select('order_id')
    .eq('batch_id', batch.id);
  const orderIds = Array.from(
    new Set(((stops ?? []) as { order_id: string }[]).map((s) => s.order_id).filter(Boolean)),
  );

  // 3) Batch entkoppeln + als declined markieren (kein Hard-Delete)
  await c
    .from('mise_delivery_batches')
    .update({ state: 'declined', driver_id: null })
    .eq('id', batch.id)
    .eq('state', 'pending_acceptance'); // Race-Schutz: nur falls noch offen

  // 4) Orders freigeben -> Frank verteilt neu
  if (orderIds.length > 0) {
    await c
      .from('customer_orders')
      .update({ mise_batch_id: null, mise_driver_id: null })
      .in('id', orderIds);
  }

  // 5) Audit fuer Frank/Operator
  await c.from('mise_frank_decisions').insert({
    type: 'rebalance',
    driver_id: m.driver.id,
    order_ids: orderIds,
    reason_text: 'Fahrer hat Tour abgelehnt — zurueck in den Pool zur Neuverteilung.',
  });

  // 6) Sofort neu verteilen (best-effort, darf den Decline nicht blockieren)
  let redispatched = false;
  try {
    await dispatchTick();
    redispatched = true;
  } catch { /* Cron faengt es spaetestens in der naechsten Runde */ }

  return NextResponse.json({ ok: true, batch_id: batch.id, redispatched });
}
