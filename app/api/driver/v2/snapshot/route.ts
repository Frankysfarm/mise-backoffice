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
    const [{ data: current }, { data: activeBatch }] = await Promise.all([
      client.from('mise_drivers')
        .select('state,active,shift_started_at,dispatch_availability,availability_reason')
        .eq('id', auth.driver.id)
        .maybeSingle(),
      client.from('mise_delivery_batches').select('id')
        .eq('driver_id', auth.driver.id).not('state', 'in', '("completed","cancelled")').limit(1).maybeSingle(),
    ]);
    const locationId = await resolveDriverLocationId(client, auth.driver.id);
    const settings = locationId ? await getSettings(locationId) : null;
    const activeSession = Boolean(current?.active && settings && hasCurrentDriverSession(
      current.shift_started_at as string | null,
      new Date(),
      settings.driver_shift_cutoff_minute,
      settings.driver_session_max_hours,
    ));
    const dutyAllowsGps = current?.dispatch_availability === 'available' || Boolean(activeBatch);
    const state = activeSession && dutyAllowsGps ? mapBackendDriverState(current?.state ?? 'offline') : 'offline';
    const policyEnabled = activeSession && dutyAllowsGps && state !== 'offline' && state !== 'exception';
    return NextResponse.json({
      ok: true,
      correlation_id: correlationId,
      snapshot: {
        driver: {
          id: auth.driver.id,
          state,
          version: 0,
          active: activeSession,
          duty_status: current?.dispatch_availability ?? 'off_duty',
          duty_reason: current?.availability_reason ?? null,
        },
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
