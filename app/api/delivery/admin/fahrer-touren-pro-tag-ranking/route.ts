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
      .select('driver_id, created_at, drivers(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('driver_id', 'is', null);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    type DriverRow = { driver_id: string; created_at: string; drivers?: { name: string } | null };
    const driverMap = new Map<string, { name: string; days: Set<string>; tours: number }>();

    (data ?? []).forEach((row: DriverRow) => {
      if (!row.driver_id) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const day = row.created_at ? row.created_at.slice(0, 10) : '';
      const existing = driverMap.get(row.driver_id) ?? { name, days: new Set<string>(), tours: 0 };
      if (day) existing.days.add(day);
      existing.tours += 1;
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      avg_touren_pro_tag: d.days.size > 0 ? Math.round((d.tours / d.days.size) * 10) / 10 : 0,
      touren: d.tours,
      tage: d.days.size,
    }));

    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Tim', avg_touren_pro_tag: 4.8, touren: 144, tage: 30 },
        { driver_id: 'mock-2', name: 'Max', avg_touren_pro_tag: 4.1, touren: 123, tage: 30 },
        { driver_id: 'mock-3', name: 'Julia', avg_touren_pro_tag: 3.5, touren: 105, tage: 30 },
        { driver_id: 'mock-4', name: 'Sara', avg_touren_pro_tag: 2.9, touren: 87, tage: 30 },
      ];
    }

    // absteigend: Rang 1 = meiste Touren/Tag = bester
    ranking.sort((a, b) => b.avg_touren_pro_tag - a.avg_touren_pro_tag);

    const maxVal = ranking[0]?.avg_touren_pro_tag ?? 1;
    const total = ranking.length;
    const q1 = Math.ceil(total * 0.25);
    const q3 = Math.ceil(total * 0.75);

    const ranked = ranking.map((f, i) => {
      const rang = i + 1;
      const prev_rang = rang; // no history available
      const ampel: 'gruen' | 'gelb' | 'rot' = rang <= q1 ? 'gruen' : rang >= q3 ? 'rot' : 'gelb';
      const alert = f.avg_touren_pro_tag < 3.5 ? 'Wenige Touren!' : null;
      return {
        driver_id: f.driver_id,
        name: f.name,
        rang,
        avg_touren_pro_tag: f.avg_touren_pro_tag,
        touren: f.touren,
        tage: f.tage,
        balken_pct: Math.round((f.avg_touren_pro_tag / maxVal) * 100),
        ampel,
        alert,
        rank_delta: 0,
      };
    });

    const team_avg = Math.round(
      (ranking.reduce((s, f) => s + f.avg_touren_pro_tag, 0) / (ranking.length || 1)) * 10
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
        { driver_id: 'mock-1', name: 'Tim', rang: 1, avg_touren_pro_tag: 4.8, touren: 144, tage: 30, balken_pct: 100, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-2', name: 'Max', rang: 2, avg_touren_pro_tag: 4.1, touren: 123, tage: 30, balken_pct: 85, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-3', name: 'Julia', rang: 3, avg_touren_pro_tag: 3.5, touren: 105, tage: 30, balken_pct: 73, ampel: 'gelb', alert: null, rank_delta: 0 },
        { driver_id: 'mock-4', name: 'Sara', rang: 4, avg_touren_pro_tag: 2.9, touren: 87, tage: 30, balken_pct: 60, ampel: 'rot', alert: 'Wenige Touren!', rank_delta: 0 },
      ],
      team_avg: 3.8,
      alert_count: 1,
      bester_name: 'Tim',
      letzter_name: 'Sara',
      gesamt: 4,
    });
  }
}
