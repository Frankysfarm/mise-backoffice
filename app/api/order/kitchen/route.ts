import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/order/kitchen?t=<tenant-slug>&token=<kitchen_token>
 *
 * Liefert alle aktiven Tischbestellungen für das Küchen-Display.
 * Auth: kitchen_token aus tenant_payment_settings (shared secret für Küchentablet).
 * Zeigt nur payment_status IN (paid, cash_pending).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('t');
  const token = req.nextUrl.searchParams.get('token');

  if (!slug || !token) {
    return NextResponse.json({ error: 't und token sind Pflicht' }, { status: 400, headers: CORS });
  }

  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404, headers: CORS });

  // Token prüfen
  const { data: settings } = await svc
    .from('tenant_payment_settings')
    .select('kitchen_token')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (!settings || settings.kitchen_token !== token) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401, headers: CORS });
  }

  // Letzte 4 Stunden, nur Tisch-Channel, nur sichtbare Stati
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await svc
    .from('customer_orders')
    .select('id,bestellnummer,table_number,guest_name,guest_note,order_items_json,amount_total_cents,payment_status,payment_method,status,created_at')
    .eq('tenant_id', tenant.id)
    .eq('order_channel', 'tisch')
    .in('payment_status', ['paid', 'cash_pending'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(60);

  return NextResponse.json({ orders: orders ?? [] }, { headers: CORS });
}
