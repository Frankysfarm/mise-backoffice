import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_trinkgeld_eur: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_trinkgeld_eur: 3.20, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_trinkgeld_eur: 2.85, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_trinkgeld_eur: 2.10, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_trinkgeld_eur: 1.45, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_eur: 2.40,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
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
        .select('driver_id, driver_name, tip_eur')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('orders')
        .select('driver_id, tip_eur')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; tipSum: number }>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, tipSum: 0 };
      groupCur.set(o.driver_id, {
        name:   prev.name,
        total:  prev.total + 1,
        tipSum: prev.tipSum + (typeof o.tip_eur === 'number' ? o.tip_eur : 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; tipSum: number }>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { total: 0, tipSum: 0 };
      groupPrev.set(o.driver_id, {
        total:  prev.total + 1,
        tipSum: prev.tipSum + (typeof o.tip_eur === 'number' ? o.tip_eur : 0),
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:         id,
      fahrer_name:       v.name || id.slice(0, 8),
      avg_trinkgeld_eur: v.total > 0 ? Math.round((v.tipSum / v.total) * 100) / 100 : 0,
    }));

    // Absteigend: höchstes Trinkgeld = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.avg_trinkgeld_eur - a.avg_trinkgeld_eur);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pAvg = p && p.total > 0 ? Math.round((p.tipSum / p.total) * 100) / 100 : f.avg_trinkgeld_eur;
      return { fahrer_id: f.fahrer_id, avg_trinkgeld_eur: pAvg };
    }).sort((a, b) => b.avg_trinkgeld_eur - a.avg_trinkgeld_eur);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:         f.fahrer_id,
        fahrer_name:       f.fahrer_name,
        rang,
        avg_trinkgeld_eur: f.avg_trinkgeld_eur,
        rank_delta:        prevRang - rang,
        ampel,
        alert_niedrig:     ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_trinkgeld_eur, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_eur:  teamAvg,
      bester_name:   sorted[0]?.fahrer_name ?? '',
      letzter_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:   fahrer.filter(f => f.alert_niedrig).length,
      gesamt:        total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
