import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  effizienteste_name: string;
  laengste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 1, avg_min: 3.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 2, avg_min: 4.8, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, avg_min: 6.5, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 9.1, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 5.9,
  effizienteste_name: 'Sara K.',
  laengste_name: 'Tim B.',
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
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [toursRes, prevToursRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, stop_duration_min')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('stop_duration_min', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, stop_duration_min')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('stop_duration_min', 'is', null),
    ]);

    const tours = toursRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { total: number; count: number };

    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { total: 0, count: 0 };
      groupCur.set(id, {
        total: prev.total + (Number(t.stop_duration_min) || 0),
        count: prev.count + 1,
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { total: 0, count: 0 };
      groupPrev.set(id, {
        total: prev.total + (Number(t.stop_duration_min) || 0),
        count: prev.count + 1,
      });
    }

    const calcAvg = (acc: Acc) =>
      acc.count > 0 ? Math.round((acc.total / acc.count) * 10) / 10 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:   id,
      fahrer_name: id.slice(0, 8),
      avg_min:     calcAvg(acc),
    }));

    // AUFSTEIGEND: Rang 1 = niedrigste Verweildauer = effizientester Fahrer
    const sorted  = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const gesamt  = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, avg_min: p ? calcAvg(p) : calcAvg(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => a.avg_min - b.avg_min);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgMin =
      Math.round((sorted.reduce((s, f) => s + f.avg_min, 0) / gesamt) * 10) / 10;

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:   f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_min:     f.avg_min,
        rank_delta:  prevRang - rang,
        ampel:       ampelVon(rang, gesamt),
        alert_hoch:  f.avg_min > 8,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_min:       teamAvgMin,
      effizienteste_name: sorted[0]?.fahrer_name ?? '',
      laengste_name:      sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:        fahrer.filter(f => f.alert_hoch).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
