import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_lieferzeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_lieferzeit_min: 18.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_lieferzeit_min: 21.5, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_lieferzeit_min: 25.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_lieferzeit_min: 31.4, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 24.2,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, delivery_minutes')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('delivery_minutes', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, delivery_minutes')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('delivery_minutes', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; times: number[] }>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, times: [] as number[] };
      prev.times.push(o.delivery_minutes ?? 0);
      groupCur.set(o.driver_id, prev);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number[]>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const arr = groupPrev.get(o.driver_id) ?? [];
      arr.push(o.delivery_minutes ?? 0);
      groupPrev.set(o.driver_id, arr);
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg_min: Math.round(avg(v.times) * 10) / 10,
    }));

    // INVERTED: ascending → rank 1 = shortest = best
    const sorted = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const total  = sorted.length;

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg_min: Math.round(avg(groupPrev.get(f.fahrer_id) ?? []) * 10) / 10 }))
      .sort((a, b) => a.avg_min - b.avg_min);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:          f.fahrer_id,
        fahrer_name:        f.fahrer_name,
        rang,
        avg_lieferzeit_min: f.avg_min,
        rank_delta:         prevRang - rang,
        ampel,
        alert_hoch:         ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(avg(sorted.map(f => f.avg_min)) * 10) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_min:     teamAvg,
      schnellster_name: sorted[0]?.fahrer_name ?? '',
      langsamster_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_hoch).length,
      gesamt:           total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
