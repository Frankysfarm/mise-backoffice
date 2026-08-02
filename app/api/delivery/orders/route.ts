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
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { validateRequestedItems } from '@/lib/delivery/storefront-order-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }
  const body = rawBody as {
    location_id?: string;
    items?: unknown;
    customer?: { name?: string; phone?: string; address?: string };
    type?: string;
    payment_method?: string;
  };

  const { location_id, items, customer, type, payment_method } = body;

  if (!location_id || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: 'location_id, items, customer.name und customer.phone sind erforderlich' }, { status: 400 });
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const customerName = typeof customer.name === 'string' ? customer.name.trim() : '';
  const customerPhone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
  const customerAddress = typeof customer.address === 'string' ? customer.address.trim() : '';
  if (!uuidPattern.test(location_id) || !customerName || customerName.length > 120 || !customerPhone || customerPhone.length > 64) {
    return NextResponse.json({ error: 'INVALID_ORDER_CUSTOMER_OR_LOCATION' }, { status: 400 });
  }
  if ((type !== 'lieferung' && type !== 'abholung') || (payment_method !== 'bar' && payment_method !== 'karte')) {
    return NextResponse.json({ error: 'INVALID_ORDER_TYPE_OR_PAYMENT' }, { status: 400 });
  }
  if (type === 'lieferung' && (!customerAddress || customerAddress.length > 500)) {
    return NextResponse.json({ error: 'DELIVERY_ADDRESS_REQUIRED' }, { status: 400 });
  }

  const sb = createServiceClient();
  const requested = validateRequestedItems(items);
  if (!requested.ok) return NextResponse.json({ error: requested.reason }, { status: 400 });
  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: 'VALID_IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
  }
  const normalized = {
    location_id,
    items: requested.items,
    customer: { name: customerName, phone: customerPhone, address: customerAddress || null },
    type,
    payment_method,
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const { data, error: rpcError } = await sb.rpc('fn_storefront_create_order_v1', {
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: fingerprint,
    p_location_id: location_id,
    p_items: requested.items,
    p_customer_name: normalized.customer.name,
    p_customer_phone: normalized.customer.phone,
    p_customer_address: normalized.customer.address,
    p_type: normalized.type,
    p_payment_method: normalized.payment_method,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
  const result = data as { ok?: boolean; reason_code?: string; id?: string; bestellnummer?: string; status?: string; idempotent_replay?: boolean } | null;
  if (!result?.ok) return NextResponse.json({ error: result?.reason_code ?? 'ORDER_REJECTED' }, { status: result?.reason_code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400 });

  return NextResponse.json(
    {
      id: result.id,
      order_id: result.id,
      bestellnummer: result.bestellnummer,
      status: result.status,
      idempotent_replay: result.idempotent_replay === true,
    },
    { status: result.idempotent_replay ? 200 : 201 },
  );
}
