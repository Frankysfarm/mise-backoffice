import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK = [
  { fahrer_id: 'julia', fahrer_name: 'Julia', avg_netto: 85 },
  { fahrer_id: 'sara', fahrer_name: 'Sara', avg_netto: 72 },
  { fahrer_id: 'max', fahrer_name: 'Max', avg_netto: 61 },
  { fahrer_id: 'tim', fahrer_name: 'Tim', avg_netto: 48 },
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

  let rows: Array<{ fahrer_id: string; fahrer_name: string; avg_netto: number }> = [];

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from('driver_shifts')
      .select('driver_id, profiles!driver_id(full_name), net_earnings_eur')
      .gte('created_at', since)
      .not('net_earnings_eur', 'is', null);

    if (locationId) q = q.eq('location_id', locationId);

    const { data } = await q;

    if (data && data.length > 0) {
      const map = new Map<string, { name: string; total: number; count: number }>();
      for (const s of data) {
        if (!s.driver_id || s.net_earnings_eur == null) continue;
        const name =
          (s.profiles as { full_name?: string } | null)?.full_name ?? s.driver_id;
        const entry = map.get(s.driver_id) ?? { name, total: 0, count: 0 };
        entry.total += s.net_earnings_eur as number;
        entry.count += 1;
        map.set(s.driver_id, entry);
      }
      rows = Array.from(map.entries()).map(([id, e]) => ({
        fahrer_id: id,
        fahrer_name: e.name,
        avg_netto: Math.round((e.total / e.count) * 100) / 100,
      }));
    }
  } catch {
    // fall through to mock
  }

  if (rows.length === 0) rows = MOCK;

  // descending: rank 1 = highest avg net earnings = best
  rows.sort((a, b) => b.avg_netto - a.avg_netto);

  const gesamt = rows.length;
  const maxVal = Math.max(...rows.map(r => r.avg_netto), 1);
  const team_avg =
    Math.round((rows.reduce((s, r) => s + r.avg_netto, 0) / gesamt) * 100) / 100;

  const fahrer = rows.map((r, i) => {
    const rang = i + 1;
    const ampel = ampelVon(rang, gesamt);
    return {
      fahrer_id: r.fahrer_id,
      fahrer_name: r.fahrer_name,
      rang,
      avg_netto: r.avg_netto,
      balken_pct: Math.round((r.avg_netto / maxVal) * 100),
      ampel,
      rank_delta: 0,
      alert_niedrig: ampel === 'rot',
    };
  });

  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  return NextResponse.json({
    fahrer,
    team_avg,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    niedrigster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count,
    gesamt,
  });
}
