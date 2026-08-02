import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json({ ok: false, reason_code: 'LEGACY_ASSIGNMENT_DISABLED' }, { status: 410 });
}
