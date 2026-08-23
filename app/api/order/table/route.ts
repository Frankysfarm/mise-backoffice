import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  resolveTableOrderItem,
  roundMoney,
  type ResolvedTableOrderItem,
} from '@/lib/orders/table-order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type MenuItemRow = {
  id: string;
  name: string;
  preis: number;
  option_groups: unknown;
};

type AtomicOrderRow = {
  order_id: string;
  order_number: string;
  status_token: string;
  was_created: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? '').trim();
  const tableId = String(body?.tableId ?? '').trim();
  const idempotencyKey = String(req.headers.get('idempotency-key') ?? body?.idempotencyKey ?? '').trim();
  const paymentMethod = body?.paymentMethod;
  if (!token || token.length > 200 || !tableId || !Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'Tisch-Token und Artikel sind Pflicht' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  if (!UUID_RE.test(idempotencyKey)) {
    return NextResponse.json(
      { error: 'Ungültiger Wiederholungsschutz' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  if (body.items.length > 100 || !['bar', 'karte'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Ungültige Bestellung' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const svc = createServiceClient();
  const { data: table } = await svc
    .from('restaurant_tables')
    .select('id,nummer,tenant_id,location_id,qr_token,aktiv')
    .eq('id', tableId)
    .maybeSingle();
  if (!table?.aktiv) {
    return NextResponse.json({ error: 'Tisch nicht gefunden' }, { status: 404, headers: PRIVATE_HEADERS });
  }

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
  if (!tokenValid) {
    return NextResponse.json({ error: 'Tisch-Token ungültig' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const requestedIds = [...new Set(
    body.items
      .map((item: { id?: unknown }) => String(item?.id ?? ''))
      .filter(Boolean),
  )];
  if (requestedIds.length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Artikel' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const { data: menuItems } = await svc
    .from('menu_items')
    .select('id,name,preis,option_groups')
    .in('id', requestedIds)
    .eq('tenant_id', table.tenant_id)
    .eq('location_id', table.location_id)
    .eq('verfuegbar', true);
  if (!menuItems || menuItems.length !== requestedIds.length) {
    return NextResponse.json(
      { error: 'Bestellpositionen sind nicht verfügbar' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ungültige Bestellung' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const total = roundMoney(resolved.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  if (total < 0.5 || total > 5_000) {
    return NextResponse.json(
      { error: 'Bestellsumme ist ungültig' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const rpcItems = resolved.map((item, index) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    note: item.note,
    selections: body.items[index]?.selections ?? {},
  }));

  const { data, error } = await svc.rpc('create_table_order_atomic', {
    p_tenant_id: table.tenant_id,
    p_location_id: table.location_id,
    p_table_id: table.id,
    p_payment_method: paymentMethod,
    p_total: total,
    p_items: rpcItems,
    p_idempotency_key: idempotencyKey,
  });
  const order = (Array.isArray(data) ? data[0] : data) as AtomicOrderRow | null;
  if (error || !order) {
    console.error('create_table_order_atomic failed', { code: error?.code ?? 'missing_result' });
    const isRateLimited = error?.message?.includes('Too many table orders');
    return NextResponse.json(
      {
        error: isRateLimited
          ? 'Zu viele Bestellungen in kurzer Zeit. Bitte einen Moment warten.'
          : 'Bestellung konnte nicht angelegt werden',
      },
      { status: isRateLimited ? 429 : 500, headers: PRIVATE_HEADERS },
    );
  }

  return NextResponse.json({
    orderId: order.order_id,
    orderNumber: order.order_number,
    trackingToken: order.status_token,
    amountCents: Math.round(total * 100),
    idempotent: !order.was_created,
  }, {
    status: order.was_created ? 201 : 200,
    headers: PRIVATE_HEADERS,
  });
}
