import { NextRequest, NextResponse } from 'next/server';
import { executeAtomicDriverTransition } from '@/lib/delivery/atomic-lifecycle';
import type { AtomicOfferAction } from '@/lib/delivery/atomic-offer';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set<AtomicOfferAction>([
  'accept', 'decline', 'picked_up', 'in_progress', 'complete', 'cancel',
]);

export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => null) as
    | { action?: AtomicOfferAction; offer_id?: unknown; assignment_version?: unknown; transition_key?: unknown }
    | null;
  if (!body?.action || !ALLOWED.has(body.action)) {
    return NextResponse.json(
      { ok: false, reason_code: 'INVALID_ACTION' },
      { status: 400 },
    );
  }
  try {
    const outcome = await executeAtomicDriverTransition(
      sb(), auth.driver.id, body, body.action,
    );
    if (!outcome.handled) {
      return NextResponse.json(
        { ok: false, reason_code: 'FEATURE_DISABLED' },
        { status: 404 },
      );
    }
    return NextResponse.json(outcome.result, { status: outcome.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason_code: 'ATOMIC_TRANSITION_FAILED',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
