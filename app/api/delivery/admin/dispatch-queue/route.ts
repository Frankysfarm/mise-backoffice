/**
 * GET  /api/delivery/admin/dispatch-queue?location_id=...
 *      → Priority-geordnete Dispatch-Queue + Health-Metriken
 *
 * PATCH /api/delivery/admin/dispatch-queue?location_id=...
 *      body: { order_id: string; boost: number }   (0–50)
 *      → Setzt dispatch_priority_boost für eine Bestellung
 *
 * DELETE /api/delivery/admin/dispatch-queue?location_id=...&order_id=...
 *      → Setzt dispatch_priority_boost einer Bestellung auf 0 zurück
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDispatchQueue,
  getQueueHealth,
  boostOrderPriority,
  resetOrderBoost,
} from '@/lib/delivery/queue-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest, sb: Awaited<ReturnType<typeof createClient>>) {
  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return null;
  // Tenant-Guard: User muss zur Location-Tenant gehören
  const { data } = await sb
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .single();
  return data ? locationId : null;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await getLocationId(req, sb);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });

  try {
    const [queue, health] = await Promise.all([
      getDispatchQueue(locationId),
      getQueueHealth(locationId),
    ]);

    return NextResponse.json({ queue, health });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await getLocationId(req, sb);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });

  let body: { order_id?: string; boost?: number };
  try { body = await req.json(); } catch { body = {}; }

  const { order_id, boost } = body;
  if (!order_id || typeof boost !== 'number') {
    return NextResponse.json({ error: 'order_id und boost (number) erforderlich' }, { status: 400 });
  }

  try {
    await boostOrderPriority(order_id, locationId, boost);
    return NextResponse.json({ ok: true, order_id, boost: Math.max(0, Math.min(50, Math.round(boost))) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await getLocationId(req, sb);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt oder ungültig' }, { status: 400 });

  const orderId = new URL(req.url).searchParams.get('order_id');
  if (!orderId) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });

  try {
    await resetOrderBoost(orderId, locationId);
    return NextResponse.json({ ok: true, order_id: orderId, boost: 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
