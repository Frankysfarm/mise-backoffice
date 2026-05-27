import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() { return run(); }
export async function POST() { return run(); }

async function run() {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('expire_module_trials');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
