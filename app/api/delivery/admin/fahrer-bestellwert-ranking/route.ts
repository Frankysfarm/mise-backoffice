import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface FahrerBestellwert {
  driver_id: string;
  driver_name: string;
  avg_bestellwert: number;
  tour_count: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number | null;
  alert: boolean;
}

interface ApiResponse {
  fahrer: FahrerBestellwert[];
  team_avg: number;
  location_id: string | null;
  date: string;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { driver_id: 'mock-1', driver_name: 'Max M.', avg_bestellwert: 42.5, tour_count: 8, rang: 1, ampel: 'gruen', rank_delta: 1, alert: false },
    { driver_id: 'mock-2', driver_name: 'Lisa K.', avg_bestellwert: 35.2, tour_count: 6, rang: 2, ampel: 'gruen', rank_delta: -1, alert: false },
    { driver_id: 'mock-3', driver_name: 'Tom B.', avg_bestellwert: 28.9, tour_count: 7, rang: 3, ampel: 'gelb', rank_delta: 0, alert: false },
    { driver_id: 'mock-4', driver_name: 'Anna S.', avg_bestellwert: 22.1, tour_count: 5, rang: 4, ampel: 'gelb', rank_delta: 2, alert: false },
    { driver_id: 'mock-5', driver_name: 'Paul R.', avg_bestellwert: 14.8, tour_count: 4, rang: 5, ampel: 'rot', rank_delta: -2, alert: true },
  ],
  team_avg: 28.7,
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
        .select('driver_id, driver_name, total_amount')
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

    type TourRow = { driver_id: string; driver_name: string; total_amount: number };

    const aggregateByDriver = (rows: TourRow[]) => {
      const map = new Map<string, { name: string; sum: number; count: number }>();
      for (const r of rows) {
        const existing = map.get(r.driver_id) ?? { name: r.driver_name, sum: 0, count: 0 };
        existing.sum += r.total_amount;
        existing.count += 1;
        map.set(r.driver_id, existing);
      }
      return map;
    };

    const todayMap = aggregateByDriver(todayRes.data as TourRow[]);
    const yesterdayMap = yesterdayRes.data?.length
      ? aggregateByDriver(yesterdayRes.data as TourRow[])
      : new Map<string, { name: string; sum: number; count: number }>();

    const sorted = Array.from(todayMap.entries())
      .map(([driver_id, v]) => ({ driver_id, driver_name: v.name, avg_bestellwert: v.sum / v.count, tour_count: v.count }))
      .sort((a, b) => b.avg_bestellwert - a.avg_bestellwert);

    const n = sorted.length;
    const top25 = Math.ceil(n * 0.25);
    const bottom25 = Math.floor(n * 0.75);

    const yesterdaySorted = Array.from(yesterdayMap.entries())
      .map(([id, v]) => ({ id, avg: v.sum / v.count }))
      .sort((a, b) => b.avg - a.avg);
    const yesterdayRank = new Map(yesterdaySorted.map((f, i) => [f.id, i + 1]));

    const team_avg = sorted.reduce((s, f) => s + f.avg_bestellwert, 0) / (sorted.length || 1);

    const fahrer: FahrerBestellwert[] = sorted.map((f, i) => {
      const rang = i + 1;
      const ampel: FahrerBestellwert['ampel'] = rang <= top25 ? 'gruen' : rang > bottom25 ? 'rot' : 'gelb';
      const prevRang = yesterdayRank.get(f.driver_id) ?? null;
      const rank_delta = prevRang !== null ? prevRang - rang : null;
      return {
        driver_id: f.driver_id,
        driver_name: f.driver_name,
        avg_bestellwert: Math.round(f.avg_bestellwert * 100) / 100,
        tour_count: f.tour_count,
        rang,
        ampel,
        rank_delta,
        alert: ampel === 'rot',
      };
    });

    return NextResponse.json({ fahrer, team_avg: Math.round(team_avg * 100) / 100, location_id: locationId, date: today });
  } catch {
    return NextResponse.json({ ...MOCK_DATA, location_id: locationId });
  }
}
