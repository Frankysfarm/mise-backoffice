import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadDriverV2Snapshot } from '@/lib/delivery/driver-v2-server';

export async function acceptAsTechnicalAck(
  client: SupabaseClient, driverId: string, body: Record<string, unknown>,
) {
  const { data: assignment, error } = await client.from('dispatch_offer_assignments')
    .select('id,tenant_id,assignment_version,state').eq('driver_id', driverId)
    .in('state', ['assigned', 'picked_up', 'in_progress'])
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ ok: false, reason_code: 'ACK_LOOKUP_FAILED' }, { status: 500 });
  if (!assignment) return NextResponse.json({
    ok: false, reason_code: 'VERSIONED_DRIVER_V2_REQUIRED', compatibility_deadline: '2026-09-30',
  }, { status: 409 });
  const receiptKey = typeof body.action_id === 'string' ? body.action_id
    : typeof body.transition_key === 'string' ? body.transition_key : randomUUID();
  const correlationId = randomUUID();
  const { data: ack, error: ackError } = await client.rpc('fn_driver_accept_ack_compat_v2', {
    p_tenant_id: assignment.tenant_id, p_assignment_id: assignment.id,
    p_driver_id: driverId, p_snapshot_version: assignment.assignment_version,
    p_receipt_key: receiptKey, p_metadata: { compatibility: 'driver-v1-accept-ack-only' },
    p_api_version: 'driver-v1',
    p_correlation_id: correlationId,
  });
  if (ackError) return NextResponse.json({ ok: false, reason_code: 'ACK_FAILED' }, { status: 500 });
  const snapshot = await loadDriverV2Snapshot(client, driverId, correlationId);
  return NextResponse.json({
    ...(ack as Record<string, unknown>), compatibility: 'accept_is_ack_only',
    compatibility_deadline: '2026-09-30', snapshot,
  }, { status: (ack as any)?.ok ? 200 : 409 });
}
