import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getAdminContext,
  isAdminContext,
} from '../../_lib/tenant-from-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getAdminContext();
  if (!isAdminContext(context)) return context;
  if (!['admin', 'owner', 'manager', 'dispatcher'].includes(context.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const service = createServiceClient();
  const [policy, alerts, overrides, events, holds, writer] = await Promise.all([
    service.from('ops_tenant_policy_v2')
      .select('mutation_enabled,observability_enabled,gps_retention_days,updated_at')
      .eq('tenant_id', context.tenant_id).maybeSingle(),
    service.from('ops_alert_episodes_v2')
      .select('reason_code,resource_key,state,severity,observed,threshold,last_seen_at,occurrence_count,correlation_id')
      .eq('tenant_id', context.tenant_id).neq('state', 'resolved')
      .order('last_seen_at', { ascending: false }).limit(100),
    service.from('ops_manual_override_requests_v2')
      .select('action,actor_role,target_kind,target_id,reason_code,before_state,after_state,correlation_id,created_at')
      .eq('tenant_id', context.tenant_id)
      .order('created_at', { ascending: false }).limit(50),
    service.from('ops_events_v2')
      .select('event_type,severity,reason_code,resource_kind,attributes,correlation_id,occurred_at')
      .eq('tenant_id', context.tenant_id)
      .order('occurred_at', { ascending: false }).limit(100),
    service.from('dispatch_kitchen_holds_v2')
      .select('state,reason_code,kitchen_release_at,absolute_hold_deadline_at,correlation_id')
      .eq('tenant_id', context.tenant_id).eq('state', 'held').limit(100),
    service.from('dispatch_writer_gates')
      .select('writer,enabled,active_writer_id,writer_epoch,lease_expires_at')
      .eq('tenant_id', context.tenant_id).maybeSingle(),
  ]);
  const failure = [policy, alerts, overrides, events, holds, writer].find((entry) => entry.error);
  if (failure?.error) {
    return NextResponse.json({ ok: false, reason_code: 'OPS_SNAPSHOT_FAILED' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    tenant_id: context.tenant_id,
    policy: policy.data,
    writer: writer.data,
    alerts: alerts.data ?? [],
    holds: holds.data ?? [],
    recent_overrides: overrides.data ?? [],
    recent_events: events.data ?? [],
  });
}
