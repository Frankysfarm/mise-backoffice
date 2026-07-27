import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb } from '@/app/api/driver/v1/_lib/driver-auth';
import { validateDriverV2Envelope, statusForDriverV2Reason } from '@/lib/delivery/driver-v2-contract';
import { executeAtomicPickup } from '@/lib/delivery/driver-v2-pick';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const correlationId = randomUUID();
  const auth = await getDriverFromBearer(req);
  if (!auth) return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId }, { status: 401 });
  try {
    const envelope = validateDriverV2Envelope(await req.json());
    if (envelope.action !== 'atomic_pickup') {
      return NextResponse.json({ ok: false, reason_code: 'ATOMIC_PICKUP_ACTION_REQUIRED',
        correlation_id: correlationId }, { status: 400 });
    }
    const result = await executeAtomicPickup(sb(), auth.driver.id, envelope, correlationId);
    return NextResponse.json(result, { status: result.ok ? 200 : statusForDriverV2Reason(String(result.reason_code)) });
  } catch (error) {
    const reason = error instanceof Error && /^(INVALID|EXPECTED|.*REQUIRED|.*MISMATCH)/.test(error.message)
      ? error.message : 'ATOMIC_PICKUP_FAILED';
    return NextResponse.json({ ok: false, reason_code: reason, correlation_id: correlationId },
      { status: statusForDriverV2Reason(reason) });
  }
}
