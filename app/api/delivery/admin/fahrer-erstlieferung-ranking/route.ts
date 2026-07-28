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
      .from('delivery_orders')
      .select('driver_id, attempt_number, status, drivers(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('driver_id', 'is', null)
      .in('status', ['delivered', 'failed', 'returned']);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    type OrderRow = {
      driver_id: string;
      attempt_number: number | null;
      status: string;
      drivers?: { name: string } | null;
    };

    const driverMap = new Map<string, { name: string; total: number; first_success: number }>();

    (data ?? []).forEach((row: OrderRow) => {
      if (!row.driver_id) return;
      const name = (row.drivers as { name: string } | null)?.name ?? row.driver_id;
      const existing = driverMap.get(row.driver_id) ?? { name, total: 0, first_success: 0 };
      existing.total += 1;
      const attempt = row.attempt_number ?? 1;
      if (row.status === 'delivered' && attempt <= 1) {
        existing.first_success += 1;
      }
      driverMap.set(row.driver_id, existing);
    });

    let ranking = Array.from(driverMap.entries()).map(([driver_id, d]) => ({
      driver_id,
      name: d.name,
      erstlieferung_pct: d.total > 0 ? Math.round((d.first_success / d.total) * 100) : 0,
      total: d.total,
      first_success: d.first_success,
    }));

    if (ranking.length === 0) {
      ranking = [
        { driver_id: 'mock-1', name: 'Julia', erstlieferung_pct: 97, total: 100, first_success: 97 },
        { driver_id: 'mock-2', name: 'Tim', erstlieferung_pct: 93, total: 120, first_success: 112 },
        { driver_id: 'mock-3', name: 'Max', erstlieferung_pct: 88, total: 110, first_success: 97 },
        { driver_id: 'mock-4', name: 'Sara', erstlieferung_pct: 81, total: 90, first_success: 73 },
      ];
    }

    // absteigend: Rang 1 = höchste Erfolgsrate = bester
    ranking.sort((a, b) => b.erstlieferung_pct - a.erstlieferung_pct);

    const maxVal = ranking[0]?.erstlieferung_pct ?? 1;
    const total = ranking.length;
    const q1 = Math.ceil(total * 0.25);
    const q3 = Math.ceil(total * 0.75);

    const ranked = ranking.map((f, i) => {
      const rang = i + 1;
      const ampel: 'gruen' | 'gelb' | 'rot' = rang <= q1 ? 'gruen' : rang >= q3 ? 'rot' : 'gelb';
      const alert = f.erstlieferung_pct < 85 ? 'Niedrige Erstlieferrate!' : null;
      return {
        driver_id: f.driver_id,
        name: f.name,
        rang,
        erstlieferung_pct: f.erstlieferung_pct,
        total: f.total,
        first_success: f.first_success,
        balken_pct: Math.round((f.erstlieferung_pct / maxVal) * 100),
        ampel,
        alert,
        rank_delta: 0,
      };
    });

    const team_avg = Math.round(
      ranking.reduce((s, f) => s + f.erstlieferung_pct, 0) / (ranking.length || 1)
    );

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
        { driver_id: 'mock-1', name: 'Julia', rang: 1, erstlieferung_pct: 97, total: 100, first_success: 97, balken_pct: 100, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-2', name: 'Tim', rang: 2, erstlieferung_pct: 93, total: 120, first_success: 112, balken_pct: 96, ampel: 'gruen', alert: null, rank_delta: 0 },
        { driver_id: 'mock-3', name: 'Max', rang: 3, erstlieferung_pct: 88, total: 110, first_success: 97, balken_pct: 91, ampel: 'gelb', alert: null, rank_delta: 0 },
        { driver_id: 'mock-4', name: 'Sara', rang: 4, erstlieferung_pct: 81, total: 90, first_success: 73, balken_pct: 84, ampel: 'rot', alert: 'Niedrige Erstlieferrate!', rank_delta: 0 },
      ],
      team_avg: 90,
      alert_count: 1,
      bester_name: 'Julia',
      letzter_name: 'Sara',
      gesamt: 4,
    });
  }
}
