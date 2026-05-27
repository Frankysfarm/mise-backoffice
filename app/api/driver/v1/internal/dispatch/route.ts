import { NextRequest, NextResponse } from 'next/server';
import { sb } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  order_id?: string;       // optional — sonst nimmt's irgendeine offene Lieferungs-Order
  internal_token?: string; // Schutz: muss mit BISS_INTERNAL_TOKEN matchen
}

/**
 * POST /api/driver/v1/_test/dispatch
 *
 * NUR für Entwicklung/E2E-Testing.
 * Triggered Frank manuell für eine Test-Order.
 * In Production via NODE_ENV-Check deaktivierbar.
 *
 * Schutz: Internal-Token (BISS_INTERNAL_TOKEN aus mise-backoffice .env)
 * im Body oder Header.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const expected = process.env.BISS_INTERNAL_TOKEN;
  const provided = body.internal_token ?? req.headers.get('x-internal-token');
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { error: 'BISS_INTERNAL_TOKEN nicht konfiguriert' },
      { status: 500 },
    );
  }
  if (provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const c = sb();
  let orderId = body.order_id;
  if (!orderId) {
    const { data: open } = await c
      .from('customer_orders')
      .select('id')
      .eq('typ', 'lieferung')
      .is('mise_driver_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!open) {
      return NextResponse.json(
        { error: 'Keine offene Lieferungs-Order gefunden' },
        { status: 404 },
      );
    }
    orderId = open.id;
  }

  // Frank rufen
  const { data, error } = await c.rpc('fn_frank_assign_nearest_driver', {
    p_order_id: orderId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    order_id: orderId,
    batch_id: data,
    assigned: data !== null,
  });
}
