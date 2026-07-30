import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK = [
  { fahrer_id: 'sara', fahrer_name: 'Sara', praemien_quote: 87 },
  { fahrer_id: 'julia', fahrer_name: 'Julia', praemien_quote: 74 },
  { fahrer_id: 'max', fahrer_name: 'Max', praemien_quote: 61 },
  { fahrer_id: 'tim', fahrer_name: 'Tim', praemien_quote: 42 },
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

  let rows: Array<{ fahrer_id: string; fahrer_name: string; praemien_quote: number }> = [];

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from('driver_shifts')
      .select('driver_id, profiles!driver_id(full_name), bonus_reached')
      .gte('created_at', since)
      .not('bonus_reached', 'is', null);

    if (locationId) q = q.eq('location_id', locationId);

    const { data } = await q;

    if (data && data.length > 0) {
      const map = new Map<string, { name: string; total: number; reached: number }>();
      for (const s of data) {
        if (!s.driver_id) continue;
        const name =
          (s.profiles as { full_name?: string } | null)?.full_name ?? s.driver_id;
        const entry = map.get(s.driver_id) ?? { name, total: 0, reached: 0 };
        entry.total += 1;
        if (s.bonus_reached) entry.reached += 1;
        map.set(s.driver_id, entry);
      }
      rows = Array.from(map.entries()).map(([id, e]) => ({
        fahrer_id: id,
        fahrer_name: e.name,
        praemien_quote: e.total > 0 ? Math.round((e.reached / e.total) * 100) : 0,
      }));
    }
  } catch {
    // fall through to mock
  }

  if (rows.length === 0) rows = MOCK;

  // descending: rank 1 = highest bonus achievement rate = best
  rows.sort((a, b) => b.praemien_quote - a.praemien_quote);

  const gesamt = rows.length;
  const maxVal = Math.max(...rows.map(r => r.praemien_quote), 1);
  const team_avg_pct =
    Math.round(rows.reduce((s, r) => s + r.praemien_quote, 0) / gesamt);

  const fahrer = rows.map((r, i) => {
    const rang = i + 1;
    const ampel = ampelVon(rang, gesamt);
    return {
      fahrer_id: r.fahrer_id,
      fahrer_name: r.fahrer_name,
      rang,
      praemien_quote: r.praemien_quote,
      balken_pct: Math.round((r.praemien_quote / maxVal) * 100),
      ampel,
      rank_delta: 0,
      alert_niedrig: r.praemien_quote < 50,
    };
  });

  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  return NextResponse.json({
    fahrer,
    team_avg_pct,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    niedrigster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count,
    gesamt,
  });
}
