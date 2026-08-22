import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/order/config?t=<tenant-slug>
 *
 * Öffentlich — liefert Stripe-Publishable-Key und aktivierte Zahlungsmethoden
 * für den QR-Order-Flow. Rate-Limit via nginx (10 req/s).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('t');
  if (!slug) {
    return NextResponse.json({ error: 'tenant slug fehlt (?t=)' }, { status: 400, headers: CORS });
  }

  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, stripe_connect_account_id, stripe_connect_charges_enabled')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: CORS });
  }

  const { data: settings } = await svc
    .from('tenant_payment_settings')
    .select('enabled_methods, cash_enabled, currency')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const chargesEnabled = !!tenant.stripe_connect_charges_enabled;
  const publishableKey = chargesEnabled
    ? (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? null)
    : null;

  return NextResponse.json({
    publishableKey,
    chargesEnabled,
    cashEnabled: settings?.cash_enabled ?? true,
    enabledMethods: settings?.enabled_methods ?? ['cash'],
    currency: settings?.currency ?? 'eur',
    tenantName: tenant.name,
  }, { headers: CORS });
}
