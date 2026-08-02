/**
 * POST /api/delivery/orders
 *
 * Öffentlicher Checkout-Endpoint für die Kunden-Storefront (/biss-app).
 * Legt eine neue Bestellung in customer_orders + order_items an.
 *
 * Body:
 *   location_id   — UUID der Filiale
 *   items         — [{ id, name, qty, price }]
 *   customer      — { name, phone, address }
 *   type          — 'lieferung' | 'abholung'
 *   payment_method — 'bar' | 'karte'
 *
 * Response 201: { id, order_id, bestellnummer, status }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { canonicalizeStorefrontItems, validateRequestedItems } from '@/lib/delivery/storefront-order-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: {
    location_id?: string;
    items?: unknown;
    customer?: { name?: string; phone?: string; address?: string };
    type?: string;
    payment_method?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { location_id, items, customer, type, payment_method } = body;

  if (!location_id || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: 'location_id, items, customer.name und customer.phone sind erforderlich' }, { status: 400 });
  }

  const sb = createServiceClient();
  const requested = validateRequestedItems(items);
  if (!requested.ok) return NextResponse.json({ error: requested.reason }, { status: 400 });

  const { data: catalogRows, error: catalogError } = await sb
    .from('menu_items')
    .select('id,name,preis,location_id,verfuegbar')
    .in('id', requested.items.map((item) => item.id))
    .eq('location_id', location_id)
    .eq('verfuegbar', true);
  if (catalogError) return NextResponse.json({ error: 'Artikelkatalog konnte nicht geprüft werden' }, { status: 500 });
  const canonical = canonicalizeStorefrontItems(requested.items, (catalogRows ?? []) as any[], location_id);
  if (!canonical.ok) return NextResponse.json({ error: canonical.reason }, { status: 400 });

  const zwischensumme = canonical.items.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: order, error: orderErr } = await sb
    .from('customer_orders')
    .insert({
      location_id,
      typ: type === 'abholung' ? 'abholung' : 'lieferung',
      status: 'neu',
      kunde_name: customer.name,
      kunde_telefon: customer.phone,
      kunde_adresse: customer.address ?? null,
      zwischensumme,
      gesamtbetrag: zwischensumme,
      zahlungsart: payment_method === 'karte' ? 'karte' : 'bar',
      bezahlt: false,
      quelle: 'storefront',
    })
    .select('id, bestellnummer, status')
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message ?? 'Bestellung konnte nicht erstellt werden' }, { status: 500 });
  }

  const rows = canonical.items.map((i, idx) => ({
    order_id: (order as { id: string }).id,
    location_id,
    menu_item_id: i.id,
    name: i.name,
    menge: i.qty,
    einzelpreis: i.price,
    gesamtpreis: i.price * i.qty,
    position: idx + 1,
  }));

  const { error: itemsErr } = await sb.from('order_items').insert(rows);

  if (itemsErr) {
    await sb.from('customer_orders').delete().eq('id', (order as { id: string }).id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: (order as { id: string; bestellnummer: string; status: string }).id,
      order_id: (order as { id: string }).id,
      bestellnummer: (order as { bestellnummer: string }).bestellnummer,
      status: (order as { status: string }).status,
    },
    { status: 201 },
  );
}
