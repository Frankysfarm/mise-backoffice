import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConnectBody {
  publishableKey: string;
  secretKey: string;
}

/**
 * POST /api/stripe/connect-tenant
 *
 * Self-service: Tenant pasted his own Stripe Keys.
 * Wir verifizieren mit Stripe.com (read-only API-Call) und speichern.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees').select('tenant_id, rolle').eq('id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'Kein Tenant' }, { status: 403 });
  if (emp.rolle !== 'admin') {
    return NextResponse.json({ error: 'Nur Admins dürfen Stripe verbinden' }, { status: 403 });
  }

  const body = (await req.json()) as ConnectBody;
  const sk = body.secretKey?.trim();
  const pk = body.publishableKey?.trim();

  if (!sk || !pk) {
    return NextResponse.json(
      { error: 'Beide Schlüssel müssen eingetragen werden.' },
      { status: 400 },
    );
  }
  if (!sk.startsWith('sk_')) {
    return NextResponse.json(
      { error: 'Secret Key muss mit „sk_" beginnen (z. B. sk_test_…).' },
      { status: 400 },
    );
  }
  if (!pk.startsWith('pk_')) {
    return NextResponse.json(
      { error: 'Publishable Key muss mit „pk_" beginnen (z. B. pk_test_…).' },
      { status: 400 },
    );
  }

  // Test-Modus erkennen
  const mode: 'test' | 'live' = sk.startsWith('sk_test_') ? 'test' : 'live';
  if (mode !== (pk.startsWith('pk_test_') ? 'test' : 'live')) {
    return NextResponse.json(
      { error: 'Test- und Live-Schlüssel passen nicht zueinander. Beide müssen test ODER live sein.' },
      { status: 400 },
    );
  }

  // Validate keys with Stripe API
  let account: Stripe.Account;
  try {
    const stripe = new Stripe(sk, { apiVersion: '2024-12-18.acacia' as any });
    account = await (stripe.accounts.retrieve as (id?: string) => Promise<Stripe.Account>)();
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Invalid API Key')) {
      return NextResponse.json(
        { error: 'Secret Key ist ungültig. Prüfe ob du den richtigen kopiert hast.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: `Stripe-Fehler: ${msg}` },
      { status: 502 },
    );
  }

  // Persist
  const svc = createServiceClient();
  const { error } = await svc
    .from('tenants')
    .update({
      stripe_secret_key: sk,
      stripe_publishable_key: pk,
      stripe_account_email: account.email ?? null,
      stripe_account_country: account.country ?? null,
      stripe_mode: mode,
      stripe_connected_at: new Date().toISOString(),
      stripe_connect_charges_enabled: account.charges_enabled,
      stripe_connect_payouts_enabled: account.payouts_enabled,
      stripe_connect_details_submitted: account.details_submitted,
    })
    .eq('id', emp.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mode,
    account: {
      email: account.email,
      country: account.country,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
  });
}

/**
 * DELETE /api/stripe/connect-tenant
 *
 * Trennt die Stripe-Verbindung. Customer-Frontend zeigt dann wieder
 * „nur Bar/Karte vor Ort" als Optionen.
 */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees').select('tenant_id, rolle').eq('id', user.id).maybeSingle();
  if (!emp?.tenant_id || emp.rolle !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const svc = createServiceClient();
  await svc
    .from('tenants')
    .update({
      stripe_secret_key: null,
      stripe_publishable_key: null,
      stripe_account_email: null,
      stripe_account_country: null,
      stripe_mode: null,
      stripe_connected_at: null,
      stripe_connect_charges_enabled: false,
      stripe_connect_payouts_enabled: false,
      stripe_connect_details_submitted: false,
    })
    .eq('id', emp.tenant_id);

  return NextResponse.json({ ok: true });
}
