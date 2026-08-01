import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Removed legacy service-role writer. Driver identity and expected versions are
 * mandatory on the authenticated v2 session endpoints.
 */
export async function POST() {
  return NextResponse.json({
    ok: false,
    reason_code: 'LEGACY_DRIVER_STATUS_WRITER_DISABLED',
    start: '/api/driver/v2/session/start',
    end: '/api/driver/v2/session/end',
  }, { status: 410 });
}
