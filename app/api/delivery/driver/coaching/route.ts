/**
 * GET  /api/delivery/driver/coaching?driver_id=...&location_id=...
 *      → Letzten Coaching-Hinweis für den Fahrer
 *
 * POST /api/delivery/driver/coaching
 *      action=seen  { id } → Als gesehen markieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCoachingForDriver, markCoachingGesehen } from '@/lib/delivery/fahrer-coach';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId   = searchParams.get('driver_id');
    const locationId = searchParams.get('location_id');
    if (!driverId || !locationId) {
      return NextResponse.json({ ok: false, error: 'driver_id and location_id required' }, { status: 400 });
    }

    const hinweis = await getCoachingForDriver(driverId, locationId);
    return NextResponse.json({ ok: true, hinweis });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; id?: string };
    if (body.action === 'seen') {
      if (!body.id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
      await markCoachingGesehen(body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
