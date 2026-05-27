import { NextRequest, NextResponse } from 'next/server';
import { sb } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer (.+)$/i.exec(auth);
  if (m) {
    await sb()
      .from('mise_driver_sessions')
      .delete()
      .eq('token', m[1].trim());
  }
  return NextResponse.json({ ok: true });
}
