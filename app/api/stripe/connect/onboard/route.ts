import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/connect/onboard
 *
 * Erstellt (falls noch nicht vorhanden) einen Stripe Connect Express Account
 * für den aktuellen Tenant und gibt einen einmaligen AccountLink zurück.
 * Frontend redirectet auf diese URL → Stripe KYC-Flow → Return-URL.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe ist auf dem Server nicht konfiguriert. STRIPE_SECRET_KEY fehlt.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const svc = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: employee } = await supabase
    .from('employees')
    .select('id,tenant_id,rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!employee?.tenant_id || employee.rolle !== 'admin') {
    return NextResponse.json({ error: 'Nur Admins dürfen Stripe verbinden' }, { status: 403 });
  }

  const { data: tenant } = await svc
    .from('tenants')
    .select('id,name,email,slug,stripe_connect_account_id')
    .eq('id', employee.tenant_id)
    .single();
  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404 });

  const stripe = getStripe()!;
  let accountId = tenant.stripe_connect_account_id;

  if (!accountId) {
    const acc = await stripe.accounts.create({
      type: 'express',
      country: 'DE',
      email: tenant.email ?? undefined,
      business_type: 'company',
      business_profile: {
        name: tenant.name,
        mcc: '5812', // Gastronomie
        product_description: 'Restaurant-Bestellungen über FoodFlow',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { tenant_id: tenant.id, slug: tenant.slug },
    });
    accountId = acc.id;
    await svc.from('tenants').update({ stripe_connect_account_id: accountId }).eq('id', tenant.id);
  }

  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/api/stripe/connect/refresh`,
    return_url: `${origin}/api/stripe/connect/return`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url, account_id: accountId });
}
