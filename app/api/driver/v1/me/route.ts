import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  const { data: tenantLinks } = await sb()
    .from('mise_driver_tenants')
    .select('tenant_id, status, tenants:tenant_id(name, slug)')
    .eq('driver_id', m.driver.id)
    .eq('status', 'active');

  const tenants = (tenantLinks ?? []).map((row: any) => ({
    id: row.tenant_id as string,
    name: (row.tenants?.name ?? null) as string | null,
    slug: (row.tenants?.slug ?? null) as string | null,
  }));

  return NextResponse.json({ ok: true, driver: m.driver, tenants });
}
