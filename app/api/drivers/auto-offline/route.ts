import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  const provided = req.headers.get('x-internal-token');
  if (!expected || expected.length < 16 || provided !== expected) {
    return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return run();
}

async function run() {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('auto_offline_stale_drivers');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, offlined: data ?? 0 });
}
