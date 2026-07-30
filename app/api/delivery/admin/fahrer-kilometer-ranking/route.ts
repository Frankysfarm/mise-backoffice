import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK = [
  { fahrer_id: 'julia', fahrer_name: 'Julia', avg_km: 6.1 },
  { fahrer_id: 'sara', fahrer_name: 'Sara', avg_km: 8.3 },
  { fahrer_id: 'max', fahrer_name: 'Max', avg_km: 11.4 },
  { fahrer_id: 'tim', fahrer_name: 'Tim', avg_km: 16.2 },
];

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const top = Math.ceil(gesamt * 0.25);
  const bot = Math.floor(gesamt * 0.75);
  if (rang <= top) return 'gruen';
  if (rang > bot) return 'rot';
  return 'gelb';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  let rows: Array<{ fahrer_id: string; fahrer_name: string; avg_km: number }> = [];

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from('delivery_tours')
      .select('driver_id, profiles!driver_id(full_name), distance_km')
      .gte('created_at', since)
      .not('distance_km', 'is', null);

    if (locationId) q = q.eq('location_id', locationId);

    const { data } = await q;

    if (data && data.length > 0) {
      const map = new Map<string, { name: string; total: number; count: number }>();
      for (const t of data) {
        if (!t.driver_id || !t.distance_km) continue;
        const name =
          (t.profiles as { full_name?: string } | null)?.full_name ?? t.driver_id;
        const entry = map.get(t.driver_id) ?? { name, total: 0, count: 0 };
        entry.total += t.distance_km as number;
        entry.count += 1;
        map.set(t.driver_id, entry);
      }
      rows = Array.from(map.entries()).map(([id, e]) => ({
        fahrer_id: id,
        fahrer_name: e.name,
        avg_km: Math.round((e.total / e.count) * 10) / 10,
      }));
    }
  } catch {
    // fall through to mock
  }

  if (rows.length === 0) rows = MOCK;

  // ascending: rank 1 = shortest distance = most efficient
  rows.sort((a, b) => a.avg_km - b.avg_km);

  const gesamt = rows.length;
  const maxKm = Math.max(...rows.map(r => r.avg_km), 1);
  const team_avg_km = Math.round((rows.reduce((s, r) => s + r.avg_km, 0) / gesamt) * 10) / 10;

  const fahrer = rows.map((r, i) => {
    const rang = i + 1;
    const ampel = ampelVon(rang, gesamt);
    return {
      fahrer_id: r.fahrer_id,
      fahrer_name: r.fahrer_name,
      rang,
      avg_km: r.avg_km,
      balken_pct: Math.round((r.avg_km / maxKm) * 100),
      ampel,
      rank_delta: 0,
      alert_hoch: r.avg_km > 15,
    };
  });

  const alert_count = fahrer.filter(f => f.alert_hoch).length;

  return NextResponse.json({
    fahrer,
    team_avg_km,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count,
    gesamt,
  });
}
