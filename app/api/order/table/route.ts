import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  resolveTableOrderItem,
  roundMoney,
  type ResolvedTableOrderItem,
} from '@/lib/orders/table-order';
import { getValidTableSession, isSameOriginRequest } from '@/lib/orders/table-session';
import { computePlatformFeeCents, getStripe, PLATFORM_FEE_BPS_DEFAULT } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MenuItemRow = {
  id: string;
  name: string;
  preis: number;
  option_groups: unknown;
  category_id: string | null;
  kds_station_id: string | null;
};

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const tableId = String(body?.tableId ?? '').trim();
  const paymentMethod = body?.paymentMethod;
  if (!tableId || !Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Tisch und Artikel sind Pflicht' }, { status: 400 });
  }
  if (body.items.length > 100 || !['service', 'online'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Ungültige Bestellung' }, { status: 400 });
  }

  const session = await getValidTableSession(req, tableId);
  if (!session) {
    return NextResponse.json({ error: 'Tischsitzung ist abgelaufen. Bitte QR-Code erneut scannen.' }, { status: 401 });
  }
  if (session.status === 'wartet_auf_bestaetigung') {
    return NextResponse.json({ error: 'Der Service muss diesen Tisch zuerst bestätigen.' }, { status: 409 });
  }
  if (session.order_count >= 20) {
    return NextResponse.json({ error: 'Bestelllimit dieser Tischsitzung erreicht. Bitte Service rufen.' }, { status: 429 });
  }

  const svc = createServiceClient();
  const { data: table } = await svc
    .from('restaurant_tables')
    .select('id,nummer,tenant_id,location_id,qr_token,qr_version,qr_disabled_at,aktiv,status')
    .eq('id', tableId)
    .eq('tenant_id', session.tenant_id)
    .eq('location_id', session.location_id)
    .eq('qr_version', session.qr_version)
    .maybeSingle();
  if (!table?.aktiv || table.qr_disabled_at || table.status === 'gesperrt') {
    return NextResponse.json({ error: 'Tisch ist nicht aktiv' }, { status: 409 });
  }

  const requestedIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item?.id ?? '')).filter(Boolean))];
  if (requestedIds.length === 0) return NextResponse.json({ error: 'Keine gültigen Artikel' }, { status: 400 });
  const { data: menuItems } = await svc
    .from('menu_items')
    .select('id,name,preis,option_groups,category_id,kds_station_id')
    .in('id', requestedIds)
    .eq('tenant_id', table.tenant_id)
    .eq('location_id', table.location_id)
    .eq('verfuegbar', true);
  if (!menuItems || menuItems.length !== requestedIds.length) {
    return NextResponse.json({ error: 'Bestellpositionen sind nicht verfügbar' }, { status: 400 });
  }

  const itemMap = new Map((menuItems as MenuItemRow[]).map((item) => [item.id, item]));
  let resolved: ResolvedTableOrderItem[];
  try {
    resolved = body.items.map((raw: { id?: unknown; qty?: unknown; selections?: unknown; note?: unknown }) => {
      const item = itemMap.get(String(raw.id ?? ''));
      if (!item) throw new Error('Artikel ist nicht verfügbar');
      return resolveTableOrderItem({
        item: { id: item.id, name: item.name, price: item.preis, optionGroups: item.option_groups },
        quantity: raw.qty,
        selections: raw.selections,
        note: raw.note,
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ungültige Bestellung' }, { status: 400 });
  }

  const total = roundMoney(resolved.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  if (total < 0.5 || total > 5_000) {
    return NextResponse.json({ error: 'Bestellsumme ist ungültig' }, { status: 400 });
  }

  const categoryIds = [...new Set((menuItems as MenuItemRow[])
    .filter((item) => !item.kds_station_id && item.category_id)
    .map((item) => item.category_id as string))];
  const { data: stationRoutes } = categoryIds.length
    ? await svc.from('station_category_routing').select('category_id,station_id').in('category_id', categoryIds)
    : { data: [] as { category_id: string; station_id: string }[] };
  const stationByCategory = new Map((stationRoutes ?? []).map((route) => [route.category_id, route.station_id]));

  const isOnline = paymentMethod === 'online';
  let tenantPayment: {
    name: string;
    slug: string;
    stripe_connect_account_id: string | null;
    stripe_connect_charges_enabled: boolean | null;
    platform_fee_percent: number | null;
  } | null = null;
  if (isOnline) {
    const { data } = await svc.from('tenants')
      .select('name,slug,stripe_connect_account_id,stripe_connect_charges_enabled,platform_fee_percent')
      .eq('id', table.tenant_id).maybeSingle();
    tenantPayment = data;
    if (!getStripe() || !tenantPayment?.stripe_connect_account_id || !tenantPayment.stripe_connect_charges_enabled) {
      return NextResponse.json({ error: 'Online-Zahlung ist für diesen Betrieb nicht aktiviert.' }, { status: 400 });
    }
  }

  const reservedOrderCount = session.order_count + 1;
  const { data: claimedSession } = await svc.from('table_sessions')
    .update({ order_count: reservedOrderCount, last_activity_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'aktiv')
    .eq('order_count', session.order_count)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();
  if (!claimedSession) {
    return NextResponse.json({ error: 'Die Tischsitzung wurde parallel geändert. Bitte erneut versuchen.' }, { status: 409 });
  }
  const releaseSessionReservation = () => svc.from('table_sessions')
    .update({ order_count: session.order_count, last_activity_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('order_count', reservedOrderCount);

  const { data: order, error: orderError } = await svc
    .from('customer_orders')
    .insert({
      tenant_id: table.tenant_id,
      location_id: table.location_id,
      tisch_id: table.id,
      table_session_id: session.id,
      typ: 'vor_ort',
      status: isOnline ? 'wartet_auf_zahlung' : 'neu',
      kunde_name: `Tisch ${table.nummer}`,
      zwischensumme: total,
      gesamtbetrag: total,
      zahlungsart: isOnline ? 'karte' : 'vor_ort',
      bezahlt: false,
      bestellt_am: new Date().toISOString(),
      geschaetzte_zubereitung_min: Math.max(10, resolved.length * 3),
      order_channel: 'tisch',
      payment_status: isOnline ? 'pending_payment' : 'cash_pending',
      payment_method: isOnline ? 'card' : 'service',
      amount_total_cents: Math.round(total * 100),
      table_number: table.nummer,
      order_items_json: resolved.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.quantity,
        priceCents: Math.round(item.unitPrice * 100) * item.quantity,
      })),
    })
    .select('id,bestellnummer,tracking_token')
    .single();
  if (orderError || !order) {
    await releaseSessionReservation();
    return NextResponse.json({ error: 'Bestellung konnte nicht angelegt werden' }, { status: 500 });
  }

  const rawByIndex = body.items as { selections?: unknown }[];
  const { error: itemError } = await svc.from('order_items').insert(resolved.map((item, index) => {
    const source = itemMap.get(item.id);
    return {
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      menge: item.quantity,
      einzelpreis: item.unitPrice,
      gesamtpreis: roundMoney(item.unitPrice * item.quantity),
      notiz: item.note,
      extras: rawByIndex[index]?.selections ?? {},
      station_id: source?.kds_station_id ?? (source?.category_id ? stationByCategory.get(source.category_id) ?? null : null),
      station_status: 'offen',
    };
  }));
  if (itemError) {
    await svc.from('customer_orders').delete().eq('id', order.id);
    await releaseSessionReservation();
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht angelegt werden' }, { status: 500 });
  }

  if (isOnline && tenantPayment) {
    const stripe = getStripe()!;
    const amountCents = Math.round(total * 100);
    const feePercent = Number(tenantPayment.platform_fee_percent ?? (PLATFORM_FEE_BPS_DEFAULT / 100));
    try {
      const checkout = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: resolved.map((item) => ({
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(item.unitPrice * 100),
            product_data: { name: item.name },
          },
          quantity: item.quantity,
        })),
        payment_intent_data: {
          application_fee_amount: computePlatformFeeCents(amountCents, feePercent),
          transfer_data: { destination: tenantPayment.stripe_connect_account_id! },
          on_behalf_of: tenantPayment.stripe_connect_account_id!,
          metadata: { order_id: order.id, tenant_id: table.tenant_id, table_id: table.id },
        },
        metadata: { order_id: order.id, tenant_id: table.tenant_id, table_id: table.id },
        success_url: `${req.nextUrl.origin}/order/paid?session_id={CHECKOUT_SESSION_ID}&bon=${encodeURIComponent(order.bestellnummer)}`,
        cancel_url: `${req.nextUrl.origin}/t/${encodeURIComponent(table.qr_token)}?payment=cancelled`,
        locale: 'de',
      }, { idempotencyKey: `table-order-${order.id}` });
      await Promise.all([
        svc.from('customer_orders').update({ stripe_payment_id: checkout.id }).eq('id', order.id),
        svc.from('table_order_events').insert({
          tenant_id: table.tenant_id,
          order_id: order.id,
          event_type: 'order_created',
          from_status: null,
          to_status: 'wartet_auf_zahlung',
          metadata: { tableId: table.id, paymentMethod, sessionId: session.id },
        }),
        svc.from('restaurant_tables').update({ status: 'belegt' }).eq('id', table.id),
      ]);
      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.bestellnummer,
        trackingToken: order.tracking_token,
        checkoutUrl: checkout.url,
      }, { status: 201 });
    } catch (error) {
      await svc.from('customer_orders').delete().eq('id', order.id);
      await releaseSessionReservation();
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Online-Zahlung konnte nicht gestartet werden.',
      }, { status: 502 });
    }
  }

  await Promise.all([
    svc.from('table_order_events').insert({
      tenant_id: table.tenant_id,
      order_id: order.id,
      event_type: 'order_created',
      from_status: null,
      to_status: 'neu',
      metadata: { tableId: table.id, paymentMethod, sessionId: session.id },
    }),
    svc.from('restaurant_tables').update({ status: 'belegt' }).eq('id', table.id),
  ]);

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.bestellnummer,
    trackingToken: order.tracking_token,
    amountCents: Math.round(total * 100),
  }, { status: 201 });
}
