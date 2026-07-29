import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_abholzeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_abholzeit_min:  3.1, rank_delta:  1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_abholzeit_min:  4.5, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_abholzeit_min:  7.2, rank_delta: -1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_abholzeit_min: 12.8, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_min: 6.9,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
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
        .from('delivery_tours')
        .select('driver_id, driver_name, arrived_at_restaurant, picked_up_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, arrived_at_restaurant, picked_up_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; times: number[] }>();
    for (const t of curData) {
      if (!t.driver_id || !t.arrived_at_restaurant || !t.picked_up_at) continue;
      const diffMin = (new Date(t.picked_up_at).getTime() - new Date(t.arrived_at_restaurant).getTime()) / 60000;
      if (diffMin < 0 || diffMin > 60) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, times: [] };
      prev.times.push(diffMin);
      groupCur.set(t.driver_id, prev);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number[]>();
    for (const t of prevRes.data ?? []) {
      if (!t.driver_id || !t.arrived_at_restaurant || !t.picked_up_at) continue;
      const diffMin = (new Date(t.picked_up_at).getTime() - new Date(t.arrived_at_restaurant).getTime()) / 60000;
      if (diffMin < 0 || diffMin > 60) continue;
      const arr = groupPrev.get(t.driver_id) ?? [];
      arr.push(diffMin);
      groupPrev.set(t.driver_id, arr);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:        id,
      fahrer_name:      v.name || id.slice(0, 8),
      avg_abholzeit_min: v.times.length
        ? Math.round((v.times.reduce((s, x) => s + x, 0) / v.times.length) * 10) / 10
        : 0,
    }));

    // INVERTED: aufsteigend — kürzeste Abholwartezeit = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => a.avg_abholzeit_min - b.avg_abholzeit_min);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const arr  = groupPrev.get(f.fahrer_id) ?? [];
      const pAvg = arr.length
        ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10
        : f.avg_abholzeit_min;
      return { fahrer_id: f.fahrer_id, avg: pAvg };
    }).sort((a, b) => a.avg - b.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:         f.fahrer_id,
        fahrer_name:       f.fahrer_name,
        rang,
        avg_abholzeit_min: f.avg_abholzeit_min,
        rank_delta:        prevRang - rang,
        ampel,
        alert_lang:        f.avg_abholzeit_min > 10,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_abholzeit_min, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_min:     teamAvg,
      schnellste_name:  sorted[0]?.fahrer_name ?? '',
      langsamste_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_lang).length,
      gesamt:           total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
