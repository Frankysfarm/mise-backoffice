import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/create-session
 *
 * Self-Service Stripe: Tenant hat seinen eigenen Secret-Key in
 * `tenants.stripe_secret_key` eingetragen. Wir benutzen diesen direkt
 * für die Checkout-Session — Geld geht 1:1 auf seinen Stripe-Account,
 * keine Plattform-Fee, keine Connect-Komplexität.
 *
 * Body: { order_id: string }
 * Response: { url: string, session_id: string }
 */
export async function POST(req: NextRequest) {
  const { order_id } = (await req.json().catch(() => null)) as { order_id?: string } | null ?? {};
  if (!order_id) return NextResponse.json({ error: 'order_id erforderlich' }, { status: 400 });

  const svc = createServiceClient();

  const { data: order } = await svc
    .from('customer_orders')
    .select('id,bestellnummer,kunde_name,kunde_email,gesamtbetrag,location_id,items:order_items(name,menge,einzelpreis)')
    .eq('id', order_id)
    .single();
  if (!order) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404 });

  const { data: location } = await svc
    .from('locations')
    .select('tenant_id,name')
    .eq('id', (order as any).location_id)
    .single();
  if (!location?.tenant_id) return NextResponse.json({ error: 'Filiale fehlt' }, { status: 400 });

  const { data: tenant } = await svc
    .from('tenants')
    .select('slug,name,stripe_secret_key,stripe_connect_charges_enabled')
    .eq('id', location.tenant_id)
    .single();

  if (!tenant?.stripe_secret_key) {
    return NextResponse.json(
      { error: 'Restaurant hat Stripe noch nicht verbunden.' },
      { status: 400 },
    );
  }

  // Tenant-spezifischer Stripe-Client
  const stripe = new Stripe(tenant.stripe_secret_key, {
    apiVersion: '2024-12-18.acacia' as any,
  });

  const origin = req.headers.get('origin') ?? new URL(req.url).origin;

  // Line-Items aus Order-Items
  const lineItems = ((order as any).items as { name: string; menge: number; einzelpreis: number }[])
    .map((it) => ({
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(Number(it.einzelpreis) * 100),
        product_data: { name: it.name },
      },
      quantity: it.menge,
    }));

  const gesamtCents = Math.round(Number((order as any).gesamtbetrag) * 100);
  const itemsSumCents = lineItems.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
  if (gesamtCents - itemsSumCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        unit_amount: gesamtCents - itemsSumCents,
        product_data: { name: 'Liefergebühr & Gebühren' },
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: (order as any).kunde_email ?? undefined,
      line_items: lineItems,
      // Self-Service: Direct Charge auf Tenant's eigenen Account
      // Apple/Google Pay / Karten / SEPA werden automatisch von Stripe
      // basierend auf Browser/Gerät angeboten.
      payment_intent_data: {
        metadata: {
          order_id: (order as any).id,
          bestellnummer: (order as any).bestellnummer,
          tenant_id: location.tenant_id,
        },
      },
      metadata: {
        order_id: (order as any).id,
        bestellnummer: (order as any).bestellnummer,
      },
      success_url: `${origin}/order/paid?session_id={CHECKOUT_SESSION_ID}&bon=${(order as any).bestellnummer}`,
      cancel_url: `${origin}/order/${tenant.slug}?canceled=1`,
      locale: 'de',
    });

    await svc
      .from('customer_orders')
      .update({ stripe_payment_id: session.id })
      .eq('id', order_id);

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Stripe-Fehler' },
      { status: 500 },
    );
  }
}
