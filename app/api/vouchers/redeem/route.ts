import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    tenant_id?: string;
    location_id?: string;
    code?: string;
    bestellwert?: number;
    kunde_email?: string;
    kunde_telefon?: string;
  } | null;

  if (!body?.code || !body.bestellwert) {
    return NextResponse.json({ ok: false, error: 'code + bestellwert erforderlich' }, { status: 400 });
  }

  const svc = createServiceClient();

  // Tenant via location_id auflösen, wenn nicht direkt angegeben
  let tenantId = body.tenant_id;
  if (!tenantId && body.location_id) {
    const { data } = await svc.from('locations').select('tenant_id').eq('id', body.location_id).single();
    tenantId = data?.tenant_id ?? undefined;
  }
  if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant nicht auflösbar' }, { status: 400 });

  const { data, error } = await svc.rpc('redeem_voucher', {
    p_tenant_id: tenantId,
    p_code: body.code.toUpperCase(),
    p_bestellwert: body.bestellwert,
    p_kunde_email: body.kunde_email ?? null,
    p_kunde_telefon: body.kunde_telefon ?? null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
