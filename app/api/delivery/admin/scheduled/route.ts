/**
 * GET /api/delivery/admin/scheduled?location_id=...&hours=4
 * Vorbestellungen der nächsten N Stunden + Summary.
 *
 * POST /api/delivery/admin/scheduled
 * { action: 'release', order_id, location_id }  — manuelle Freigabe
 * { action: 'release_all', location_id }         — alle fälligen Orders freigeben
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getScheduledQueue,
  getScheduledSummary,
  manuallyReleaseOrder,
  releaseScheduledOrders,
} from '@/lib/delivery/scheduled';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const hours = Math.min(Number(searchParams.get('hours') ?? 4), 24);

  const [queue, summary] = await Promise.all([
    getScheduledQueue(locationId),
    getScheduledSummary(locationId, hours),
  ]);

  return NextResponse.json({
    summary,
    orders: queue,
    count: queue.length,
  });
}

export async function POST(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  let body: { action?: string; order_id?: string; location_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { action, order_id, location_id } = body;
  if (!location_id) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, location_id)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  if (action === 'release' && order_id) {
    const result = await manuallyReleaseOrder(order_id, location_id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ ok: true, order_id, action: 'released' });
  }

  if (action === 'release_all') {
    const result = await releaseScheduledOrders(location_id);
    return NextResponse.json({
      ok: true,
      released: result.released,
      order_ids: result.orders,
    });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
