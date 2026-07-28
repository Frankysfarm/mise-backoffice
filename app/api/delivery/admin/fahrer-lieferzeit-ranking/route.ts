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
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 28, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 2, avg_min: 32, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, avg_min: 37, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 44, rank_delta:  0, ampel: 'rot',   alert_hoch: false },
  ],
  team_avg_min: 35.25,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
  alert_count: 0,
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
        .from('orders')
        .select('driver_id, driver_name, delivery_duration_min')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start),
      supabase
        .from('orders')
        .select('driver_id, delivery_duration_min')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; sumMin: number }>();
    for (const o of curData) {
      if (!o.driver_id || o.delivery_duration_min == null) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, sumMin: 0 };
      groupCur.set(o.driver_id, {
        name:   prev.name,
        total:  prev.total + 1,
        sumMin: prev.sumMin + (o.delivery_duration_min as number),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; sumMin: number }>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id || o.delivery_duration_min == null) continue;
      const prev = groupPrev.get(o.driver_id) ?? { total: 0, sumMin: 0 };
      groupPrev.set(o.driver_id, {
        total:  prev.total + 1,
        sumMin: prev.sumMin + (o.delivery_duration_min as number),
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name || id.slice(0, 8),
      avg_min:     v.total > 0 ? Math.round((v.sumMin / v.total) * 10) / 10 : 0,
    }));

    // INVERTED: aufsteigend — niedrigste avg_min = Rang 1 = schnellste = bester
    const sorted = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pAvg = p && p.total > 0 ? Math.round((p.sumMin / p.total) * 10) / 10 : f.avg_min;
      return { fahrer_id: f.fahrer_id, avg_min: pAvg };
    }).sort((a, b) => a.avg_min - b.avg_min);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:   f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_min:     f.avg_min,
        rank_delta:  prevRang - rang,
        ampel,
        alert_hoch:  false,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_min, 0) / total) * 10
    ) / 10;

    const alertCount = teamAvg > 45 ? 1 : 0;

    return NextResponse.json({
      fahrer,
      team_avg_min:    teamAvg,
      schnellste_name: sorted[0]?.fahrer_name ?? '',
      langsamste_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:     alertCount,
      gesamt:          total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
