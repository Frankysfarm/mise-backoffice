import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb } from '@/app/api/driver/v1/_lib/driver-auth';
import { executeDriverV2Action, loadDriverV2Snapshot } from '@/lib/delivery/driver-v2-server';
import {
  statusForDriverV2Reason, validateDriverV2Envelope, type DriverV2Action,
} from '@/lib/delivery/driver-v2-contract';

export async function snapshotHandler(req: NextRequest) {
  const correlationId = randomUUID();
  try {
    const auth = await getDriverFromBearer(req);
    if (!auth) return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId }, { status: 401 });
    return NextResponse.json({ ok: true, correlation_id: correlationId, snapshot: await loadDriverV2Snapshot(sb(), auth.driver.id, correlationId) });
  } catch {
    return NextResponse.json({ ok: false, reason_code: 'SNAPSHOT_FAILED', correlation_id: correlationId }, { status: 500 });
  }
}

export function mutationHandler(action: DriverV2Action) {
  return async (req: NextRequest) => {
    const correlationId = randomUUID();
    let auth: Awaited<ReturnType<typeof getDriverFromBearer>> = null;
    try {
      auth = await getDriverFromBearer(req);
      if (!auth) return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId }, { status: 401 });
      const envelope = validateDriverV2Envelope(await req.json());
      const result = await executeDriverV2Action(sb(), auth.driver.id, action, envelope, correlationId);
      return NextResponse.json(result, { status: result.ok ? 200 : statusForDriverV2Reason(result.reason_code) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'INVALID_REQUEST';
      const safeReason = reason.startsWith('EXPECTED_') || reason.startsWith('INVALID_')
        || reason.endsWith('_REQUIRED') ? reason : 'DRIVER_V2_REQUEST_FAILED';
      let snapshot = null;
      if (auth) snapshot = await loadDriverV2Snapshot(sb(), auth.driver.id, correlationId).catch(() => null);
      return NextResponse.json({ ok: false, reason_code: safeReason, correlation_id: correlationId, snapshot }, { status: statusForDriverV2Reason(safeReason) });
    }
  };
}
