import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

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

  // Batch-CAS, Order-Freigabe, Fahrer-Exklusion und Alert laufen in einer
  // Datenbanktransaktion. Annahme und Ablehnung können sich nicht mehr überholen.
  const { data: result, error } = await c.rpc('decline_delivery_batch', {
    p_batch_id: batch.id,
    p_driver_id: m.driver.id,
    p_reason: 'driver_declined',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!(result as { ok?: boolean } | null)?.ok) {
    return NextResponse.json({ error: 'Tour wurde bereits angenommen oder neu verteilt' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, batch_id: batch.id, redispatched: false });
}
