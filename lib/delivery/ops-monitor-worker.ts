import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateOpsAlerts, type OpsSnapshot } from './ops-observability';

const DEFAULT_THRESHOLDS = {
  unassigned_order_age_seconds: 300,
  stale_gps_seconds: 120,
  push_ack_seconds: 180,
  queue_backlog_count: 100,
  worker_heartbeat_seconds: 300,
  delivery_risk_seconds: 300,
  app_error_rate: 0.05,
};

export async function runOpsMonitorWorker(client: SupabaseClient) {
  const runId = randomUUID();
  const now = new Date();
  const { data: policies, error: policyError } = await client
    .from('ops_tenant_policy_v2')
    .select('tenant_id')
    .eq('observability_enabled', true)
    .limit(500);
  if (policyError) {
    if (policyError.code === '42P01' || policyError.code === 'PGRST205') {
      return { run_id: runId, tenants: 0, alerts: 0, default_off: true };
    }
    throw new Error('OPS_MONITOR_POLICY_LOAD_FAILED');
  }
  let alertCount = 0;
  for (const policy of policies ?? []) {
    const tenantId = (policy as { tenant_id: string }).tenant_id;
    const [orders, gps, pushes, holds, writer, heartbeat] = await Promise.all([
      client.from('customer_orders').select('created_at,assignment_deadline_at')
        .eq('tenant_id', tenantId).is('mise_driver_id', null)
        .eq('typ', 'lieferung').order('created_at').limit(1),
      client.from('mise_driver_position_current').select('captured_at')
        .eq('tenant_id', tenantId).order('captured_at').limit(1),
      client.from('mise_push_outbox').select('created_at')
        .in('notification_state', ['queued', 'provider_accepted'])
        .order('created_at').limit(101),
      client.from('dispatch_kitchen_holds_v2').select('absolute_hold_deadline_at')
        .eq('tenant_id', tenantId).eq('state', 'held')
        .lt('absolute_hold_deadline_at', now.toISOString()).limit(101),
      client.from('dispatch_writer_gates').select('enabled,lease_expires_at')
        .eq('tenant_id', tenantId).maybeSingle(),
      client.from('ops_worker_heartbeats_v2').select('last_succeeded_at')
        .eq('tenant_id', tenantId).eq('worker_name', 'dispatch-monitor').maybeSingle(),
    ]);
    if ([orders, gps, pushes, holds, writer, heartbeat].some((response) => response.error)) {
      throw new Error('OPS_MONITOR_SNAPSHOT_FAILED');
    }
    const snapshot: OpsSnapshot = {
      now: now.toISOString(),
      oldest_unassigned_at: orders.data?.[0]?.created_at ?? null,
      oldest_trusted_gps_at: gps.data?.[0]?.captured_at ?? null,
      oldest_unacked_push_at: pushes.data?.[0]?.created_at ?? null,
      queue_backlog_count: pushes.data?.length ?? 0,
      overdue_hold_count: holds.data?.length ?? 0,
      worker_last_success_at: heartbeat.data?.last_succeeded_at ?? now.toISOString(),
      nearest_delivery_deadline_at: orders.data?.[0]?.assignment_deadline_at ?? null,
    };
    const alerts = evaluateOpsAlerts(snapshot, DEFAULT_THRESHOLDS);
    if (writer.data?.enabled && (!writer.data.lease_expires_at ||
        Date.parse(writer.data.lease_expires_at) <= now.getTime())) {
      alerts.push({
        reason_code: 'WRITER_LEASE_LOST',
        severity: 'critical', observed: 1, threshold: 1, unit: 'count',
      });
    }
    for (const alert of alerts) {
      const { data, error } = await client.rpc('fn_ops_record_alert_v2', {
        p_tenant_id: tenantId,
        p_reason_code: alert.reason_code,
        p_resource_key: 'tenant',
        p_severity: alert.severity === 'info' ? 'warning' : alert.severity,
        p_observed: alert.observed,
        p_threshold: alert.threshold,
        p_correlation_id: runId,
      });
      if (error || !(data as { ok?: boolean })?.ok) throw new Error('OPS_ALERT_WRITE_FAILED');
      alertCount++;
    }
    const { error: heartbeatError } = await client.from('ops_worker_heartbeats_v2').upsert({
      tenant_id: tenantId,
      worker_name: 'dispatch-monitor',
      last_started_at: now.toISOString(),
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      correlation_id: runId,
    }, { onConflict: 'tenant_id,worker_name' });
    if (heartbeatError) throw new Error('OPS_HEARTBEAT_WRITE_FAILED');
  }
  return { run_id: runId, tenants: policies?.length ?? 0, alerts: alertCount, default_off: false };
}
