import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured, computePlatformFeeCents, PLATFORM_FEE_BPS_DEFAULT } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type ResolvedItem = { id?: string; name: string; qty: number; priceCents: number };
type TableRef = { id: string; location_id: string; nummer: string };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function normalizeTableNumber(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/^tisch\s*/i, '').replace(/^t(?=\d)/i, '');
}

/** Erstellt eine Tischbestellung und einen Stripe PaymentIntent. */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 503, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.tenant || !body?.table || !Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'tenant, table und items sind Pflicht' }, { status: 400, headers: CORS });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('id,name,stripe_connect_account_id,stripe_connect_charges_enabled,platform_fee_percent')
    .eq('slug', String(body.tenant))
    .maybeSingle();

  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: CORS });
  if (!tenant.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    return NextResponse.json({ error: 'Stripe nicht aktiv für dieses Restaurant' }, { status: 400, headers: CORS });
  }

  const { data: tenantTables } = await svc
    .from('restaurant_tables')
    .select('id,location_id,nummer')
    .eq('tenant_id', tenant.id)
    .eq('aktiv', true)
    .limit(500);
  const wantedTable = normalizeTableNumber(body.table);
  const tableMatches = (tenantTables ?? []).filter((table) => normalizeTableNumber(table.nummer) === wantedTable);
  if (tableMatches.length !== 1) {
    return NextResponse.json({ error: tableMatches.length ? 'Tischnummer ist nicht eindeutig' : 'Aktiver Tisch nicht gefunden' }, { status: 404, headers: CORS });
  }
  const table = tableMatches[0] as TableRef;

  const itemIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item.id ?? '')).filter(Boolean))];
  const { data: menuItems } = itemIds.length
    ? await svc.from('menu_items').select('id,name,preis').in('id', itemIds)
        .eq('tenant_id', tenant.id).eq('location_id', table.location_id).eq('verfuegbar', true)
    : { data: [] as { id: string; name: string; preis: number }[] };

  if (!menuItems || menuItems.length !== itemIds.length || itemIds.length === 0) {
    return NextResponse.json({ error: 'Bestellpositionen sind nicht verfügbar' }, { status: 400, headers: CORS });
  }
  const priceMap = new Map(menuItems.map((item) => [item.id, item]));
  const resolvedItems: ResolvedItem[] = body.items.map((raw: { id: string; qty: number }) => {
    const item = priceMap.get(raw.id)!;
    const qty = Math.trunc(Number(raw.qty));
    return { id: item.id, name: item.name, qty, priceCents: Math.round(Number(item.preis) * 100) * qty };
  });
  if (resolvedItems.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50 || item.priceCents < 0)) {
    return NextResponse.json({ error: 'Ungültige Bestellmenge' }, { status: 400, headers: CORS });
  }

  const amountCents = resolvedItems.reduce((sum, item) => sum + item.priceCents, 0);
  const requestedAmount = Math.round(Number(body.amountCents));
  if (amountCents < 50 || amountCents > 500_000 || requestedAmount !== amountCents) {
    return NextResponse.json({ error: 'Bestellsumme ist ungültig' }, { status: 400, headers: CORS });
  }

  return createIntent(svc, tenant, table, body, amountCents, resolvedItems);
}

async function createIntent(
  svc: ReturnType<typeof createServiceClient>,
  tenant: { id: string; name: string; stripe_connect_account_id: string; platform_fee_percent: number | null },
  table: TableRef,
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
      guest_name: guestName,
      guest_note: note,
      order_items_json: items,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? 'Order konnte nicht angelegt werden' }, { status: 500, headers: CORS });
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
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht angelegt werden' }, { status: 500, headers: CORS });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Stripe-Fehler' }, { status: 502, headers: CORS });
  }

  await svc.from('customer_orders').update({ payment_intent_id: paymentIntent.id }).eq('id', order.id);
  return NextResponse.json({ orderId: order.id, clientSecret: paymentIntent.client_secret, amountCents }, { headers: CORS });
}
