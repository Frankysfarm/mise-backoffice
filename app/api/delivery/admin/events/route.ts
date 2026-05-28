/**
 * GET /api/delivery/admin/events?location_id=...&limit=50&event_type=...
 *
 * Delivery Lifecycle Events — Admin-Audit-Trail.
 * Gibt die letzten N Events für eine Location zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents, type DeliveryEventType } from '@/lib/delivery/events';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const events = await getRecentEvents(locationId, limit);

  const filterType = searchParams.get('event_type') as DeliveryEventType | null;
  const filtered = filterType
    ? events.filter((e) => e.event_type === filterType)
    : events;

  return NextResponse.json({ events: filtered, total: filtered.length });
}
