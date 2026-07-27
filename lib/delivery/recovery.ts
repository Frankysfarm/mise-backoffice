import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

export interface RecoveryEvent {
  id: string;
  location_id: string;
  cancelled_batch_id: string;
  driver_id: string | null;
  reason: string | null;
  orders_recovered: number;
  orders_requeued: number;
  recovery_batch_ids: string[];
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  error: string | null;
  driver_name?: string | null;
  driver_vehicle?: string | null;
}

export interface RecoveryResult {
  event_id: string;
  cancelled_batch_id: string;
  orders_recovered: number;
  orders_requeued: number;
  new_batch_ids: string[];
  error: string | null;
}

/**
 * Recovery is escalation-only. Connectivity loss or a cancelled legacy batch is
 * not authority to clear ownership or invoke a second dispatch writer.
 */
export async function recoverCancelledBatch(
  batchId: string,
  reason = 'manual',
  _triggerRedispatch = false,
): Promise<RecoveryResult> {
  const sb = createServiceClient();
  const startedAt = new Date().toISOString();
  const correlationId = randomUUID();
  const { data: batch, error: batchError } = await sb.from('mise_delivery_batches')
    .select('id,driver_id,location_id,state,state_version').eq('id', batchId).maybeSingle();
  if (batchError) throw new Error(`RECOVERY_BATCH_LOOKUP_FAILED:${batchError.code ?? 'unknown'}`);
  if (!batch) {
    return {
      event_id: '', cancelled_batch_id: batchId, orders_recovered: 0,
      orders_requeued: 0, new_batch_ids: [], error: 'BATCH_NOT_FOUND',
    };
  }

  const { data: escalation, error: escalationError } = await sb.rpc(
    'fn_escalate_batch_recovery', {
      p_batch_id: batch.id, p_expected_batch_version: batch.state_version,
      p_reason_code: reason, p_correlation_id: correlationId,
    },
  );
  if (escalationError) {
    throw new Error(`RECOVERY_ESCALATION_FAILED:${escalationError.code ?? 'unknown'}`);
  }
  if (!(escalation as { ok?: boolean } | null)?.ok) {
    return {
      event_id: '', cancelled_batch_id: batchId, orders_recovered: 0,
      orders_requeued: 0, new_batch_ids: [],
      error: (escalation as { reason_code?: string } | null)?.reason_code ?? 'RECOVERY_ESCALATION_REJECTED',
    };
  }

  const { data: eventRow, error: eventError } = await sb.from('delivery_recovery_events')
    .insert({
      location_id: batch.location_id, cancelled_batch_id: batchId,
      driver_id: batch.driver_id, reason: `escalated:${reason}`,
      orders_recovered: 0, orders_requeued: 0, recovery_batch_ids: [],
      started_at: startedAt, completed_at: new Date().toISOString(),
      error: null,
    }).select('id').single();
  if (eventError || !eventRow) {
    throw new Error(`RECOVERY_EVENT_INSERT_FAILED:${eventError?.code ?? 'missing_row'}`);
  }
  return {
    event_id: (eventRow as { id: string }).id, cancelled_batch_id: batchId,
    orders_recovered: 0, orders_requeued: 0, new_batch_ids: [], error: null,
  };
}

export async function getRecoveryEvents(locationId: string, limit = 20): Promise<RecoveryEvent[]> {
  const sb = createServiceClient();
  const { data, error } = await sb.from('v_recovery_summary').select('*')
    .eq('location_id', locationId).order('started_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`RECOVERY_EVENTS_LOOKUP_FAILED:${error.code ?? 'unknown'}`);
  return (data ?? []) as RecoveryEvent[];
}

/**
 * A stale GPS signal is evidence for supervision, never evidence that active
 * work may be cancelled or reassigned.
 */
export async function scanStaleBatches(staleMinutes = 60): Promise<{
  scanned: number;
  recovered: string[];
}> {
  const sb = createServiceClient();
  const threshold = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data: staleBatches, error: staleError } = await sb
    .from('mise_delivery_batches')
    .select('id,driver_id,state,state_version,updated_at')
    .in('state', ['on_route', 'at_restaurant', 'assigned'])
    .lt('updated_at', threshold).limit(10);
  if (staleError) throw new Error(`RECOVERY_STALE_SCAN_FAILED:${staleError.code ?? 'unknown'}`);

  const escalated: string[] = [];
  for (const batch of staleBatches ?? []) {
    const { data: driver, error: driverError } = await sb.from('mise_drivers')
      .select('last_position_at').eq('id', batch.driver_id as string).maybeSingle();
    if (driverError) throw new Error(`RECOVERY_DRIVER_LOOKUP_FAILED:${driverError.code ?? 'unknown'}`);
    const lastPing = driver?.last_position_at as string | null;
    const pingAge = lastPing ? Date.now() - new Date(lastPing).getTime() : Infinity;
    if (pingAge <= staleMinutes * 60_000) continue;
    const { data: result, error } = await sb.rpc('fn_escalate_batch_recovery', {
      p_batch_id: batch.id, p_expected_batch_version: batch.state_version,
      p_reason_code: 'STALE_GPS_ACTIVE_WORK', p_correlation_id: randomUUID(),
    });
    if (error) throw new Error(`RECOVERY_STALE_ESCALATION_FAILED:${error.code ?? 'unknown'}`);
    if ((result as { ok?: boolean } | null)?.ok) escalated.push(batch.id as string);
  }
  return { scanned: staleBatches?.length ?? 0, recovered: escalated };
}
