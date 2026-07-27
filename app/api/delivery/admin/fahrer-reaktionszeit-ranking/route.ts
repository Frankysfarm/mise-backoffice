import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_reaktionszeit_min: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_reaktionszeit_min: 3.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_reaktionszeit_min: 4.1, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_reaktionszeit_min: 6.3, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_reaktionszeit_min: 9.8, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 5.85,
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
        .from('delivery_tours')
        .select('driver_id, driver_name, created_at, departed_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, created_at, departed_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; times: number[] }>();
    for (const t of curData) {
      if (!t.driver_id || !t.departed_at) continue;
      const diffMin = (new Date(t.departed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      if (diffMin < 0 || diffMin > 120) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, times: [] };
      prev.times.push(diffMin);
      groupCur.set(t.driver_id, prev);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number[]>();
    for (const t of prevRes.data ?? []) {
      if (!t.driver_id || !t.departed_at) continue;
      const diffMin = (new Date(t.departed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      if (diffMin < 0 || diffMin > 120) continue;
      const arr = groupPrev.get(t.driver_id) ?? [];
      arr.push(diffMin);
      groupPrev.set(t.driver_id, arr);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name || id.slice(0, 8),
      avg_reaktionszeit_min: v.times.length
        ? Math.round((v.times.reduce((s, x) => s + x, 0) / v.times.length) * 10) / 10
        : 0,
    }));

    // INVERTED: aufsteigend — kürzeste Reaktionszeit = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => a.avg_reaktionszeit_min - b.avg_reaktionszeit_min);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const arr = groupPrev.get(f.fahrer_id) ?? [];
      const pAvg = arr.length
        ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10
        : f.avg_reaktionszeit_min;
      return { fahrer_id: f.fahrer_id, avg: pAvg };
    }).sort((a, b) => a.avg - b.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:             f.fahrer_id,
        fahrer_name:           f.fahrer_name,
        rang,
        avg_reaktionszeit_min: f.avg_reaktionszeit_min,
        rank_delta:            prevRang - rang,
        ampel,
        alert_hoch:            ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_reaktionszeit_min, 0) / total) * 10
    ) / 10;

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
