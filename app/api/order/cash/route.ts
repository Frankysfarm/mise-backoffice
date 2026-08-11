import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type CashItem = { name: string; qty: number; priceCents: number };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function normalizeTableNumber(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/^tisch\s*/i, '').replace(/^t(?=\d)/i, '');
}

function normalizeItems(value: unknown): CashItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const items = value.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      name: String(item.name ?? '').trim().slice(0, 200),
      qty: Math.trunc(Number(item.qty)),
      // Die Order-App sendet hier bereits den Gesamtpreis der Position.
      priceCents: Math.round(Number(item.priceCents)),
    };
  });
  if (items.some((item) => !item.name || item.qty < 1 || item.qty > 50 || item.priceCents < 0 || item.priceCents > 500_000)) {
    return null;
  }
  return items;
}

/** Erstellt eine Barzahlung am Tisch und übergibt sie an Küche und Staff-Display. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const items = normalizeItems(body?.items);
  if (!body?.tenant || !body?.table || !items) {
    return NextResponse.json({ error: 'tenant, table und gültige items sind Pflicht' }, { status: 400, headers: CORS });
  }

  const calculatedAmount = items.reduce((sum, item) => sum + item.priceCents, 0);
  const requestedAmount = Math.round(Number(body.amountCents));
  if (calculatedAmount < 1 || calculatedAmount > 500_000 || requestedAmount !== calculatedAmount) {
    return NextResponse.json({ error: 'Bestellsumme ist ungültig' }, { status: 400, headers: CORS });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc.from('tenants').select('id').eq('slug', String(body.tenant)).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: CORS });

  const { data: tenantTables } = await svc
    .from('restaurant_tables')
    .select('id,location_id,nummer')
    .eq('tenant_id', tenant.id)
    .eq('aktiv', true)
    .limit(500);
  const wantedTable = normalizeTableNumber(body.table);
  const matches = (tenantTables ?? []).filter((table) => normalizeTableNumber(table.nummer) === wantedTable);
  if (matches.length !== 1) {
    return NextResponse.json({ error: matches.length ? 'Tischnummer ist nicht eindeutig' : 'Aktiver Tisch nicht gefunden' }, { status: 404, headers: CORS });
  }
  const table = matches[0];
  const guestName = String(body.guestName ?? '').trim().slice(0, 120) || 'Gast';
  const note = String(body.note ?? '').trim().slice(0, 1000) || null;
  const amountEuro = calculatedAmount / 100;

  const { data: order, error } = await svc
    .from('customer_orders')
    .insert({
      tenant_id: tenant.id,
      location_id: table.location_id,
      tisch_id: table.id,
      typ: 'abholung',
      status: 'neu',
      kunde_name: guestName,
      kunde_notiz: note,
      zwischensumme: amountEuro,
      gesamtbetrag: amountEuro,
      zahlungsart: 'bar',
      bezahlt: false,
      order_channel: 'tisch',
      payment_status: 'cash_pending',
      payment_method: 'cash',
      amount_total_cents: calculatedAmount,
      table_number: table.nummer,
      guest_name: guestName,
      guest_note: note,
      order_items_json: items,
    })
    .select('id,bestellnummer')
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Order konnte nicht angelegt werden' }, { status: 500, headers: CORS });
  }

  const { error: itemError } = await svc.from('order_items').insert(items.map((item) => ({
    order_id: order.id,
    name: item.name,
    menge: item.qty,
    einzelpreis: item.priceCents / item.qty / 100,
  })));
  if (itemError) {
    await svc.from('customer_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Bestellpositionen konnten nicht angelegt werden' }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ orderId: order.id, orderNumber: order.bestellnummer, amountCents: calculatedAmount }, { headers: CORS });
}
