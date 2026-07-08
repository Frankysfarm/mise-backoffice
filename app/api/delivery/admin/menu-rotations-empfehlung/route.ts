/**
 * GET /api/delivery/admin/menu-rotations-empfehlung?location_id=<uuid>
 *
 * Phase 712 — Menü-Rotations-Empfehlung
 * Welche Gerichte haben heute hohes Zubereitungszeit/Bestellvolumen-Verhältnis?
 * Effizienz-Score = bestellungen / avg_zubereitungszeit_min × 10
 * Empfehlung: depriorisieren (<20), beobachten (<40), ok (≥40)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
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
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Fetch today's order items
  const { data: orderItems } = await sb
    .from('order_items')
    .select('name, quantity, prep_time_min')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString());

  if (!orderItems || orderItems.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Aggregate per item name
  const itemMap: Record<string, { count: number; totalPrepMin: number; prepCount: number }> = {};

  for (const item of orderItems) {
    const name = item.name ?? 'Unbekannt';
    if (!itemMap[name]) itemMap[name] = { count: 0, totalPrepMin: 0, prepCount: 0 };
    itemMap[name].count += item.quantity ?? 1;
    if (item.prep_time_min) {
      itemMap[name].totalPrepMin += item.prep_time_min;
      itemMap[name].prepCount += 1;
    }
  }

  const items = Object.entries(itemMap).map(([name, agg]) => {
    const avgPrepMin = agg.prepCount > 0
      ? Math.round(agg.totalPrepMin / agg.prepCount)
      : 15; // default 15 min if no prep time recorded
    const effScore = Math.round((agg.count / avgPrepMin) * 10);
    return {
      name,
      bestellungen: agg.count,
      avg_zubereitungszeit_min: avgPrepMin,
      effizienz_score: effScore,
      empfehlung: effScore < 20
        ? ('depriorisieren' as const)
        : effScore < 40
        ? ('beobachten' as const)
        : ('ok' as const),
    };
  });

  items.sort((a, b) => a.effizienz_score - b.effizienz_score);

  return NextResponse.json({ items });
}
