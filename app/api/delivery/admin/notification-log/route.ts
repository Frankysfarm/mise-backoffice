/**
 * GET /api/delivery/admin/notification-log
 *
 * Admin: Gesendete Kunden-Benachrichtigungen abrufen.
 * Query-Params:
 *   location_id (required)
 *   status      (optional: pending|sent|failed|skipped)
 *   limit       (optional, default 100, max 500)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getNotificationLog, getNotificationStats } from '@/lib/delivery/customer-push';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const p = req.nextUrl.searchParams;
  const locationId = p.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Location not authorized' }, { status: 403 });
  }

  const status = p.get('status') ?? undefined;
  const limit  = Math.min(Number(p.get('limit') ?? '100'), 500);

  const [log, stats] = await Promise.all([
    getNotificationLog(locationId, { limit, status }),
    getNotificationStats(locationId),
  ]);

  return NextResponse.json({ log, stats, count: log.length });
}
