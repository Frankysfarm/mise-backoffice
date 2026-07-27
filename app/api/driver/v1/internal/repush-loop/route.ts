import { NextRequest, NextResponse } from 'next/server';
import { sb } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/internal/repush-loop
 *
 * Cron-Endpoint, wird jede Minute gerufen.
 *  1. Re-enqueue Push für alle pending_acceptance-Batches die seit > 50s
 *     keinen Push bekommen haben → Driver wird permanent erinnert
 *  2. Auto-Cancel von Batches die seit > 15 Min nicht angenommen wurden
 *
 * Sicher per BISS_INTERNAL_TOKEN.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  let provided: string | null = null;
  try {
    const body = (await req.json()) as { internal_token?: string };
    provided = body.internal_token ?? null;
  } catch {
    /* leerer body ok */
  }
  if (!provided) provided = req.headers.get('x-internal-token');
  if (!expected || expected.length < 16 || provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const c = sb();
  const { data: repush } = await c.rpc('fn_repush_pending_batches');
  const { data: atomicV2 } = await c.from('dispatch_writer_gates')
    .select('tenant_id').eq('writer', 'atomic_v2').eq('enabled', true).limit(1);
  let cancelled = 0;
  if (process.env.DRIVER_V1_AUTO_CANCEL_COMPAT === 'true' && !atomicV2?.length) {
    const result = await c.rpc('fn_auto_cancel_unaccepted_batches');
    if (result.error) return NextResponse.json({ ok: false, reason_code: 'AUTO_CANCEL_FAILED' }, { status: 500 });
    cancelled = Number(result.data ?? 0);
  }

  return NextResponse.json({
    ok: true,
    repushed: Number(repush ?? 0),
    auto_cancelled: Number(cancelled ?? 0),
  });
}
