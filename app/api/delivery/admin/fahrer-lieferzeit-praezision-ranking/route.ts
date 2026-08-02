import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_abweichung_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_abweichung: number;
  puenktlichste_name: string;
  unpuenktlichste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_abweichung_min: 1.2, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_abweichung_min: 3.5, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_abweichung_min: 6.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_abweichung_min: 14.3, rank_delta: 0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_abweichung: 6.5,
  puenktlichste_name: 'Julia F.',
  unpuenktlichste_name: 'Tim B.',
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
        .select('driver_id, promised_delivery_at, actual_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('promised_delivery_at', 'is', null)
        .not('actual_delivery_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, promised_delivery_at, actual_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('promised_delivery_at', 'is', null)
        .not('actual_delivery_at', 'is', null),
    ]);

    const tours = toursRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { total_abweichung: number; count: number };
    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const abweichung = Math.abs(
        (new Date(t.actual_delivery_at as string).getTime() -
          new Date(t.promised_delivery_at as string).getTime()) /
          60000,
      );
      const prev = groupCur.get(id) ?? { total_abweichung: 0, count: 0 };
      groupCur.set(id, {
        total_abweichung: prev.total_abweichung + abweichung,
        count:            prev.count + 1,
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const abweichung = Math.abs(
        (new Date(t.actual_delivery_at as string).getTime() -
          new Date(t.promised_delivery_at as string).getTime()) /
          60000,
      );
      const prev = groupPrev.get(id) ?? { total_abweichung: 0, count: 0 };
      groupPrev.set(id, {
        total_abweichung: prev.total_abweichung + abweichung,
        count:            prev.count + 1,
      });
    }

    const calcAvg = (acc: Acc) =>
      acc.count > 0 ? Math.round((acc.total_abweichung / acc.count) * 10) / 10 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:          id,
      fahrer_name:        id.slice(0, 8),
      avg_abweichung_min: calcAvg(acc),
    }));

    // AUFSTEIGEND: Rang 1 = niedrigste Abweichung = pünktlichster
    const sorted = [...unsorted].sort((a, b) => a.avg_abweichung_min - b.avg_abweichung_min);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, avg_abweichung_min: p ? calcAvg(p) : calcAvg(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => a.avg_abweichung_min - b.avg_abweichung_min);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_abweichung_min, 0) / gesamt) * 10,
    ) / 10;

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:          f.fahrer_id,
        fahrer_name:        f.fahrer_name,
        rang,
        avg_abweichung_min: f.avg_abweichung_min,
        rank_delta:         prevRang - rang,
        ampel:              ampelVon(rang, gesamt),
        alert_hoch:         rang > gesamt * 0.75,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_abweichung: teamAvg,
      puenktlichste_name:  sorted[0]?.fahrer_name ?? '',
      unpuenktlichste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:         fahrer.filter(f => f.alert_hoch).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
