import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tourzeit_min: number;
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
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 1, avg_tourzeit_min: 52.0, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 2, avg_tourzeit_min: 61.0, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, avg_tourzeit_min: 74.0, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_tourzeit_min: 95.0, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 70.5,
  schnellster_name: 'Sara K.',
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
        .from('deliveries')
        .select('driver_id, driver_name, departed_at, completed_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('departed_at', 'is', null)
        .not('completed_at', 'is', null),
      supabase
        .from('deliveries')
        .select('driver_id, departed_at, completed_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('departed_at', 'is', null)
        .not('completed_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; totalMin: number; count: number }>();
    for (const d of curData) {
      if (!d.driver_id) continue;
      const durMin = (new Date(d.completed_at as string).getTime() - new Date(d.departed_at as string).getTime()) / 60000;
      if (durMin <= 0 || durMin > 480) continue;
      const prev = groupCur.get(d.driver_id) ?? { name: d.driver_name ?? d.driver_id, totalMin: 0, count: 0 };
      groupCur.set(d.driver_id, { name: prev.name, totalMin: prev.totalMin + durMin, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { totalMin: number; count: number }>();
    for (const d of prevRes.data ?? []) {
      if (!d.driver_id) continue;
      const durMin = (new Date(d.completed_at as string).getTime() - new Date(d.departed_at as string).getTime()) / 60000;
      if (durMin <= 0 || durMin > 480) continue;
      const prev = groupPrev.get(d.driver_id) ?? { totalMin: 0, count: 0 };
      groupPrev.set(d.driver_id, { totalMin: prev.totalMin + durMin, count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:       id,
      fahrer_name:     v.name || id.slice(0, 8),
      avg_tourzeit_min: v.count > 0 ? Math.round((v.totalMin / v.count) * 10) / 10 : 0,
    }));

    // INVERTED: aufsteigend — kürzeste Tourzeit = bester = Rang 1
    const sorted = [...unsorted].sort((a, b) => a.avg_tourzeit_min - b.avg_tourzeit_min);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pMin = p && p.count > 0 ? p.totalMin / p.count : f.avg_tourzeit_min;
      return { fahrer_id: f.fahrer_id, avg_tourzeit_min: pMin };
    }).sort((a, b) => a.avg_tourzeit_min - b.avg_tourzeit_min);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        avg_tourzeit_min: f.avg_tourzeit_min,
        rank_delta:      prevRang - rang,
        ampel,
        alert_hoch:      f.avg_tourzeit_min > 90,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_tourzeit_min, 0) / total) * 10
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
