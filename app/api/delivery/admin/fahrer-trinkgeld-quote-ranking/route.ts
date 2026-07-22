import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface FahrerTrinkgeld {
  driver_id: string;
  driver_name: string;
  trinkgeld_quote: number;
  trinkgeld_total: number;
  tour_count: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number | null;
  alert: boolean;
}

interface ApiResponse {
  fahrer: FahrerTrinkgeld[];
  team_avg: number;
  location_id: string | null;
  date: string;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { driver_id: 'mock-1', driver_name: 'Max M.', trinkgeld_quote: 12.4, trinkgeld_total: 18.6, tour_count: 8, rang: 1, ampel: 'gruen', rank_delta: 1, alert: false },
    { driver_id: 'mock-2', driver_name: 'Lisa K.', trinkgeld_quote: 9.8, trinkgeld_total: 14.2, tour_count: 6, rang: 2, ampel: 'gruen', rank_delta: 0, alert: false },
    { driver_id: 'mock-3', driver_name: 'Tom B.', trinkgeld_quote: 7.1, trinkgeld_total: 9.5, tour_count: 7, rang: 3, ampel: 'gelb', rank_delta: -1, alert: false },
    { driver_id: 'mock-4', driver_name: 'Anna S.', trinkgeld_quote: 5.3, trinkgeld_total: 6.8, tour_count: 5, rang: 4, ampel: 'gelb', rank_delta: 2, alert: false },
    { driver_id: 'mock-5', driver_name: 'Paul R.', trinkgeld_quote: 2.1, trinkgeld_total: 2.9, tour_count: 4, rang: 5, ampel: 'rot', rank_delta: -2, alert: true },
  ],
  team_avg: 7.3,
  location_id: null,
  date: new Date().toISOString().split('T')[0],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const buildQuery = (date: string) => {
      let q = supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, tip_amount, total_amount')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .not('total_amount', 'is', null)
        .gt('total_amount', 0);
      if (locationId) q = q.eq('location_id', locationId);
      return q;
    };

    const [todayRes, yesterdayRes] = await Promise.all([
      buildQuery(today),
      buildQuery(yesterday),
    ]);

    if (todayRes.error || !todayRes.data?.length) {
      return NextResponse.json({ ...MOCK_DATA, location_id: locationId });
    }

    type TourRow = { driver_id: string; driver_name: string; tip_amount: number | null; total_amount: number };

    const aggregateByDriver = (rows: TourRow[]) => {
      const map = new Map<string, { name: string; tip_sum: number; total_sum: number; count: number }>();
      for (const r of rows) {
        const existing = map.get(r.driver_id) ?? { name: r.driver_name, tip_sum: 0, total_sum: 0, count: 0 };
        existing.tip_sum += r.tip_amount ?? 0;
        existing.total_sum += r.total_amount;
        existing.count += 1;
        map.set(r.driver_id, existing);
      }
      return map;
    };

    const todayMap = aggregateByDriver(todayRes.data as TourRow[]);
    const yesterdayMap = yesterdayRes.data?.length
      ? aggregateByDriver(yesterdayRes.data as TourRow[])
      : new Map<string, { name: string; tip_sum: number; total_sum: number; count: number }>();

    const sorted = Array.from(todayMap.entries())
      .map(([driver_id, v]) => ({
        driver_id,
        driver_name: v.name,
        trinkgeld_quote: v.total_sum > 0 ? (v.tip_sum / v.total_sum) * 100 : 0,
        trinkgeld_total: v.tip_sum,
        tour_count: v.count,
      }))
      .sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);

    const n = sorted.length;
    const top25 = Math.ceil(n * 0.25);
    const bottom25 = Math.floor(n * 0.75);

    const yesterdaySorted = Array.from(yesterdayMap.entries())
      .map(([id, v]) => ({ id, rate: v.total_sum > 0 ? (v.tip_sum / v.total_sum) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
    const yesterdayRank = new Map(yesterdaySorted.map((f, i) => [f.id, i + 1]));

    const team_avg = sorted.reduce((s, f) => s + f.trinkgeld_quote, 0) / (sorted.length || 1);

    const fahrer: FahrerTrinkgeld[] = sorted.map((f, i) => {
      const rang = i + 1;
      const ampel: FahrerTrinkgeld['ampel'] = rang <= top25 ? 'gruen' : rang > bottom25 ? 'rot' : 'gelb';
      const prevRang = yesterdayRank.get(f.driver_id) ?? null;
      const rank_delta = prevRang !== null ? prevRang - rang : null;
      return {
        driver_id: f.driver_id,
        driver_name: f.driver_name,
        trinkgeld_quote: Math.round(f.trinkgeld_quote * 10) / 10,
        trinkgeld_total: Math.round(f.trinkgeld_total * 100) / 100,
        tour_count: f.tour_count,
        rang,
        ampel,
        rank_delta,
        alert: ampel === 'rot',
      };
    });

    return NextResponse.json({ fahrer, team_avg: Math.round(team_avg * 10) / 10, location_id: locationId, date: today });
  } catch {
    return NextResponse.json({ ...MOCK_DATA, location_id: locationId });
  }
}
