import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getAdminContext,
  isAdminContext,
} from '../../_lib/tenant-from-session';
import { validateManualOverrideEvidence } from '@/lib/delivery/ops-observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OverrideBody = {
  location_id: string;
  action: string;
  target_kind: string;
  target_id: string;
  expected_version: number;
  reason_code: string;
  reason_note: string;
  action_id: string;
  correlation_id: string;
};

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if (!isAdminContext(context)) return context;
  const actorRole = context.role === 'dispatcher' ? 'dispatcher'
    : ['admin', 'owner', 'manager'].includes(context.role) ? 'admin' : null;
  if (!actorRole) {
    return NextResponse.json({ ok: false, reason_code: 'OPS_ACTOR_FORBIDDEN' }, { status: 403 });
  }
  let body: OverrideBody;
  try {
    body = await request.json() as OverrideBody;
    validateManualOverrideEvidence({
      actor_id: context.employee_id,
      actor_role: actorRole,
      reason_code: body.reason_code,
      note: body.reason_note,
      expected_version: body.expected_version,
      action_id: body.action_id,
      correlation_id: body.correlation_id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'INVALID_OVERRIDE_ENVELOPE';
    return NextResponse.json({ ok: false, reason_code: reason }, { status: 400 });
  }
  const service = createServiceClient();
  const { data, error } = await service.rpc('fn_ops_manual_override_v2', {
    p_tenant_id: context.tenant_id,
    p_location_id: body.location_id,
    p_actor_id: context.employee_id,
    p_actor_role: actorRole,
    p_action: body.action,
    p_target_kind: body.target_kind,
    p_target_id: body.target_id,
    p_expected_version: body.expected_version,
    p_reason_code: body.reason_code,
    p_reason_note: body.reason_note,
    p_action_id: body.action_id,
    p_correlation_id: body.correlation_id,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason_code: 'OPS_OVERRIDE_RPC_FAILED' }, { status: 500 });
  }
  const result = data as { ok?: boolean; reason_code?: string };
  return NextResponse.json(result, { status: result?.ok ? 200 : 409 });
}
