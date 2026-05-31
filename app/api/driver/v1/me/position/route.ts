import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  lat: number;
  lng: number;
  accuracy_m?: number;
  heading?: number;
  speed_kmh?: number;
  batch_id?: string | null;
}

export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();
  if (!m.driver.active) {
    return NextResponse.json({ ok: false, error: 'inactive' }, { status: 409 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }

  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return badRequest('lat und lng nötig');
  }
  if (Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) {
    return badRequest('Koordinaten außerhalb der Welt');
  }

  const now = new Date().toISOString();

  await sb().from('mise_driver_locations').insert({
    driver_id: m.driver.id,
    lat: body.lat,
    lng: body.lng,
    accuracy_m: body.accuracy_m ?? null,
    heading: body.heading ?? null,
    speed_kmh: body.speed_kmh ?? null,
    batch_id: body.batch_id ?? null,
    recorded_at: now,
  });

  await Promise.all([
    sb().from('mise_drivers')
      .update({ last_lat: body.lat, last_lng: body.lng, last_position_at: now })
      .eq('id', m.driver.id),
    // Sync in driver_status damit Kitchen-Monitor + Dispatch-Board den Fahrer auf der Karte sehen
    m.driver.employee_id
      ? sb().from('driver_status')
          .update({ last_lat: body.lat, last_lng: body.lng, last_update: now })
          .eq('employee_id', m.driver.employee_id)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
