/**
 * POST /api/admin/drivers/:id/activate — Tenant-Link wieder auf 'active'
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAdminContext, isAdminContext } from '../../../_lib/tenant-from-session';

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
  const { error } = await sb
    .from('mise_driver_tenants')
    .update({ status: 'active' })
    .eq('driver_id', driverId)
    .eq('tenant_id', adminCtx.tenant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
