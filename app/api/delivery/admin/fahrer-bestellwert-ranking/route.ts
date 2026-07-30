import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK = [
  { fahrer_id: 'julia', fahrer_name: 'Julia', avg_bestellwert: 42.0 },
  { fahrer_id: 'sara', fahrer_name: 'Sara', avg_bestellwert: 36.0 },
  { fahrer_id: 'max', fahrer_name: 'Max', avg_bestellwert: 29.0 },
  { fahrer_id: 'tim', fahrer_name: 'Tim', avg_bestellwert: 21.0 },
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

  let rows: Array<{ fahrer_id: string; fahrer_name: string; avg_bestellwert: number }> = [];

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from('delivery_tours')
      .select('driver_id, profiles!driver_id(full_name), order_value_eur')
      .gte('created_at', since)
      .not('order_value_eur', 'is', null);

    if (locationId) q = q.eq('location_id', locationId);

    const { data } = await q;

    if (data && data.length > 0) {
      const map = new Map<string, { name: string; total: number; count: number }>();
      for (const t of data) {
        if (!t.driver_id || !t.order_value_eur) continue;
        const name =
          (t.profiles as { full_name?: string } | null)?.full_name ?? t.driver_id;
        const entry = map.get(t.driver_id) ?? { name, total: 0, count: 0 };
        entry.total += t.order_value_eur as number;
        entry.count += 1;
        map.set(t.driver_id, entry);
      }
      rows = Array.from(map.entries()).map(([id, e]) => ({
        fahrer_id: id,
        fahrer_name: e.name,
        avg_bestellwert: Math.round((e.total / e.count) * 100) / 100,
      }));
    }
  } catch {
    // fall through to mock
  }

  if (rows.length === 0) rows = MOCK;

  // descending: rank 1 = highest avg order value = best
  rows.sort((a, b) => b.avg_bestellwert - a.avg_bestellwert);

  const gesamt = rows.length;
  const maxVal = Math.max(...rows.map(r => r.avg_bestellwert), 1);
  const team_avg_bestellwert = Math.round((rows.reduce((s, r) => s + r.avg_bestellwert, 0) / gesamt) * 100) / 100;

  const fahrer = rows.map((r, i) => {
    const rang = i + 1;
    const ampel = ampelVon(rang, gesamt);
    return {
      fahrer_id: r.fahrer_id,
      fahrer_name: r.fahrer_name,
      rang,
      avg_bestellwert: r.avg_bestellwert,
      balken_pct: Math.round((r.avg_bestellwert / maxVal) * 100),
      ampel,
      rank_delta: 0,
      alert_niedrig: ampel === 'rot',
    };
  });

  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  return NextResponse.json({
    fahrer,
    team_avg_bestellwert,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    niedrigster_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count,
    gesamt,
  });
}
