import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Patch {
  vehicle?: 'bike' | 'car';
  max_radius_km?: number;
  frank_mode?: 'auto' | 'confirm' | 'manual';
  name?: string;
  email?: string;
}

const VEHICLE_MAX_RADIUS = { bike: 8, car: 15 } as const;

export async function PATCH(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: Patch;
  try {
    body = (await req.json()) as Patch;
  } catch {
    return badRequest('Ungültiges JSON');
  }

  const update: Record<string, unknown> = {};
  if (body.vehicle && (body.vehicle === 'bike' || body.vehicle === 'car')) {
    update.vehicle = body.vehicle;
  }
  if (typeof body.max_radius_km === 'number') {
    const veh = body.vehicle ?? m.driver.vehicle;
    const max = VEHICLE_MAX_RADIUS[veh];
    if (body.max_radius_km < 1 || body.max_radius_km > max) {
      return badRequest(`max_radius_km muss zwischen 1 und ${max} km für ${veh} liegen`);
    }
    update.max_radius_km = body.max_radius_km;
  }
  if (body.frank_mode && ['auto', 'confirm', 'manual'].includes(body.frank_mode)) {
    update.frank_mode = body.frank_mode;
  }
  if (typeof body.name === 'string' && body.name.trim().length > 1) {
    update.name = body.name.trim();
  }
  if (typeof body.email === 'string') {
    update.email = body.email.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, driver: m.driver });
  }

  const { data, error } = await sb()
    .from('mise_drivers')
    .update(update)
    .eq('id', m.driver.id)
    .select(
      'id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings',
    )
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, driver: data });
}
