/**
 * GET /api/delivery/admin/liefer-qualitaet-siegel?location_id=<uuid>
 *
 * Aggregiert heutige Lieferqualität für das Storefront-Siegel (Phase 903).
 * Gibt puenktlichkeit_pct, lieferungen_heute und avg_lieferzeit_min zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = await createClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Fetch today's quality scores for this location
  const { data: rows } = await sb
    .from('liefer_qualitaet')
    .select('score, komponenten, berechnet_am, order_id')
    .eq('location_id', locationId)
    .gte('berechnet_am', todayStart.toISOString());

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      puenktlichkeit_pct: 0,
      lieferungen_heute: 0,
      avg_lieferzeit_min: null,
      generatedAt: new Date().toISOString(),
    });
  }

  // Compute average punctuality from komponenten.puenktlichkeit (0–100)
  type KompRow = { score: number; komponenten: { puenktlichkeit?: number | null } | null; order_id: string };
  const typedRows = rows as KompRow[];

  const punctValues = typedRows
    .map(r => r.komponenten?.puenktlichkeit)
    .filter((v): v is number => v != null && !isNaN(v));

  const puenktlichkeit_pct = punctValues.length > 0
    ? Math.round(punctValues.reduce((a, b) => a + b, 0) / punctValues.length)
    : 0;

  // Compute avg delivery time from customer_orders for today's delivered orders
  const orderIds = typedRows.map(r => r.order_id).filter(Boolean);
  let avg_lieferzeit_min: number | null = null;

  if (orderIds.length > 0) {
    const { data: orders } = await sb
      .from('customer_orders')
      .select('created_at, delivered_at')
      .in('id', orderIds)
      .not('delivered_at', 'is', null);

    if (orders && orders.length > 0) {
      const times = orders
        .map(o => {
          if (!o.delivered_at || !o.created_at) return null;
          return (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
        })
        .filter((t): t is number => t != null && t > 0 && t < 180);

      if (times.length > 0) {
        avg_lieferzeit_min = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }
    }
  }

  return NextResponse.json({
    puenktlichkeit_pct,
    lieferungen_heute: rows.length,
    avg_lieferzeit_min,
    generatedAt: new Date().toISOString(),
  });
}
