import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_anzahl: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_touren: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_anzahl: 67, rank_delta:  1, ampel: 'rot',  alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, touren_anzahl: 52, rank_delta:  0, ampel: 'rot',  alert_hoch: true  },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, touren_anzahl: 38, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_anzahl: 21, rank_delta:  0, ampel: 'gruen',alert_hoch: false },
  ],
  team_avg_touren: 44.5,
  bester_name:  'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function ampelVon(touren: number): 'gruen' | 'gelb' | 'rot' {
  if (touren >= 50) return 'rot';
  if (touren >= 25) return 'gelb';
  return 'gruen';
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
        .select('driver_id, driver_name')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; count: number }>();
    for (const t of curData) {
      if (!t.driver_id) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, count: 0 };
      groupCur.set(t.driver_id, { name: prev.name, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const t of prevRes.data ?? []) {
      if (!t.driver_id) continue;
      groupPrev.set(t.driver_id, (groupPrev.get(t.driver_id) ?? 0) + 1);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:     id,
      fahrer_name:   v.name || id.slice(0, 8),
      touren_anzahl: v.count,
    }));

    // Descending — most tours = Rang 1 = best
    const sorted = [...unsorted].sort((a, b) => b.touren_anzahl - a.touren_anzahl);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => ({
      fahrer_id: f.fahrer_id,
      count: groupPrev.get(f.fahrer_id) ?? f.touren_anzahl,
    })).sort((a, b) => b.count - a.count);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel      = ampelVon(f.touren_anzahl);
      const alert_hoch = f.touren_anzahl >= 50;
      return {
        fahrer_id:     f.fahrer_id,
        fahrer_name:   f.fahrer_name,
        rang,
        touren_anzahl: f.touren_anzahl,
        rank_delta:    prevRang - rang,
        ampel,
        alert_hoch,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.touren_anzahl, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_touren: teamAvg,
      bester_name:   sorted[0]?.fahrer_name ?? '',
      letzter_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:   fahrer.filter(f => f.alert_hoch).length,
      gesamt:        total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
