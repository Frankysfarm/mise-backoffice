import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  resolveTableOrderItem,
  roundMoney,
  type ResolvedTableOrderItem,
} from '@/lib/orders/table-order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MenuItemRow = {
  id: string;
  name: string;
  preis: number;
  option_groups: unknown;
};

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? '').trim();
  const tableId = String(body?.tableId ?? '').trim();
  const paymentMethod = body?.paymentMethod;
  if (!token || token.length > 200 || !tableId || !Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Tisch-Token und Artikel sind Pflicht' }, { status: 400 });
  }
  if (body.items.length > 100 || !['bar', 'karte'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Ungültige Bestellung' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: table } = await svc
    .from('restaurant_tables')
    .select('id,nummer,tenant_id,location_id,qr_token,aktiv')
    .eq('id', tableId)
    .maybeSingle();
  if (!table?.aktiv) return NextResponse.json({ error: 'Tisch nicht gefunden' }, { status: 404 });

  let tokenValid = table.qr_token === token;
  if (!tokenValid) {
    const { data: location } = await svc
      .from('locations')
      .select('id')
      .eq('id', table.location_id)
      .eq('tenant_id', table.tenant_id)
      .eq('universal_qr_token', token)
      .maybeSingle();
    tokenValid = Boolean(location);
  }
  if (!tokenValid) return NextResponse.json({ error: 'Tisch-Token ungültig' }, { status: 403 });

  const requestedIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item?.id ?? '')).filter(Boolean))];
  if (requestedIds.length === 0) return NextResponse.json({ error: 'Keine gültigen Artikel' }, { status: 400 });
  const { data: menuItems } = await svc
    .from('menu_items')
    .select('id,name,preis,option_groups')
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

  const { data: order, error: orderError } = await svc
    .from('customer_orders')
    .insert({
      tenant_id: table.tenant_id,
      location_id: table.location_id,
      tisch_id: table.id,
      typ: 'vor_ort',
      status: 'wartet_auf_zahlung',
      kunde_name: `Tisch ${table.nummer}`,
      zwischensumme: total,
      gesamtbetrag: total,
      zahlungsart: paymentMethod,
      bezahlt: false,
      bestellt_am: new Date().toISOString(),
      geschaetzte_zubereitung_min: Math.max(10, resolved.length * 3),
      order_channel: 'tisch',
      payment_status: 'pending_payment',
      amount_total_cents: Math.round(total * 100),
      table_number: table.nummer,
      order_items_json: resolved.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.quantity,
        priceCents: Math.round(item.unitPrice * 100) * item.quantity,
      })),
    })
    .select('id,bestellnummer')
    .single();
  if (orderError || !order) {
    return NextResponse.json({ error: 'Bestellung konnte nicht angelegt werden' }, { status: 500 });
  }

  const { error: itemError } = await svc.from('order_items').insert(resolved.map((item) => ({
    order_id: order.id,
    menu_item_id: item.id,
    name: item.name,
    menge: item.quantity,
    einzelpreis: item.unitPrice,
    gesamtpreis: roundMoney(item.unitPrice * item.quantity),
    notiz: item.note,
  })));
  if (itemError) {
    await svc.from('customer_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht angelegt werden' }, { status: 500 });
  }

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.bestellnummer,
    amountCents: Math.round(total * 100),
  }, { status: 201 });
}
