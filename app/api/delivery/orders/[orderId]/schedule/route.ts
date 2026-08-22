/**
 * PATCH /api/delivery/orders/[orderId]/schedule
 * Setzt oder ändert den Vorab-Lieferzeitpunkt einer Bestellung.
 *
 * Body: { scheduled_at: ISO8601, location_id: string }
 *
 * DELETE /api/delivery/orders/[orderId]/schedule
 * Hebt die Vorbestellung auf → sofortiger Dispatch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scheduleOrder, unscheduleOrder } from '@/lib/delivery/scheduled';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { scheduled_at?: string; location_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { scheduled_at, location_id } = body;
  if (!scheduled_at || !location_id) {
    return NextResponse.json({ error: 'scheduled_at und location_id erforderlich' }, { status: 400 });
  }

  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum in scheduled_at' }, { status: 400 });
  }

  const result = await scheduleOrder(params.orderId, scheduledDate, location_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    order_id: params.orderId,
    scheduled_at: scheduledDate.toISOString(),
    schedule_status: 'scheduled',
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  const result = await unscheduleOrder(params.orderId, locationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, order_id: params.orderId, schedule_status: null });
}
