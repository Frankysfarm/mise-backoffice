/**
 * GET /api/delivery/admin/lieferzonen-erloes-trend?location_id=<uuid>
 *
 * Phase 871 — Lieferzonen-Erlös-Trend-API
 * Tages-Erlös je Zone A/B/C/D letzte 7 Tage als Trend-Chart-Daten.
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

interface ZoneTrendDay {
  datum: string;
  zone_a: number;
  zone_b: number;
  zone_c: number;
  zone_d: number;
}

interface StopRow {
  created_at: string;
  zone: string | null;
  delivery_fee: number | null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const { data: stops } = await sb
    .from('delivery_stops')
    .select('created_at, zone, delivery_fee')
    .eq('location_id', locationId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .in('status', ['delivered', 'completed'])
    .not('delivery_fee', 'is', null);

  // Build a map: date-string -> { A, B, C, D }
  const dayMap = new Map<string, Record<string, number>>();

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { A: 0, B: 0, C: 0, D: 0 });
  }

  for (const stop of (stops as StopRow[] | null) ?? []) {
    const key = stop.created_at.slice(0, 10);
    const bucket = dayMap.get(key);
    if (!bucket) continue;
    const zone = (stop.zone ?? '').toUpperCase();
    const fee = stop.delivery_fee ?? 0;
    if (zone === 'A' || zone === 'B' || zone === 'C' || zone === 'D') {
      bucket[zone] = parseFloat(((bucket[zone] ?? 0) + fee).toFixed(2));
    } else {
      // unknown zone → distribute evenly
      bucket['A'] = parseFloat(((bucket['A'] ?? 0) + fee / 4).toFixed(2));
    }
  }

  const trend: ZoneTrendDay[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, z]) => ({
      datum,
      zone_a: z.A,
      zone_b: z.B,
      zone_c: z.C,
      zone_d: z.D,
    }));

  // Summary totals
  const totals = trend.reduce(
    (acc, d) => ({
      A: parseFloat((acc.A + d.zone_a).toFixed(2)),
      B: parseFloat((acc.B + d.zone_b).toFixed(2)),
      C: parseFloat((acc.C + d.zone_c).toFixed(2)),
      D: parseFloat((acc.D + d.zone_d).toFixed(2)),
    }),
    { A: 0, B: 0, C: 0, D: 0 }
  );

  // Trend direction for each zone: compare last 3 days vs previous 3 days
  const firstHalf = trend.slice(0, 3);
  const secondHalf = trend.slice(4, 7);
  const trendDir = (['A', 'B', 'C', 'D'] as const).reduce((acc, z) => {
    const key = `zone_${z.toLowerCase()}` as keyof ZoneTrendDay;
    const avg1 = firstHalf.reduce((s, d) => s + (d[key] as number), 0) / 3;
    const avg2 = secondHalf.reduce((s, d) => s + (d[key] as number), 0) / 3;
    acc[z] = avg2 > avg1 * 1.05 ? 'steigend' : avg2 < avg1 * 0.95 ? 'fallend' : 'stabil';
    return acc;
  }, {} as Record<string, string>);

  return NextResponse.json({
    trend,
    totals,
    trendRichtung: trendDir,
    generatedAt: now.toISOString(),
  });
}
