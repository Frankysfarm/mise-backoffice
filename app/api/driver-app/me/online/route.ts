import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver-app/me/online
 * Body: { driverId: string, online: boolean, lat?: number, lng?: number }
 *
 * Schaltet Driver Online/Offline. Setzt mise_drivers.state + active.
 * DEV-Modus: Auth via driverId-Param (später JWT).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const driverId = String(body?.driverId ?? '').trim();
  const online = !!body?.online;
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lng = typeof body?.lng === 'number' ? body.lng : null;

  if (!driverId) {
    return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });
  }

  const svc = createServiceClient();
  // mise_drivers.state-CHECK: offline | idle | assigned | at_restaurant | en_route | returning
  const patch: Record<string, unknown> = {
    state: online ? 'idle' : 'offline',
    active: true,
  };
  if (lat !== null && lng !== null) {
    patch.last_lat = lat;
    patch.last_lng = lng;
    patch.last_position_at = new Date().toISOString();
  }

  const { data, error } = await svc.from('mise_drivers')
    .update(patch)
    .eq('id', driverId)
    .select('id, name, state, active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, driver: data });
}
