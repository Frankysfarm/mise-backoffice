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
import { createClient } from '@/lib/supabase/server';
import { getNotificationLog, getNotificationStats } from '@/lib/delivery/customer-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const locationId = p.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const status = p.get('status') ?? undefined;
  const limit  = Math.min(Number(p.get('limit') ?? '100'), 500);

  const [log, stats] = await Promise.all([
    getNotificationLog(locationId, { limit, status }),
    getNotificationStats(locationId),
  ]);

  return NextResponse.json({ log, stats, count: log.length });
}
