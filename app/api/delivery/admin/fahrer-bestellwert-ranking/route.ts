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
      .select('driver_id, order_total, drivers(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('order_total', 'is', null);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const driverMap = new Map<string, { name: string; total: number; count: number }>();

    (data ?? []).forEach((row: { driver_id: string; order_total: number; drivers?: { name: string } | null }) => {
      if (!row.driver_id) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const existing = driverMap.get(row.driver_id) ?? { name, total: 0, count: 0 };
      existing.total += row.order_total ?? 0;
      existing.count += 1;
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      avg_bestellwert: d.count > 0 ? Math.round((d.total / d.count) * 100) / 100 : 0,
      stopps: d.count,
    }));

    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Tim', avg_bestellwert: 28.50, stopps: 42 },
        { driver_id: 'mock-2', name: 'Max', avg_bestellwert: 22.30, stopps: 38 },
        { driver_id: 'mock-3', name: 'Julia', avg_bestellwert: 18.70, stopps: 45 },
        { driver_id: 'mock-4', name: 'Sara', avg_bestellwert: 14.20, stopps: 31 },
      ];
    }

    // absteigend: Rang 1 = höchster Bestellwert = bester
    ranking.sort((a, b) => b.avg_bestellwert - a.avg_bestellwert);

    const maxVal = ranking[0]?.avg_bestellwert ?? 1;
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
        avg_bestellwert: d.avg_bestellwert,
        stopps: d.stopps,
        balken_pct: Math.round((d.avg_bestellwert / maxVal) * 100),
        ampel,
        alert: d.avg_bestellwert < 15 ? 'Niedriger Bestellwert!' : null,
        rank_delta: 0,
      };
    });

    const team_avg = result.length > 0
      ? Math.round((result.reduce((s, d) => s + d.avg_bestellwert, 0) / result.length) * 100) / 100
      : 0;

    const alert_count = result.filter(d => d.alert).length;

    return NextResponse.json({
      ranking: result,
      team_avg,
      alert_count,
      bester_name: result[0]?.name ?? '',
      letzter_name: result[result.length - 1]?.name ?? '',
      gesamt: result.length,
      generated_at: new Date().toISOString(),
    });
  } catch {
    const mock = [
      { driver_id: 'mock-1', name: 'Tim', avg_bestellwert: 28.50, stopps: 42 },
      { driver_id: 'mock-2', name: 'Max', avg_bestellwert: 22.30, stopps: 38 },
      { driver_id: 'mock-3', name: 'Julia', avg_bestellwert: 18.70, stopps: 45 },
      { driver_id: 'mock-4', name: 'Sara', avg_bestellwert: 14.20, stopps: 31 },
    ];
    const maxVal = mock[0].avg_bestellwert;
    const result = mock.map((d, i) => ({
      rang: i + 1,
      driver_id: d.driver_id,
      name: d.name,
      avg_bestellwert: d.avg_bestellwert,
      stopps: d.stopps,
      balken_pct: Math.round((d.avg_bestellwert / maxVal) * 100),
      ampel: i === 0 ? 'gruen' : i === mock.length - 1 ? 'rot' : 'gelb' as 'gruen' | 'gelb' | 'rot',
      alert: d.avg_bestellwert < 15 ? 'Niedriger Bestellwert!' : null,
      rank_delta: 0,
    }));
    return NextResponse.json({
      ranking: result,
      team_avg: 20.93,
      alert_count: 1,
      bester_name: 'Tim',
      letzter_name: 'Sara',
      gesamt: 4,
      generated_at: new Date().toISOString(),
    });
  }
}
