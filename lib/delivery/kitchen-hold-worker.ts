import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { decideKitchenHold, type KitchenHoldInput } from './route-batching-hold';

type HoldRpcResult = {
  ok: boolean;
  reason_code?: string;
  state?: string;
  hold_version?: number;
  idempotent_replay?: boolean;
};

export async function scheduleKitchenHoldV2(
  client: SupabaseClient,
  tenantId: string,
  input: KitchenHoldInput,
  actionId: string,
  correlationId: string,
): Promise<HoldRpcResult> {
  const decision = decideKitchenHold(input);
  if (decision.action === 'release_now') {
    return { ok: false, reason_code: decision.reasonCode };
  }
  const { data, error } = await client.rpc('fn_schedule_kitchen_hold_v2', {
    p_tenant_id: tenantId,
    p_order_id: input.orderId,
    p_expected_hold_version: input.previous?.holdVersion ?? 0,
    p_input_version: input.inputVersion,
    p_release_at: decision.releaseAt,
    p_absolute_deadline_at: decision.absoluteDeadlineAt,
    p_next_evaluation_at: decision.nextEvaluationAt,
    p_reason_code: decision.reasonCode,
    p_input_snapshot: { ...input, audit: decision.audit },
    p_action_id: actionId,
    p_correlation_id: correlationId,
  });
  if (error) throw new Error(`fn_schedule_kitchen_hold_v2 failed: ${error.message}`);
  return data as HoldRpcResult;
}

/**
 * Controlled scheduler entrypoint. PostgreSQL owns concurrency through
 * FOR UPDATE SKIP LOCKED; therefore overlapping workers and restarts are safe.
 */
export async function runKitchenHoldWatchdog(
  client: SupabaseClient,
  limit = 100,
): Promise<{ released: number; runId: string }> {
  const runId = randomUUID();
  const { data, error } = await client.rpc('fn_watchdog_release_kitchen_holds_v2', {
    p_limit: Math.max(1, Math.min(1_000, Math.trunc(limit))),
  });
  if (error) throw new Error(`KITCHEN_HOLD_WATCHDOG_FAILED:${error.code ?? 'unknown'}`);
  return { released: Number(data ?? 0), runId };
}
