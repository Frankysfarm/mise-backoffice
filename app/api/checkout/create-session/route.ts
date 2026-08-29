import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isSameOriginRequest } from '@/lib/orders/table-session';
import { computePlatformFeeCents, getStripe, PLATFORM_FEE_BPS_DEFAULT } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/create-session
 *
 * Zentrale Stripe-Connect-Session. Der öffentliche Tracking-Token bindet
 * die Zahlungsanlage an genau die zuvor erstellte Bestellung.
 *
 * Body: { order_id: string }
 * Response: { url: string, session_id: string }
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  const { order_id, tracking_token } = (await req.json().catch(() => null)) as { order_id?: string; tracking_token?: string } | null ?? {};
  if (!order_id || !tracking_token) return NextResponse.json({ error: 'Bestellnachweis erforderlich' }, { status: 400 });

  const svc = createServiceClient();

  const { data: order } = await svc
    .from('customer_orders')
    .select('id,bestellnummer,kunde_name,kunde_email,gesamtbetrag,location_id,status,bezahlt,payment_status,created_at,items:order_items(name,menge,einzelpreis)')
    .eq('id', order_id)
    .eq('tracking_token', tracking_token)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404 });
  if ((order as any).bezahlt || ['paid', 'succeeded'].includes(String((order as any).payment_status ?? ''))) {
    return NextResponse.json({ error: 'Bestellung wurde bereits bezahlt.' }, { status: 409 });
  }
  if (Date.now() - new Date((order as any).created_at).getTime() > 60 * 60_000) {
    return NextResponse.json({ error: 'Zahlungsfenster ist abgelaufen.' }, { status: 410 });
  }

  const { data: location } = await svc
    .from('locations')
    .select('tenant_id,name')
    .eq('id', (order as any).location_id)
    .single();
  if (!location?.tenant_id) return NextResponse.json({ error: 'Filiale fehlt' }, { status: 400 });

  const { data: tenant } = await svc
    .from('tenants')
    .select('slug,name,stripe_connect_account_id,stripe_connect_charges_enabled,platform_fee_percent')
    .eq('id', location.tenant_id)
    .single();

  const stripe = getStripe();
  if (!stripe || !tenant?.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    return NextResponse.json(
      { error: 'Restaurant hat Stripe noch nicht verbunden.' },
      { status: 400 },
    );
  }

  const origin = req.nextUrl.origin;

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
      payment_intent_data: {
        application_fee_amount: computePlatformFeeCents(
          gesamtCents,
          Number(tenant.platform_fee_percent ?? (PLATFORM_FEE_BPS_DEFAULT / 100)),
        ),
        transfer_data: { destination: tenant.stripe_connect_account_id },
        on_behalf_of: tenant.stripe_connect_account_id,
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
