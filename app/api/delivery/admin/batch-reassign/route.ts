import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, reason_code: 'LEGACY_REASSIGN_DISABLED' }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ ok: false, reason_code: 'LEGACY_REASSIGN_DISABLED' }, { status: 410 });
}
