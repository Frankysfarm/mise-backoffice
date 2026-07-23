import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_abweichung_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_abweichung_min: 2.1,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_abweichung_min: 4.8,  rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_abweichung_min: 8.3,  rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_abweichung_min: 14.7, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_min: 7.5,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: start.toISOString(), end: end.toISOString() };
}

function ampelFn(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, promised_eta, actual_delivered_at, mise_drivers(first_name, last_name)')
        .eq('location_id', location_id)
        .gte('actual_delivered_at', today.start)
        .lt('actual_delivered_at', today.end)
        .not('promised_eta', 'is', null)
        .not('actual_delivered_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, promised_eta, actual_delivered_at')
        .eq('location_id', location_id)
        .gte('actual_delivered_at', yesterday.start)
        .lt('actual_delivered_at', yesterday.end)
        .not('promised_eta', 'is', null)
        .not('actual_delivered_at', 'is', null),
    ]);

    if (curRes.error || !curRes.data?.length) return NextResponse.json(MOCK_DATA);

    // Compute per-driver average ETA deviation for today
    const driverMap = new Map<string, { name: string; deviations: number[] }>();
    for (const row of curRes.data as Array<{
      driver_id: string;
      promised_eta: string;
      actual_delivered_at: string;
      mise_drivers: { first_name: string; last_name: string } | null;
    }>) {
      const promised = new Date(row.promised_eta).getTime();
      const actual   = new Date(row.actual_delivered_at).getTime();
      const abwMin   = Math.abs((actual - promised) / 60000);
      if (!driverMap.has(row.driver_id)) {
        const d = row.mise_drivers;
        driverMap.set(row.driver_id, {
          name: d ? `${d.first_name} ${d.last_name[0]}.` : row.driver_id,
          deviations: [],
        });
      }
      driverMap.get(row.driver_id)!.deviations.push(abwMin);
    }

    // Compute per-driver average deviation for yesterday
    const prevMap = new Map<string, number[]>();
    for (const row of (prevRes.data ?? []) as Array<{
      driver_id: string;
      promised_eta: string;
      actual_delivered_at: string;
    }>) {
      const promised = new Date(row.promised_eta).getTime();
      const actual   = new Date(row.actual_delivered_at).getTime();
      const abwMin   = Math.abs((actual - promised) / 60000);
      if (!prevMap.has(row.driver_id)) prevMap.set(row.driver_id, []);
      prevMap.get(row.driver_id)!.push(abwMin);
    }

    const entries = Array.from(driverMap.entries()).map(([id, v]) => ({
      fahrer_id:          id,
      fahrer_name:        v.name,
      avg_abweichung_min: Math.round((v.deviations.reduce((a, b) => a + b, 0) / v.deviations.length) * 10) / 10,
    }));

    // Sort ascending (lowest deviation = best = Rang 1)
    entries.sort((a, b) => a.avg_abweichung_min - b.avg_abweichung_min);
    const total = entries.length;

    // Compute yesterday's ranks for rank_delta
    const prevEntries = Array.from(prevMap.entries()).map(([id, devs]) => ({
      driver_id: id,
      avg: devs.reduce((a, b) => a + b, 0) / devs.length,
    })).sort((a, b) => a.avg - b.avg);
    const prevRankMap = new Map(prevEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrerRows: FahrerRow[] = entries.map((e, i) => {
      const rang       = i + 1;
      const prevRang   = prevRankMap.get(e.fahrer_id) ?? rang;
      const rank_delta = prevRang - rang; // negative = improved (lower rank number)
      const amp        = ampelFn(rang, total);
      return {
        fahrer_id:          e.fahrer_id,
        fahrer_name:        e.fahrer_name,
        rang,
        avg_abweichung_min: e.avg_abweichung_min,
        rank_delta,
        ampel:              amp,
        alert_bottom:       amp === 'rot',
      };
    });

    const teamAvg = Math.round(
      (fahrerRows.reduce((s, f) => s + f.avg_abweichung_min, 0) / total) * 10,
    ) / 10;

    const response: ApiResponse = {
      fahrer:       fahrerRows,
      team_avg_min: teamAvg,
      bester_name:  fahrerRows[0]?.fahrer_name ?? '—',
      letzter_name: fahrerRows[total - 1]?.fahrer_name ?? '—',
      alert_count:  fahrerRows.filter(f => f.alert_bottom).length,
      gesamt:       total,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
