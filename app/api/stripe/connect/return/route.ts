import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;

  if (!stripeConfigured()) {
    return NextResponse.redirect(`${origin}/settings/restaurant?stripe_error=not_configured`);
  }

  const supabase = await createClient();
  const svc = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: employee } = await supabase
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!employee?.tenant_id) return NextResponse.redirect(`${origin}/login`);

  const { data: tenant } = await svc
    .from('tenants')
    .select('stripe_connect_account_id')
    .eq('id', employee.tenant_id)
    .single();

  if (tenant?.stripe_connect_account_id) {
    const stripe = getStripe()!;
    const acc = await stripe.accounts.retrieve(tenant.stripe_connect_account_id);
    await svc.from('tenants').update({
      stripe_connect_charges_enabled: !!acc.charges_enabled,
      stripe_connect_payouts_enabled: !!acc.payouts_enabled,
      stripe_connect_details_submitted: !!acc.details_submitted,
      stripe_connect_onboarded_at: acc.details_submitted ? new Date().toISOString() : null,
    }).eq('id', employee.tenant_id);

    // Wenn Stripe fertig: Online-Zahlung automatisch für alle Order-Typen aktivieren
    if (acc.charges_enabled) {
      await svc
        .from('tenant_payment_methods')
        .update({
          enabled_lieferung: true,
          enabled_abholung: true,
          enabled_vor_ort: false,
        })
        .eq('tenant_id', employee.tenant_id)
        .eq('method', 'stripe');
    }
  }

  return NextResponse.redirect(`${origin}/settings/restaurant?stripe=done`);
}
