import { NextRequest, NextResponse } from 'next/server';
import { resolveDriverLocationId } from '@/lib/delivery/driver-location';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();

  const client = sb();
  const locationId = await resolveDriverLocationId(client, auth.driver.id);
  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'Standort für die Fahrerschicht ist nicht eindeutig' }, { status: 409 });
  }
  const { data, error } = await client.rpc('resume_driver_dispatch_session', {
    p_driver_id: auth.driver.id,
    p_location_id: locationId,
  });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    const expired = error?.message?.includes('session expired');
    return NextResponse.json(
      { ok: false, code: expired ? 'shift_expired' : 'resume_failed', error: expired ? 'Diese Schicht ist beendet. Starte eine neue Schicht.' : (error?.message ?? 'Schicht konnte nicht fortgesetzt werden') },
      { status: expired ? 409 : 503 },
    );
  }
  return NextResponse.json(data);
}
