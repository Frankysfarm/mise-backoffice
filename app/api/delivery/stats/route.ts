/**
 * GET /api/delivery/stats?location_id=...&from=ISO&to=ISO
 * Liefer-Statistiken für das Admin-Dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const now = new Date();
  const fromStr = searchParams.get('from') ?? new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const toStr   = searchParams.get('to')   ?? now.toISOString();

  // Touren in Zeitraum (location-gefiltert via Migration 010)
  const { data: tours } = await sb
    .from('mise_delivery_batches')
    .select('id, state, zone, dispatch_score, total_distance_km, total_eta_min, stop_count, created_at')
    .eq('location_id', locationId)
    .gte('created_at', fromStr)
    .lte('created_at', toStr)
    .not('state', 'eq', 'cancelled');

  // Bestellungen in Zeitraum
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, delivery_zone, dispatch_score, status, eta_earliest, eta_latest, created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('created_at', fromStr)
    .lte('created_at', toStr);

  // Scoring-Schnitt
  const { data: scores } = await sb
    .from('dispatch_scores')
    .select('total_score, decision')
    .eq('location_id', locationId)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);

  const totalOrders = orders?.length ?? 0;
  const delivered = orders?.filter((o) => o.status === 'abgeschlossen' || o.status === 'geliefert').length ?? 0;
  const zoneBreakdown = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    const z = (o.delivery_zone as string) ?? 'unknown';
    acc[z] = (acc[z] ?? 0) + 1;
    return acc;
  }, {});

  const avgScore = scores && scores.length > 0
    ? scores.reduce((s, r) => s + (r.total_score as number), 0) / scores.length
    : null;

  const avgDistKm = tours && tours.length > 0
    ? tours.reduce((s, t) => s + ((t.total_distance_km as number) ?? 0), 0) / tours.length
    : null;

  const bundled = scores?.filter((s) => s.decision === 'bundled').length ?? 0;
  const held    = scores?.filter((s) => s.decision === 'hold').length ?? 0;

  return NextResponse.json({
    period: { from: fromStr, to: toStr },
    orders: {
      total:     totalOrders,
      delivered,
      held,
      zone_breakdown: zoneBreakdown,
    },
    tours: {
      total:          tours?.length ?? 0,
      bundled_count:  bundled,
      avg_distance_km: avgDistKm != null ? Math.round(avgDistKm * 10) / 10 : null,
      avg_eta_min:    tours && tours.length > 0
        ? Math.round(tours.reduce((s, t) => s + ((t.total_eta_min as number) ?? 0), 0) / tours.length)
        : null,
    },
    scoring: {
      avg_score: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      total_decisions: scores?.length ?? 0,
    },
  });
}
