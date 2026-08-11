import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Öffentlicher Zahlungsstatus; die zufällige Order-UUID dient als Capability. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400, headers: CORS });

  const svc = createServiceClient();
  const { data } = await svc
    .from('customer_orders')
    .select('id,payment_status,amount_total_cents,table_number,status')
    .eq('id', id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404, headers: CORS });
  return NextResponse.json({
    paymentStatus: data.payment_status,
    orderStatus: data.status,
    amountCents: data.amount_total_cents,
    table: data.table_number,
  }, { headers: CORS });
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
    return NextResponse.json({ error: 'Ungültige Statusanfrage' }, { status: 400, headers: CORS });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: CORS });

  const { data: settings } = await svc
    .from('tenant_payment_settings')
    .select('kitchen_token')
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (!settings || settings.kitchen_token !== token) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401, headers: CORS });
  }

  const { data: order } = await svc
    .from('customer_orders')
    .select('id,status')
    .eq('id', orderId)
    .eq('tenant_id', tenant.id)
    .eq('order_channel', 'tisch')
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404, headers: CORS });

  const transitions: Record<string, string[]> = {
    neu: ['in_zubereitung'],
    'bestätigt': ['in_zubereitung'],
    in_zubereitung: ['fertig'],
    fertig: ['abgeholt'],
  };
  if (!transitions[order.status]?.includes(nextStatus)) {
    return NextResponse.json({ error: `Statuswechsel ${order.status} → ${nextStatus} ist nicht erlaubt` }, { status: 409, headers: CORS });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true, status: nextStatus }, { headers: CORS });
}
