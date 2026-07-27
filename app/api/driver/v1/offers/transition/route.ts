import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';
import { acceptAsTechnicalAck } from '../../_lib/accept-as-ack';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.action === 'accept') return acceptAsTechnicalAck(sb(), auth.driver.id, body);
  if (body.action === 'decline') return NextResponse.json({
    ok: false, reason_code: 'NORMAL_DECLINE_NOT_ALLOWED',
    exception_choices: ['medical_safety_emergency','vehicle_failure','accident_road_closure',
      'location_permission_gps_failure','network_device_failure','shift_invalid'],
  }, { status: 409 });
  return NextResponse.json({ ok: false, reason_code: 'VERSIONED_DRIVER_V2_REQUIRED' }, { status: 409 });
}
