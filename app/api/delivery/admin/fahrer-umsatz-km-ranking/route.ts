import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_km: 4.8, rank_delta:  1, ampel: 'rot',  alert_hoch: true  },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 2, umsatz_pro_km: 3.5, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, umsatz_pro_km: 2.9, rank_delta:  0, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_km: 1.8, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg: 3.25,
  meister_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(val: number): 'gruen' | 'gelb' | 'rot' {
  if (val >= 4.0) return 'rot';
  if (val >= 2.0) return 'gelb';
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
        .select('driver_id, driver_name, revenue, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start)
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, revenue, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start)
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Bucket = { name: string; total_revenue: number; total_km: number };
    const groupCur = new Map<string, Bucket>();
    for (const b of curData) {
      const prev = groupCur.get(b.driver_id) ?? { name: b.driver_name ?? b.driver_id, total_revenue: 0, total_km: 0 };
      groupCur.set(b.driver_id, {
        ...prev,
        total_revenue: prev.total_revenue + (b.revenue ?? 0),
        total_km: prev.total_km + (b.distance_km ?? 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      val: v.total_km > 0 ? Math.round((v.total_revenue / v.total_km) * 100) / 100 : 0,
    }));
    // descending: highest €/km = Rang 1 (best)
    const sorted = [...unsorted].sort((a, b) => b.val - a.val);
    const total = sorted.length;

    type PrevBucket = { total_revenue: number; total_km: number };
    const groupPrev = new Map<string, PrevBucket>();
    for (const b of prevRes.data ?? []) {
      const prev = groupPrev.get(b.driver_id) ?? { total_revenue: 0, total_km: 0 };
      groupPrev.set(b.driver_id, {
        total_revenue: prev.total_revenue + (b.revenue ?? 0),
        total_km: prev.total_km + (b.distance_km ?? 0),
      });
    }
    const prevSorted = [...unsorted]
      .map(f => ({
        id: f.fahrer_id,
        val: (() => {
          const p = groupPrev.get(f.fahrer_id);
          return p && p.total_km > 0 ? p.total_revenue / p.total_km : f.val;
        })(),
      }))
      .sort((a, b) => b.val - a.val);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        umsatz_pro_km: f.val,
        rank_delta: (prevRanks.get(f.fahrer_id) ?? rang) - rang,
        ampel: ampelVon(f.val),
        alert_hoch: f.val >= 4.0,
      };
    });

    const team_avg =
      Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_km, 0) / total) * 100) / 100;

    return NextResponse.json({
      fahrer,
      team_avg,
      meister_name: fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
