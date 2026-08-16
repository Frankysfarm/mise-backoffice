import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb } from '@/app/api/driver/v1/_lib/driver-auth';
import { getSettings } from '@/lib/delivery/config';
import { resolveDriverLocationId } from '@/lib/delivery/driver-location';
import { hasCurrentDriverSession } from '@/lib/delivery/driver-shift-eligibility';
import { mapBackendDriverState } from '@/lib/delivery/native-gps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const correlationId = randomUUID();
  try {
    const auth = await getDriverFromBearer(req);
    if (!auth) {
      return NextResponse.json(
        { ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId },
        { status: 401 },
      );
    }
    const client = sb();
    const { data: current } = await client.from('mise_drivers')
      .select('state,active,shift_started_at')
      .eq('id', auth.driver.id)
      .maybeSingle();
    const locationId = await resolveDriverLocationId(client, auth.driver.id);
    const settings = locationId ? await getSettings(locationId) : null;
    const activeSession = Boolean(current?.active && settings && hasCurrentDriverSession(
      current.shift_started_at as string | null,
      new Date(),
      settings.driver_shift_cutoff_minute,
      settings.driver_session_max_hours,
    ));
    const state = activeSession ? mapBackendDriverState(current?.state ?? 'offline') : 'offline';
    const policyEnabled = activeSession && state !== 'offline' && state !== 'exception';
    return NextResponse.json({
      ok: true,
      correlation_id: correlationId,
      snapshot: {
        driver: { id: auth.driver.id, state, version: 0, active: activeSession },
        gps_transport: {
          policy_enabled: policyEnabled,
          background_policy_enabled: policyEnabled && settings!.driver_background_gps_enabled >= 1,
        },
      },
    });
  } catch (error) {
    console.error('[driver/v2/snapshot]', correlationId, error);
    return NextResponse.json(
      { ok: false, reason_code: 'SNAPSHOT_FAILED', correlation_id: correlationId },
      { status: 503 },
    );
  }
}
