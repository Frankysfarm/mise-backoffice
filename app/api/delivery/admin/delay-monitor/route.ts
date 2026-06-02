/**
 * GET  /api/delivery/admin/delay-monitor
 *   ?location_id=...&limit=N
 *   → Aktuelle verspätete Bestellungen + Kompensations-Gutscheine
 *
 * POST /api/delivery/admin/delay-monitor
 *   { location_id }
 *   → Manueller Delay-Monitor-Scan für eine Location
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  scanDelayedOrders,
  runDelayMonitor,
  getCompensationVouchers,
} from '@/lib/delivery/delay-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const [delayed, vouchers] = await Promise.all([
      scanDelayedOrders(locationId),
      getCompensationVouchers(locationId, limit),
    ]);

    const summary = {
      total_delayed: delayed.length,
      pending_first_notice: delayed.filter(o => o.delayMinutes >= 15 && !o.firstNoticeSent).length,
      pending_critical:     delayed.filter(o => o.delayMinutes >= 30 && !o.criticalNoticeSent).length,
      pending_voucher:      delayed.filter(o => o.delayMinutes >= 30 && !o.voucherCreated).length,
      max_delay_minutes:    delayed.length > 0 ? Math.max(...delayed.map(o => o.delayMinutes)) : 0,
    };

    return NextResponse.json({
      summary,
      delayed_orders: delayed,
      vouchers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const locationId = body.location_id;
  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  const start = Date.now();
  try {
    const result = await runDelayMonitor(locationId);
    return NextResponse.json({
      ok: true,
      duration_ms: Date.now() - start,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
