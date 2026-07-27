import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, unauthorized } from '../../../_lib/driver-auth';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!await getDriverFromBearer(req)) return unauthorized();
  return NextResponse.json({ ok: false, reason_code: 'VERSIONED_DRIVER_V2_REQUIRED', upgrade_path: '/api/driver/v2/items/resolve' }, { status: 409 });
}
