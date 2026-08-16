import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb } from '@/app/api/driver/v1/_lib/driver-auth';
import { getSettings } from '@/lib/delivery/config';
import { resolveDriverLocationId } from '@/lib/delivery/driver-location';
import { hasCurrentDriverSession } from '@/lib/delivery/driver-shift-eligibility';
import { mapBackendDriverState, validateNativeGpsEnvelope } from '@/lib/delivery/native-gps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const correlationId = randomUUID();
  const auth = await getDriverFromBearer(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId },
      { status: 401 },
    );
  }

  try {
    const envelope = validateNativeGpsEnvelope(await req.json());
    const event = envelope.payload;
    const client = sb();
    const [{ data: current }, locationId] = await Promise.all([
      client.from('mise_drivers').select('state,active,shift_started_at').eq('id', auth.driver.id).maybeSingle(),
      resolveDriverLocationId(client, auth.driver.id),
    ]);
    if (!locationId) {
      return NextResponse.json(
        { ok: false, reason_code: 'DRIVER_LOCATION_UNRESOLVED', correlation_id: correlationId },
        { status: 409 },
      );
    }
    const settings = await getSettings(locationId);
    const sessionCurrent = Boolean(current?.active && hasCurrentDriverSession(
      current.shift_started_at as string | null,
      new Date(),
      settings.driver_shift_cutoff_minute,
      settings.driver_session_max_hours,
    ));
    const currentState = sessionCurrent ? mapBackendDriverState(current?.state ?? 'offline') : 'offline';
    if (!sessionCurrent || (event.app_state !== 'foreground' && settings.driver_background_gps_enabled < 1)) {
      return NextResponse.json(
        { ok: false, reason_code: 'GPS_POLICY_DISABLED', correlation_id: correlationId },
        { status: 409 },
      );
    }
    if (envelope.expected_versions.driver !== 0 || envelope.expected_state !== currentState) {
      return NextResponse.json(
        { ok: false, reason_code: 'STALE_DRIVER_AUTHORITY', correlation_id: correlationId },
        { status: 409 },
      );
    }
    const { data, error } = await client.rpc('ingest_native_driver_gps', {
      p_driver_id: auth.driver.id,
      p_location_id: locationId,
      p_action_id: envelope.action_id,
      p_installation_id: event.installation_id,
      p_session_id: event.session_id,
      p_sequence: event.sequence,
      p_captured_at: event.captured_at,
      p_latitude: event.latitude,
      p_longitude: event.longitude,
      p_accuracy_m: event.accuracy_m,
      p_speed_mps: event.speed_mps ?? null,
      p_heading_deg: event.heading_deg ?? null,
      p_metadata: {
        app_version: event.app_version,
        app_build: event.app_build ?? null,
        platform: event.platform,
        app_state: event.app_state,
        permission_state: event.permission_state,
        network_state: event.network_state,
        tracking_mode: event.tracking_mode,
        altitude_m: event.altitude_m ?? null,
        battery_state: event.battery_state ?? null,
        capability_flags: event.capability_flags ?? null,
      },
    });
    if (error) {
      console.error('[driver/v2/gps/events]', correlationId, error.message);
      return NextResponse.json(
        { ok: false, reason_code: 'GPS_INGEST_UNAVAILABLE', correlation_id: correlationId },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, correlation_id: correlationId, ...(data as object) });
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith('INVALID_')
      ? error.message
      : 'INVALID_GPS_REQUEST';
    return NextResponse.json(
      { ok: false, reason_code: reason, correlation_id: correlationId },
      { status: 400 },
    );
  }
}
