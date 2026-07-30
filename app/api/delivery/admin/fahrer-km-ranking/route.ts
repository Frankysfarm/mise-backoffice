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
      .from('delivery_tours')
      .select('driver_id, route_km, drivers(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('route_km', 'is', null);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const driverMap = new Map<string, { name: string; total_km: number; count: number }>();

    (data ?? []).forEach((row: any) => {
      if (!row.driver_id) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const existing = driverMap.get(row.driver_id) ?? { name, total_km: 0, count: 0 };
      existing.total_km += row.route_km ?? 0;
      existing.count += 1;
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      avg_km_pro_tour: d.count > 0 ? Math.round((d.total_km / d.count) * 10) / 10 : 0,
      touren: d.count,
    }));

    // Mock-Fallback wenn keine Daten
    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Tim', avg_km_pro_tour: 18.4, touren: 42 },
        { driver_id: 'mock-2', name: 'Sara', avg_km_pro_tour: 15.2, touren: 38 },
        { driver_id: 'mock-3', name: 'Max', avg_km_pro_tour: 12.7, touren: 35 },
        { driver_id: 'mock-4', name: 'Julia', avg_km_pro_tour: 9.3, touren: 29 },
      ];
    }

    // Absteigend sortieren: Rang 1 = meiste km = bester
    ranking.sort((a, b) => b.avg_km_pro_tour - a.avg_km_pro_tour);

    const maxKm = ranking[0]?.avg_km_pro_tour ?? 1;
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
        avg_km_pro_tour: d.avg_km_pro_tour,
        touren: d.touren,
        balken_pct: Math.round((d.avg_km_pro_tour / maxKm) * 100),
        ampel,
        alert: d.avg_km_pro_tour < 8 ? 'Wenige Kilometer!' : null,
        rank_delta: 0,
      };
    });

    const team_avg = result.length > 0
      ? Math.round((result.reduce((s, d) => s + d.avg_km_pro_tour, 0) / result.length) * 10) / 10
      : 0;

    return NextResponse.json({ ranking: result, team_avg, generated_at: new Date().toISOString() });
  } catch {
    // Mock-Fallback bei DB-Fehler
    const mock = [
      { driver_id: 'mock-1', name: 'Tim', avg_km_pro_tour: 18.4, touren: 42 },
      { driver_id: 'mock-2', name: 'Sara', avg_km_pro_tour: 15.2, touren: 38 },
      { driver_id: 'mock-3', name: 'Max', avg_km_pro_tour: 12.7, touren: 35 },
      { driver_id: 'mock-4', name: 'Julia', avg_km_pro_tour: 9.3, touren: 29 },
    ];
    const maxKm = mock[0].avg_km_pro_tour;
    const result = mock.map((d, i) => ({
      rang: i + 1,
      driver_id: d.driver_id,
      name: d.name,
      avg_km_pro_tour: d.avg_km_pro_tour,
      touren: d.touren,
      balken_pct: Math.round((d.avg_km_pro_tour / maxKm) * 100),
      ampel: i === 0 ? 'gruen' : i === mock.length - 1 ? 'rot' : 'gelb' as 'gruen' | 'gelb' | 'rot',
      alert: d.avg_km_pro_tour < 8 ? 'Wenige Kilometer!' : null,
      rank_delta: 0,
    }));
    return NextResponse.json({
      ranking: result,
      team_avg: 13.9,
      generated_at: new Date().toISOString(),
    });
  }
}
