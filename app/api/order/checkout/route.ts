import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured, computePlatformFeeCents, PLATFORM_FEE_BPS_DEFAULT } from '@/lib/stripe/client';
import { getValidTableSession, isSameOriginRequest } from '@/lib/orders/table-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResolvedItem = { id?: string; name: string; qty: number; priceCents: number };
type TableRef = { id: string; location_id: string; nummer: string };

export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

/** Erstellt eine Tischbestellung und einen Stripe PaymentIntent. */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Bestellpositionen fehlen' }, { status: 400 });
  }

  const svc = createServiceClient();
  const tableSession = await getValidTableSession(req);
  if (!tableSession || tableSession.status !== 'aktiv') {
    return NextResponse.json({ error: 'Sichere Tischsitzung fehlt oder ist abgelaufen.' }, { status: 401 });
  }
  const { data: tenant } = await svc
    .from('tenants')
    .select('id,name,stripe_connect_account_id,stripe_connect_charges_enabled,platform_fee_percent')
    .eq('id', tableSession.tenant_id)
    .maybeSingle();

  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404 });
  if (!tenant.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    return NextResponse.json({ error: 'Stripe nicht aktiv für dieses Restaurant' }, { status: 400 });
  }

  const { data: table } = await svc
    .from('restaurant_tables')
    .select('id,location_id,nummer')
    .eq('id', tableSession.table_id)
    .eq('tenant_id', tableSession.tenant_id)
    .eq('location_id', tableSession.location_id)
    .eq('aktiv', true)
    .maybeSingle();
  if (!table) return NextResponse.json({ error: 'Aktiver Tisch nicht gefunden' }, { status: 404 });

  const itemIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item.id ?? '')).filter(Boolean))];
  const { data: menuItems } = itemIds.length
    ? await svc.from('menu_items').select('id,name,preis').in('id', itemIds)
        .eq('tenant_id', tenant.id).eq('location_id', table.location_id).eq('verfuegbar', true)
    : { data: [] as { id: string; name: string; preis: number }[] };

  if (!menuItems || menuItems.length !== itemIds.length || itemIds.length === 0) {
    return NextResponse.json({ error: 'Bestellpositionen sind nicht verfügbar' }, { status: 400 });
  }
  const priceMap = new Map(menuItems.map((item) => [item.id, item]));
  const resolvedItems: ResolvedItem[] = body.items.map((raw: { id: string; qty: number }) => {
    const item = priceMap.get(raw.id)!;
    const qty = Math.trunc(Number(raw.qty));
    return { id: item.id, name: item.name, qty, priceCents: Math.round(Number(item.preis) * 100) * qty };
  });
  if (resolvedItems.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50 || item.priceCents < 0)) {
    return NextResponse.json({ error: 'Ungültige Bestellmenge' }, { status: 400 });
  }

  const amountCents = resolvedItems.reduce((sum, item) => sum + item.priceCents, 0);
  const requestedAmount = Math.round(Number(body.amountCents));
  if (amountCents < 50 || amountCents > 500_000 || requestedAmount !== amountCents) {
    return NextResponse.json({ error: 'Bestellsumme ist ungültig' }, { status: 400 });
  }

  return createIntent(svc, tenant, table as TableRef, tableSession.id, body, amountCents, resolvedItems);
}

async function createIntent(
  svc: ReturnType<typeof createServiceClient>,
  tenant: { id: string; name: string; stripe_connect_account_id: string; platform_fee_percent: number | null },
  table: TableRef,
  tableSessionId: string,
  body: { guestName?: string; note?: string },
  amountCents: number,
  items: ResolvedItem[],
) {
  const feePercent = Number(tenant.platform_fee_percent ?? (PLATFORM_FEE_BPS_DEFAULT / 100));
  const feeCents = computePlatformFeeCents(amountCents, feePercent);
  const guestName = String(body.guestName ?? '').trim().slice(0, 120) || 'Gast';
  const note = String(body.note ?? '').trim().slice(0, 1000) || null;
  const amountEuro = amountCents / 100;

  const { data: order, error: orderError } = await svc
    .from('customer_orders')
    .insert({
      tenant_id: tenant.id,
      location_id: table.location_id,
      tisch_id: table.id,
      typ: 'abholung',
      status: 'wartet_auf_zahlung',
      kunde_name: guestName,
      kunde_notiz: note,
      zwischensumme: amountEuro,
      gesamtbetrag: amountEuro,
      zahlungsart: 'karte',
      bezahlt: false,
      order_channel: 'tisch',
      payment_status: 'pending_payment',
      amount_total_cents: amountCents,
      application_fee_cents: feeCents,
      table_number: table.nummer,
      table_session_id: tableSessionId,
      guest_name: guestName,
      guest_note: note,
      order_items_json: items,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? 'Order konnte nicht angelegt werden' }, { status: 500 });
  }

  const { error: itemError } = await svc.from('order_items').insert(items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.id ?? null,
    name: item.name,
    menge: item.qty,
    einzelpreis: item.priceCents / item.qty / 100,
  })));
  if (itemError) {
    await svc.from('customer_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht angelegt werden' }, { status: 500 });
  }

  const stripe = getStripe()!;
  let paymentIntent: { id: string; client_secret: string | null };
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: feeCents,
      transfer_data: { destination: tenant.stripe_connect_account_id },
      on_behalf_of: tenant.stripe_connect_account_id,
      metadata: { order_id: order.id, tenant_id: tenant.id, table: table.nummer, tenant_name: tenant.name },
    }, { idempotencyKey: order.id });
  } catch (error) {
    await svc.from('customer_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Stripe-Fehler' }, { status: 502 });
  }

  await svc.from('customer_orders').update({ payment_intent_id: paymentIntent.id }).eq('id', order.id);
  return NextResponse.json({ orderId: order.id, clientSecret: paymentIntent.client_secret, amountCents });
}
