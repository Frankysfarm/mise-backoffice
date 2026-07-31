import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_wartezeit_min: number;
  tour_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wartezeit: number;
  beste_name: string;
  laengste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Tim B.',   rang: 1, avg_wartezeit_min: 3,  tour_count: 42, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_wartezeit_min: 5,  tour_count: 38, rank_delta:  1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', rang: 3, avg_wartezeit_min: 8,  tour_count: 61, rank_delta: -1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Max M.',   rang: 4, avg_wartezeit_min: 13, tour_count: 55, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_wartezeit: 7,
  beste_name: 'Tim B.',
  laengste_name: 'Max M.',
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
        .select('driver_id, pickup_wait_minutes')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('pickup_wait_minutes', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, pickup_wait_minutes')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('pickup_wait_minutes', 'is', null),
    ]);

    const tours = toursRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { sum: number; count: number };
    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { sum: 0, count: 0 };
      groupCur.set(id, { sum: prev.sum + (t.pickup_wait_minutes as number), count: prev.count + 1 });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { sum: 0, count: 0 };
      groupPrev.set(id, { sum: prev.sum + (t.pickup_wait_minutes as number), count: prev.count + 1 });
    }

    const calcAvg = (acc: Acc) =>
      acc.count > 0 ? Math.round(acc.sum / acc.count) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:         id,
      fahrer_name:       id.slice(0, 8),
      avg_wartezeit_min: calcAvg(acc),
      tour_count:        acc.count,
    }));

    // AUFSTEIGEND: Rang 1 = niedrigste Wartezeit = bester
    const sorted = [...unsorted].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, avg_wartezeit_min: p ? calcAvg(p) : calcAvg(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgWartezeit = Math.round(sorted.reduce((s, f) => s + f.avg_wartezeit_min, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:         f.fahrer_id,
        fahrer_name:       f.fahrer_name,
        rang,
        avg_wartezeit_min: f.avg_wartezeit_min,
        tour_count:        f.tour_count,
        rank_delta:        prevRang - rang,
        ampel:             ampelVon(rang, gesamt),
        alert_lang:        f.avg_wartezeit_min > 10,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_wartezeit: teamAvgWartezeit,
      beste_name:          sorted[0]?.fahrer_name ?? '',
      laengste_name:       sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:         fahrer.filter(f => f.alert_lang).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
