import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb } from '@/app/api/driver/v1/_lib/driver-auth';
import { loadDriverV2Snapshot } from '@/lib/delivery/driver-v2-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const correlationId = randomUUID();
  const auth = await getDriverFromBearer(req);
  if (!auth) {
    return NextResponse.json({ ok: false, reason_code: 'UNAUTHORIZED', correlation_id: correlationId }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason_code: 'INVALID_REQUEST', correlation_id: correlationId }, { status: 400 });
  }
  if (typeof body.notification_id !== 'string' || typeof body.action_id !== 'string') {
    return NextResponse.json({ ok: false, reason_code: 'ACK_FIELDS_REQUIRED', correlation_id: correlationId }, { status: 400 });
  }
  const client = sb();
  const { data, error } = await client.rpc('fn_ack_wake_notification', {
    p_driver_id: auth.driver.id, p_notification_id: body.notification_id,
    p_action_id: body.action_id, p_correlation_id: correlationId,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason_code: 'NOTIFICATION_ACK_FAILED', correlation_id: correlationId }, { status: 500 });
  }
  const result = data as { ok?: boolean; reason_code?: string };
  const snapshot = await loadDriverV2Snapshot(client, auth.driver.id, correlationId);
  return NextResponse.json({ ...result, snapshot }, { status: result.ok ? 200 : 409 });
}
