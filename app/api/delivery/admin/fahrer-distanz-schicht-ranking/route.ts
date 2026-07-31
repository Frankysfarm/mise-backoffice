import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_je_schicht: number;
  total_km: number;
  schicht_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_je_schicht: 42, total_km: 336, schicht_count: 8, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, km_je_schicht: 31, total_km: 217, schicht_count: 7, rank_delta: 1,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, km_je_schicht: 19, total_km: 114, schicht_count: 6, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_je_schicht: 11, total_km:  55, schicht_count: 5, rank_delta: 0,  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_km: 26,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
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
        .select('driver_id, distance_km, created_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const tours = toursRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { total_km: number; schicht_count: number };
    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { total_km: 0, schicht_count: 0 };
      groupCur.set(id, {
        total_km:     prev.total_km     + (Number(t.distance_km) || 0),
        schicht_count: prev.schicht_count + 1,
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { total_km: 0, schicht_count: 0 };
      groupPrev.set(id, {
        total_km:      prev.total_km      + (Number(t.distance_km) || 0),
        schicht_count: prev.schicht_count + 1,
      });
    }

    const calcKm = (acc: Acc) =>
      acc.schicht_count > 0 ? Math.round(acc.total_km / acc.schicht_count) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:    id,
      fahrer_name:  id.slice(0, 8),
      km_je_schicht: calcKm(acc),
      total_km:     Math.round(acc.total_km),
      schicht_count: acc.schicht_count,
    }));

    const sorted = [...unsorted].sort((a, b) => b.km_je_schicht - a.km_je_schicht);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, km_je_schicht: p ? calcKm(p) : calcKm(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.km_je_schicht - a.km_je_schicht);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgKm = Math.round(sorted.reduce((s, f) => s + f.km_je_schicht, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:     f.fahrer_id,
        fahrer_name:   f.fahrer_name,
        rang,
        km_je_schicht: f.km_je_schicht,
        total_km:      f.total_km,
        schicht_count: f.schicht_count,
        rank_delta:    prevRang - rang,
        ampel:         ampelVon(rang, gesamt),
        alert_niedrig: f.km_je_schicht < 15,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_km:     teamAvgKm,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
