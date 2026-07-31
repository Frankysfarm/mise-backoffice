import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_gesamt: number;
  touren_count: number;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max S.',   rang: 1, km_gesamt: 187, touren_count: 12, km_pro_tour: 15.6, rank_delta:  1, ampel: 'gruen', alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, km_gesamt: 142, touren_count: 10, km_pro_tour: 14.2, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, km_gesamt:  98, touren_count:  7, km_pro_tour: 14.0, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_gesamt:  54, touren_count:  4, km_pro_tour: 13.5, rank_delta:  0, ampel: 'rot',   alert_hoch: false },
  ],
  team_avg_km: 120,
  meister_name: 'Max S.',
  niedrigster_name: 'Tim B.',
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
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const now = Date.now();
    const since30 = new Date(now - 30 * 86400000).toISOString();
    const since60 = new Date(now - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('tours')
        .select('driver_id, driver_name, distance_km')
        .eq('location_id', location_id)
        .gte('completed_at', since30)
        .not('distance_km', 'is', null),
      supabase
        .from('tours')
        .select('driver_id, distance_km')
        .eq('location_id', location_id)
        .gte('completed_at', since60)
        .lt('completed_at', since30)
        .not('distance_km', 'is', null),
    ]);

    const curTours  = curRes.data  ?? [];
    const prevTours = prevRes.data ?? [];

    if (!curTours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; km: number; count: number };

    const aggregate = (
      rows: { driver_id: unknown; driver_name?: unknown; distance_km: unknown }[]
    ): Map<string, Acc> => {
      const m = new Map<string, Acc>();
      for (const t of rows) {
        const id = t.driver_id as string;
        if (!id) continue;
        const entry = m.get(id) ?? { name: (t.driver_name as string) ?? id.slice(0, 8), km: 0, count: 0 };
        entry.km    += Number(t.distance_km) || 0;
        entry.count += 1;
        m.set(id, entry);
      }
      return m;
    };

    const groupCur  = aggregate(curTours  as Parameters<typeof aggregate>[0]);
    const groupPrev = aggregate(prevTours as Parameters<typeof aggregate>[0]);

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    // ABSTEIGEND: Rang 1 = meiste km = bester
    const sorted = Array.from(groupCur.entries())
      .map(([id, acc]) => ({
        fahrer_id:   id,
        fahrer_name: acc.name,
        km_gesamt:   Math.round(acc.km),
        touren_count: acc.count,
        km_pro_tour: acc.count > 0 ? Math.round((acc.km / acc.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.km_gesamt - a.km_gesamt);

    const gesamt = sorted.length;

    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, acc]) => ({ fahrer_id: id, km: acc.km }))
      .sort((a, b) => b.km - a.km);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgKm = Math.round(sorted.reduce((s, f) => s + f.km_gesamt, 0) / gesamt);

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        ...f,
        rang,
        rank_delta: prevRang - rang,
        ampel:      ampelVon(rang, gesamt),
        alert_hoch: f.km_gesamt > 150,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_km:      teamAvgKm,
      meister_name:     sorted[0]?.fahrer_name ?? '',
      niedrigster_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_hoch).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
