import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = supabase
      .from('delivery_stops')
      .select('driver_id, wait_minutes, drivers(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('wait_minutes', 'is', null);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const driverMap = new Map<string, { name: string; total_wait: number; count: number }>();

    (data ?? []).forEach((row: { driver_id: string; wait_minutes: number; drivers?: { name: string } | null }) => {
      if (!row.driver_id) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const existing = driverMap.get(row.driver_id) ?? { name, total_wait: 0, count: 0 };
      existing.total_wait += row.wait_minutes ?? 0;
      existing.count += 1;
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      avg_wartezeit_min: d.count > 0 ? Math.round((d.total_wait / d.count) * 10) / 10 : 0,
      stopps: d.count,
    }));

    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Sara', avg_wartezeit_min: 2.1, stopps: 48 },
        { driver_id: 'mock-2', name: 'Julia', avg_wartezeit_min: 3.4, stopps: 42 },
        { driver_id: 'mock-3', name: 'Max', avg_wartezeit_min: 5.8, stopps: 38 },
        { driver_id: 'mock-4', name: 'Tim', avg_wartezeit_min: 8.2, stopps: 31 },
      ];
    }

    // INVERTED aufsteigend: Rang 1 = kürzeste Wartezeit = bester
    ranking.sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);

    const maxMin = ranking[ranking.length - 1]?.avg_wartezeit_min ?? 1;
    const q1 = Math.floor(ranking.length * 0.25);
    const q3 = Math.floor(ranking.length * 0.75);

    const result = ranking.map((d, i) => {
      let ampel: 'gruen' | 'gelb' | 'rot' = 'gelb';
      if (i < q1) ampel = 'gruen';
      else if (i >= q3) ampel = 'rot';

      return {
        rang: i + 1,
        driver_id: d.driver_id,
        name: d.name,
        avg_wartezeit_min: d.avg_wartezeit_min,
        stopps: d.stopps,
        balken_pct: Math.round((d.avg_wartezeit_min / maxMin) * 100),
        ampel,
        alert: d.avg_wartezeit_min > 5 ? 'Hohe Wartezeit!' : null,
        rank_delta: 0,
      };
    });

    const team_avg = result.length > 0
      ? Math.round((result.reduce((s, d) => s + d.avg_wartezeit_min, 0) / result.length) * 10) / 10
      : 0;

    return NextResponse.json({ ranking: result, team_avg, generated_at: new Date().toISOString() });
  } catch {
    const mock = [
      { driver_id: 'mock-1', name: 'Sara', avg_wartezeit_min: 2.1, stopps: 48 },
      { driver_id: 'mock-2', name: 'Julia', avg_wartezeit_min: 3.4, stopps: 42 },
      { driver_id: 'mock-3', name: 'Max', avg_wartezeit_min: 5.8, stopps: 38 },
      { driver_id: 'mock-4', name: 'Tim', avg_wartezeit_min: 8.2, stopps: 31 },
    ];
    const maxMin = mock[mock.length - 1].avg_wartezeit_min;
    const result = mock.map((d, i) => ({
      rang: i + 1,
      driver_id: d.driver_id,
      name: d.name,
      avg_wartezeit_min: d.avg_wartezeit_min,
      stopps: d.stopps,
      balken_pct: Math.round((d.avg_wartezeit_min / maxMin) * 100),
      ampel: i === 0 ? 'gruen' : i === mock.length - 1 ? 'rot' : 'gelb' as 'gruen' | 'gelb' | 'rot',
      alert: d.avg_wartezeit_min > 5 ? 'Hohe Wartezeit!' : null,
      rank_delta: 0,
    }));
    return NextResponse.json({
      ranking: result,
      team_avg: 4.9,
      generated_at: new Date().toISOString(),
    });
  }
}
