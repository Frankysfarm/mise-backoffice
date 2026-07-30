import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_stopp: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tps: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, touren_pro_stopp: 2.9, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 2, touren_pro_stopp: 2.4, rank_delta: -1, ampel: 'rot',   alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, touren_pro_stopp: 1.8, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 4, touren_pro_stopp: 1.3, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_tps: 2.1,
  meister_name: 'Max M.',
  wenigster_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(tps: number): 'gruen' | 'gelb' | 'rot' {
  if (tps >= 2.5) return 'rot';
  if (tps >= 1.5) return 'gelb';
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
        .select('driver_id, driver_name, stop_count')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start)
        .gt('stop_count', 0),
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, stop_count')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start)
        .gt('stop_count', 0),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Bucket = { name: string; count: number; total_stops: number };
    const groupCur = new Map<string, Bucket>();
    for (const b of curData) {
      const prev = groupCur.get(b.driver_id) ?? { name: b.driver_name ?? b.driver_id, count: 0, total_stops: 0 };
      groupCur.set(b.driver_id, {
        ...prev,
        count: prev.count + 1,
        total_stops: prev.total_stops + (b.stop_count ?? 1),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      tps: v.count > 0 ? Math.round((v.total_stops / v.count) * 10) / 10 : 0,
    }));
    const sorted = [...unsorted].sort((a, b) => b.tps - a.tps);
    const total  = sorted.length;

    type PrevBucket = { count: number; total_stops: number };
    const groupPrev = new Map<string, PrevBucket>();
    for (const b of prevRes.data ?? []) {
      const prev = groupPrev.get(b.driver_id) ?? { count: 0, total_stops: 0 };
      groupPrev.set(b.driver_id, {
        count: prev.count + 1,
        total_stops: prev.total_stops + (b.stop_count ?? 1),
      });
    }
    const prevSorted = [...unsorted]
      .map(f => ({
        id: f.fahrer_id,
        tps: (() => {
          const p = groupPrev.get(f.fahrer_id);
          return p && p.count > 0 ? p.total_stops / p.count : f.tps;
        })(),
      }))
      .sort((a, b) => b.tps - a.tps);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        touren_pro_stopp: f.tps,
        rank_delta: (prevRanks.get(f.fahrer_id) ?? rang) - rang,
        ampel: ampelVon(f.tps),
        alert_hoch: f.tps >= 2.5,
      };
    });

    const team_avg_tps = Math.round(
      (fahrer.reduce((s, f) => s + f.touren_pro_stopp, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_tps,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
