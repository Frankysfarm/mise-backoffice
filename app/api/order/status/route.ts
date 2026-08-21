import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function OPTIONS() {
  // This endpoint is same-origin only. No permissive CORS capability is
  // advertised to third-party websites.
  return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
}

/** Public status capability bound to the dedicated tracking token, not the DB id alone. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const token = req.nextUrl.searchParams.get('token');
  if (!id || !token) return NextResponse.json({ error: 'id und token fehlen' }, { status: 400, headers: PRIVATE_HEADERS });

  const svc = createServiceClient();
  const { data } = await svc
    .from('customer_orders')
    .select('id,payment_status,amount_total_cents,table_number,status')
    .eq('id', id)
    .eq('tracking_token', token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404, headers: PRIVATE_HEADERS });
  return NextResponse.json({
    paymentStatus: data.payment_status,
    orderStatus: data.status,
    amountCents: data.amount_total_cents,
    table: data.table_number,
  }, { headers: PRIVATE_HEADERS });
}

/** Statuswechsel aus dem Staff-Display; geschützt mit dem Kitchen-Token. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.id ?? '');
  const tenantSlug = String(body?.tenant ?? '');
  const token = String(body?.token ?? '');
  const nextStatus = String(body?.status ?? '');
  const allowedTargets = new Set(['in_zubereitung', 'fertig', 'abgeholt']);
  if (!orderId || !tenantSlug || !token || !allowedTargets.has(nextStatus)) {
    return NextResponse.json({ error: 'Ungültige Statusanfrage' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: PRIVATE_HEADERS });

  const { data: settings } = await svc
    .from('tenant_payment_settings')
    .select('kitchen_token')
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (!settings || settings.kitchen_token !== token) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const { data: order } = await svc
    .from('customer_orders')
    .select('id,status')
    .eq('id', orderId)
    .eq('tenant_id', tenant.id)
    .eq('order_channel', 'tisch')
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404, headers: PRIVATE_HEADERS });

  const transitions: Record<string, string[]> = {
    neu: ['in_zubereitung'],
    'bestätigt': ['in_zubereitung'],
    in_zubereitung: ['fertig'],
    fertig: ['abgeholt'],
  };
  if (!transitions[order.status]?.includes(nextStatus)) {
    return NextResponse.json({ error: `Statuswechsel ${order.status} → ${nextStatus} ist nicht erlaubt` }, { status: 409, headers: PRIVATE_HEADERS });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'in_zubereitung') patch.zubereitung_start = now;
  if (nextStatus === 'fertig') patch.fertig_am = now;
  if (nextStatus === 'abgeholt') {
    patch.abgeholt_am = now;
    patch.bezahlt = true;
    patch.payment_status = 'paid';
    patch.paid_at = now;
  }

  const { error } = await svc.from('customer_orders').update(patch).eq('id', order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: PRIVATE_HEADERS });
  return NextResponse.json({ ok: true, status: nextStatus }, { headers: PRIVATE_HEADERS });
}
