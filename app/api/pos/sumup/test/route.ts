import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const { tenant_id } = await req.json();
  const svc = createServiceClient();

  const { data: emp } = await svc.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id || emp.tenant_id !== tenant_id) {
    return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
  }

  const { data: tenant } = await svc.from('tenants')
    .select('sumup_api_key, sumup_merchant_code')
    .eq('id', tenant_id).single();

  if (!tenant?.sumup_api_key) {
    return NextResponse.json({ ok: false, error: 'Kein API-Key gespeichert' });
  }

  try {
    // SumUp Me-Endpoint: prüft API-Key + liefert Merchant-Info
    const res = await fetch('https://api.sumup.com/v0.1/me', {
      headers: { Authorization: `Bearer ${tenant.sumup_api_key}` },
    });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `SumUp API antwortete mit ${res.status} — bitte API-Key prüfen.`,
      });
    }

    const info = await res.json();
    return NextResponse.json({
      ok: true,
      merchant_name: info?.account?.name ?? info?.merchant_profile?.merchant_code ?? tenant.sumup_merchant_code,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Verbindungsfehler',
    });
  }
}
