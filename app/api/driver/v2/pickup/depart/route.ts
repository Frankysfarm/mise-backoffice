import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer } from '@/app/api/driver/v1/_lib/driver-auth';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!await getDriverFromBearer(req)) {
    return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({
    ok: false,
    reason_code: 'LEGACY_SINGLE_ORDER_DEPART_DISABLED_T04',
    required_action: 'POST /api/driver/v2/pickup/atomic with the complete canonical trip manifest',
  }, { status: 409 });
}
