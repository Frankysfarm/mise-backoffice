/**
 * POST /api/admin/drivers/:id/regenerate-code
 * Generiert einen neuen Login-Code für einen bestehenden Driver
 * (z.B. wenn Token abgelaufen oder Code verloren).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAdminContext, isAdminContext } from '../../../_lib/tenant-from-session';
import { generate6DigitCode, hashCode } from '../../../_lib/driver-code';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const adminCtx = await getAdminContext();
  if (!isAdminContext(adminCtx)) return adminCtx;
  const { id: driverId } = await ctx.params;

  const sb = createServiceClient();

  // Ownership: Driver muss zum Tenant des Admins gehören
  const { data: link } = await sb
    .from('mise_driver_tenants')
    .select('id')
    .eq('driver_id', driverId)
    .eq('tenant_id', adminCtx.tenant_id)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: 'Driver nicht gefunden' }, { status: 404 });
  }

  const code = generate6DigitCode();
  const code_hash = hashCode(code);

  await sb.rpc('fn_set_driver_initial_code', {
    p_driver_id: driverId,
    p_code_hash: code_hash,
    p_set_by: adminCtx.employee_id,
  });

  // Optional: aktive Sessions invalidieren damit nur der neue Code zählt
  await sb.from('mise_driver_sessions').delete().eq('driver_id', driverId);

  return NextResponse.json({
    ok: true,
    login_code: code,
    expires_in_days: 14,
  });
}
