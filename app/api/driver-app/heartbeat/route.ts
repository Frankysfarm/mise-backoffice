/**
 * POST /api/driver-app/heartbeat
 *
 * Driver app pings this endpoint every 60 s while the app is active.
 * Records a heartbeat and resolves any open disconnect alert.
 *
 * Body: { driver_id, location_id, battery_pct?, lat?, lng?, signal_quality?, app_version? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { recordHeartbeat } from '@/lib/delivery/driver-heartbeat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const driverId   = typeof body.driver_id   === 'string' ? body.driver_id   : null;
  const locationId = typeof body.location_id === 'string' ? body.location_id : null;

  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driver_id und location_id erforderlich' }, { status: 400 });
  }

  const batteryPct    = typeof body.battery_pct    === 'number' ? body.battery_pct    : null;
  const lat           = typeof body.lat            === 'number' ? body.lat            : null;
  const lng           = typeof body.lng            === 'number' ? body.lng            : null;
  const signalQuality = typeof body.signal_quality === 'number' ? body.signal_quality : null;
  const appVersion    = typeof body.app_version    === 'string' ? body.app_version    : null;

  await recordHeartbeat({ driverId, locationId, batteryPct, lat, lng, signalQuality, appVersion });

  return NextResponse.json({ ok: true, recorded_at: new Date().toISOString() });
}
