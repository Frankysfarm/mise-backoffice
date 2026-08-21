/**
 * GET /api/delivery/admin/events?location_id=...&limit=50&event_type=...
 *
 * Delivery Lifecycle Events — Admin-Audit-Trail.
 * Gibt die letzten N Events für eine Location zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents, type DeliveryEventType } from '@/lib/delivery/events';
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

  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const events = await getRecentEvents(locationId, limit);

  const filterType = searchParams.get('event_type') as DeliveryEventType | null;
  const filtered = filterType
    ? events.filter((e) => e.event_type === filterType)
    : events;

  return NextResponse.json({ events: filtered, total: filtered.length });
}
