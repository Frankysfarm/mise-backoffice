import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { internalCronUnauthorized, isInternalCronRequest } from '@/lib/internal-cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isInternalCronRequest(req)) return internalCronUnauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!isInternalCronRequest(req)) return internalCronUnauthorized();
  return run();
}

async function run() {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('expire_module_trials');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
