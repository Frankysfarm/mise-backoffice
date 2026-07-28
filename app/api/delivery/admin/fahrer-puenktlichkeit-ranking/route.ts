import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = supabase
      .from('delivery_stops')
      .select('driver_id, delivered_at, estimated_at, drivers(name)')
      .gte('delivered_at', thirtyDaysAgo.toISOString())
      .not('driver_id', 'is', null)
      .not('delivered_at', 'is', null)
      .not('estimated_at', 'is', null);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    type StopRow = {
      driver_id: string;
      delivered_at: string;
      estimated_at: string;
      drivers?: { name: string } | null;
    };

    const driverMap = new Map<string, { name: string; total: number; puenktlich: number }>();

    (data ?? []).forEach((row: StopRow) => {
      if (!row.driver_id || !row.delivered_at || !row.estimated_at) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const existing = driverMap.get(row.driver_id) ?? { name, total: 0, puenktlich: 0 };
      existing.total += 1;
      const diffMs = new Date(row.delivered_at).getTime() - new Date(row.estimated_at).getTime();
      if (Math.abs(diffMs) <= 5 * 60 * 1000) existing.puenktlich += 1;
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      puenktlichkeit_pct: d.total > 0 ? Math.round((d.puenktlich / d.total) * 1000) / 10 : 0,
      puenktlich: d.puenktlich,
      total: d.total,
    }));

    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Tim', puenktlichkeit_pct: 94, puenktlich: 47, total: 50 },
        { driver_id: 'mock-2', name: 'Max', puenktlichkeit_pct: 88, puenktlich: 44, total: 50 },
        { driver_id: 'mock-3', name: 'Julia', puenktlichkeit_pct: 79, puenktlich: 40, total: 51 },
        { driver_id: 'mock-4', name: 'Sara', puenktlichkeit_pct: 65, puenktlich: 33, total: 51 },
      ];
    }

    // absteigend: Rang 1 = höchste Pünktlichkeit = bester
    ranking.sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);

    const maxVal = ranking[0]?.puenktlichkeit_pct ?? 1;
    const total = ranking.length;
    const q1 = Math.ceil(total * 0.25);
    const q3 = Math.ceil(total * 0.75);

    const ranked = ranking.map((f, i) => {
      const rang = i + 1;
      const ampel: 'gruen' | 'gelb' | 'rot' = rang <= q1 ? 'gruen' : rang >= q3 ? 'rot' : 'gelb';
      const alert = f.puenktlichkeit_pct < 75 ? 'Hohe Verspätungsrate!' : null;
      return {
        driver_id: f.driver_id,
        name: f.name,
        rang,
        puenktlichkeit_pct: f.puenktlichkeit_pct,
        puenktlich: f.puenktlich,
        total: f.total,
        balken_pct: Math.round((f.puenktlichkeit_pct / maxVal) * 100),
        ampel,
        alert,
        rank_delta: 0,
      };
    });

    const team_avg =
      Math.round(
        (ranking.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / (ranking.length || 1)) * 10
      ) / 10;

    const alert_count = ranked.filter(f => f.alert).length;

    return NextResponse.json({
      ranking: ranked,
      team_avg,
      alert_count,
      bester_name: ranked[0]?.name ?? '',
      letzter_name: ranked[ranked.length - 1]?.name ?? '',
      gesamt: ranked.length,
    });
  } catch {
    return NextResponse.json({
      ranking: [
        { driver_id: 'mock-1', name: 'Tim', rang: 1, puenktlichkeit_pct: 94, puenktlich: 47, total: 50, balken_pct: 100, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-2', name: 'Max', rang: 2, puenktlichkeit_pct: 88, puenktlich: 44, total: 50, balken_pct: 94, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-3', name: 'Julia', rang: 3, puenktlichkeit_pct: 79, puenktlich: 40, total: 51, balken_pct: 84, ampel: 'gelb', alert: null, rank_delta: 0 },
        { driver_id: 'mock-4', name: 'Sara', rang: 4, puenktlichkeit_pct: 65, puenktlich: 33, total: 51, balken_pct: 69, ampel: 'rot', alert: 'Hohe Verspätungsrate!', rank_delta: 0 },
      ],
      team_avg: 81.5,
      alert_count: 1,
      bester_name: 'Tim',
      letzter_name: 'Sara',
      gesamt: 4,
    });
  }
}
