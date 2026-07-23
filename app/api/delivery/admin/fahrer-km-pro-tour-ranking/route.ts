import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_avg:  4.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_avg:  5.1, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_avg:  6.8, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_avg:  9.3, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 6.35,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, total_distance_km')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_distance_km')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; kmSum: number; count: number }>();
    for (const t of curData) {
      const km = Number(t.total_distance_km ?? 0);
      if (km <= 0) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, kmSum: 0, count: 0 };
      groupCur.set(t.driver_id, { name: prev.name, kmSum: prev.kmSum + km, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrevAvg = new Map<string, number>();
    const prevByDriver = new Map<string, number[]>();
    for (const t of prevData) {
      const km = Number(t.total_distance_km ?? 0);
      if (km <= 0) continue;
      if (!prevByDriver.has(t.driver_id)) prevByDriver.set(t.driver_id, []);
      prevByDriver.get(t.driver_id)!.push(km);
    }
    for (const [id, vals] of prevByDriver.entries()) {
      groupPrevAvg.set(id, vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      km_avg: Math.round((v.kmSum / v.count) * 100) / 100,
    }));

    const sorted = [...unsorted].sort((a, b) => a.km_avg - b.km_avg);
    const total = sorted.length;

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, km_avg: groupPrevAvg.get(f.fahrer_id) ?? f.km_avg }))
      .sort((a, b) => a.km_avg - b.km_avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        km_avg: f.km_avg,
        rank_delta: rang - prevRang,
        ampel,
        alert_top: ampel === 'rot',
      };
    });

    const team_avg = Math.round(
      (fahrer.reduce((s, f) => s + f.km_avg, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
