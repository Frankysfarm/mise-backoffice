/**
 * GET /api/delivery/kitchen/queue?location_id=...
 * Küchen-Queue: alle Bestellungen die jetzt oder bald gekocht werden müssen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getKitchenQueue, syncKitchenNotifications } from '@/lib/delivery/kitchen-sync';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Fällige Benachrichtigungen synchronisieren
  await syncKitchenNotifications();

  const queue = await getKitchenQueue(locationId);

  return NextResponse.json({
    queue: queue.map((t) => ({
      id:            t.id,
      order_id:      t.orderId,
      batch_id:      t.batchId,
      tour_pickup_at: t.tourPickupAt.toISOString(),
      cook_start_at:  t.cookStartAt.toISOString(),
      ready_target:   t.readyTarget.toISOString(),
      prep_min:       t.prepMin,
      status:         t.status,
      notified_at:    t.notifiedAt?.toISOString() ?? null,
      overdue:        t.cookStartAt <= new Date() && t.status === 'scheduled',
    })),
  });
}
