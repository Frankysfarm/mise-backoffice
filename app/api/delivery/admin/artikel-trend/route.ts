/**
 * GET /api/delivery/admin/artikel-trend?location_id=<uuid>
 *
 * Phase 842 — Gericht-Popularität-Trend
 * Vergleicht Bestellmengen je Artikel heute vs. gleicher Wochentag letzte Woche.
 * Ampel: gruen >+5%, amber ±5%, rot <-5%.
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
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(todayEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  const [todayRes, lastWeekRes] = await Promise.all([
    sb
      .from('order_items')
      .select('name, menge')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString()),
    sb
      .from('order_items')
      .select('name, menge')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekStart.toISOString())
      .lte('created_at', lastWeekEnd.toISOString()),
  ]);

  const aggregate = (rows: { name: string; menge: number }[] | null) => {
    const map: Record<string, number> = {};
    for (const r of rows ?? []) {
      map[r.name] = (map[r.name] ?? 0) + (r.menge ?? 1);
    }
    return map;
  };

  const todayMap = aggregate(todayRes.data as any);
  const lastWeekMap = aggregate(lastWeekRes.data as any);

  const allNames = Array.from(new Set([...Object.keys(todayMap), ...Object.keys(lastWeekMap)]));

  const artikel = allNames
    .map(name => {
      const heute = todayMap[name] ?? 0;
      const vorwoche = lastWeekMap[name] ?? 0;
      const delta_pct = vorwoche === 0 ? (heute > 0 ? 100 : 0) : Math.round(((heute - vorwoche) / vorwoche) * 100);
      const ampel: 'gruen' | 'amber' | 'rot' = delta_pct > 5 ? 'gruen' : delta_pct < -5 ? 'rot' : 'amber';
      return { name, heute, vorwoche, delta_pct, ampel };
    })
    .filter(a => a.heute > 0 || a.vorwoche > 0)
    .sort((a, b) => b.heute - a.heute)
    .slice(0, 8);

  return NextResponse.json({ artikel, generatedAt: new Date().toISOString() });
}
