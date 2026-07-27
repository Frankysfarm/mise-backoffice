import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST() {
  return NextResponse.json({
    ok: false, reason_code: 'NORMAL_DECLINE_NOT_ALLOWED',
    exception_path: '/api/driver/v2/exceptions',
  }, { status: 409 });
}
