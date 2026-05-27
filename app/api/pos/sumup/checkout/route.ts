import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Erzeugt einen SumUp-Checkout für eine POS-Zahlung.
 * Der Card Reader (via SumUp App) verarbeitet den Checkout anhand der zurückgegebenen ID.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const { tenant_id, amount, description, order_id } = await req.json() as {
    tenant_id: string; amount: number; description?: string; order_id?: string;
  };

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id || emp.tenant_id !== tenant_id) {
    return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
  }

  const { data: tenant } = await svc.from('tenants')
    .select('sumup_api_key, sumup_merchant_code, name').eq('id', tenant_id).single();

  if (!tenant?.sumup_api_key || !tenant.sumup_merchant_code) {
    return NextResponse.json({ ok: false, error: 'SumUp nicht konfiguriert' }, { status: 400 });
  }

  const checkoutRef = order_id ?? `pos-${Date.now()}`;

  try {
    const res = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.sumup_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkout_reference: checkoutRef,
        amount: Number(amount.toFixed(2)),
        currency: 'EUR',
        merchant_code: tenant.sumup_merchant_code,
        description: description ?? `POS-Verkauf ${tenant.name}`,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: `SumUp: ${res.status} — ${txt}` });
    }

    const checkout = await res.json();
    return NextResponse.json({ ok: true, checkout });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Netzwerkfehler',
    });
  }
}
