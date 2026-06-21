/**
 * GET  /api/delivery/admin/connectivity?location_id=…
 *       → ConnectivityDashboard (all driver statuses + recent events)
 *
 * GET  /api/delivery/admin/connectivity?location_id=…&driver_id=…&hours=4
 *       → raw heartbeat history for one driver
 *
 * POST /api/delivery/admin/connectivity
 *       action=detect   — manually trigger disconnect detection
 *       action=prune    — prune old heartbeats (days_old optional)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getConnectivityDashboard,
  getDriverHeartbeatHistory,
  detectLostConnections,
  pruneOldHeartbeats,
  pruneOldConnectivityEvents,
} from '@/lib/delivery/driver-heartbeat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  const hours      = Number(searchParams.get('hours') ?? '4');

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (driverId) {
    const history = await getDriverHeartbeatHistory(driverId, Math.min(hours, 24));
    return NextResponse.json({ ok: true, driverId, hours, history });
  }

  const dashboard = await getConnectivityDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const action     = typeof body.action      === 'string' ? body.action      : '';
  const locationId = typeof body.location_id === 'string' ? body.location_id : null;
  const daysOld    = typeof body.days_old    === 'number' ? body.days_old    : undefined;

  if (action === 'detect') {
    if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
    const result = await detectLostConnections(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const [hb, ev] = await Promise.all([
      pruneOldHeartbeats(daysOld ?? 3),
      pruneOldConnectivityEvents(daysOld ?? 30),
    ]);
    return NextResponse.json({ ok: true, heartbeats_pruned: hb, events_pruned: ev });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
