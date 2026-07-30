import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 1, km_pro_tour: 3.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 2, km_pro_tour: 4.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 3, km_pro_tour: 6.5, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, km_pro_tour: 9.1, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_km: 5.9,
  meister_name: 'Sara K.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km >= 8.0) return 'rot';
  if (km >= 5.5) return 'gelb';
  return 'gruen';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, driver_name, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start)
        .not('distance_km', 'is', null),
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start)
        .not('distance_km', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Bucket = { name: string; count: number; total_km: number };
    const groupCur = new Map<string, Bucket>();
    for (const b of curData) {
      const prev = groupCur.get(b.driver_id) ?? { name: b.driver_name ?? b.driver_id, count: 0, total_km: 0 };
      groupCur.set(b.driver_id, {
        ...prev,
        count: prev.count + 1,
        total_km: prev.total_km + (b.distance_km ?? 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      km: v.count > 0 ? Math.round((v.total_km / v.count) * 10) / 10 : 0,
    }));
    // INVERTED: ascending sort — lowest km/tour = Rang 1 (most efficient)
    const sorted = [...unsorted].sort((a, b) => a.km - b.km);
    const total  = sorted.length;

    type PrevBucket = { count: number; total_km: number };
    const groupPrev = new Map<string, PrevBucket>();
    for (const b of prevRes.data ?? []) {
      const prev = groupPrev.get(b.driver_id) ?? { count: 0, total_km: 0 };
      groupPrev.set(b.driver_id, {
        count: prev.count + 1,
        total_km: prev.total_km + (b.distance_km ?? 0),
      });
    }
    const prevSorted = [...unsorted]
      .map(f => ({
        id: f.fahrer_id,
        km: (() => {
          const p = groupPrev.get(f.fahrer_id);
          return p && p.count > 0 ? p.total_km / p.count : f.km;
        })(),
      }))
      .sort((a, b) => a.km - b.km);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        km_pro_tour: f.km,
        rank_delta: (prevRanks.get(f.fahrer_id) ?? rang) - rang,
        ampel: ampelVon(f.km),
        alert_hoch: f.km >= 8.0,
      };
    });

    const team_avg_km = Math.round(
      (fahrer.reduce((s, f) => s + f.km_pro_tour, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_km,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
