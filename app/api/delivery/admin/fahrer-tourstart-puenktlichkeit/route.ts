import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_verzoegerung_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_verspaetet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
  ziel_min: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_verzoegerung_min:  0, rank_delta:  1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_verzoegerung_min:  2, rank_delta: -1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_verzoegerung_min:  5, rank_delta:  0, ampel: 'gelb',  alert_verspaetet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_verzoegerung_min: 12, rank_delta:  0, ampel: 'rot',   alert_verspaetet: true  },
  ],
  team_avg_min: 4.75,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_min: 0,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  // ascending: Rang 1 = kürzeste Verzögerung = bester → grün für Top-25%
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
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, planned_start_at, actual_start_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('planned_start_at', 'is', null)
        .not('actual_start_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, planned_start_at, actual_start_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('planned_start_at', 'is', null)
        .not('actual_start_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sumMin: number; count: number }>();
    for (const t of curData) {
      const planned = new Date(t.planned_start_at).getTime();
      const actual = new Date(t.actual_start_at).getTime();
      const delayMin = Math.max(0, (actual - planned) / 60000);
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, sumMin: 0, count: 0 };
      groupCur.set(t.driver_id, { name: prev.name, sumMin: prev.sumMin + delayMin, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevData = prevRes.data ?? [];
    const groupPrev = new Map<string, { sumMin: number; count: number }>();
    for (const t of prevData) {
      const planned = new Date(t.planned_start_at).getTime();
      const actual = new Date(t.actual_start_at).getTime();
      const delayMin = Math.max(0, (actual - planned) / 60000);
      const prev = groupPrev.get(t.driver_id) ?? { sumMin: 0, count: 0 };
      groupPrev.set(t.driver_id, { sumMin: prev.sumMin + delayMin, count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg: v.count > 0 ? Math.round((v.sumMin / v.count) * 10) / 10 : 0,
    }));

    // ascending: Rang 1 = kürzeste Verzögerung = bester
    const sorted = [...unsorted].sort((a, b) => a.avg - b.avg);
    const total = sorted.length;

    const prevAvgs = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [id, v.count > 0 ? v.sumMin / v.count : 0])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg: prevAvgs.get(f.fahrer_id) ?? f.avg }))
      .sort((a, b) => a.avg - b.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_verzoegerung_min: f.avg,
        rank_delta: prevRang - rang,
        ampel,
        alert_verspaetet: ampel === 'rot',
      };
    });

    const team_avg_min = Math.round((fahrer.reduce((s, f) => s + f.avg_verzoegerung_min, 0) / total) * 10) / 10;

    const result = {
      fahrer,
      team_avg_min,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_verspaetet).length,
      gesamt: total,
      ziel_min: 0,
    } satisfies ApiResponse;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({ ...result, fahrer_single: me ?? null });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
