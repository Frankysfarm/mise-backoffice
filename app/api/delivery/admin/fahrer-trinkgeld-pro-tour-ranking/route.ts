import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_trinkgeld: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_trinkgeld: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_trinkgeld: 2.80, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_trinkgeld: 2.10, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_trinkgeld: 1.50, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_trinkgeld: 0.40, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_trinkgeld: 1.70,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
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
        .select('driver_id, driver_name, tip_amount')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, tip_amount')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; totalTip: number; tours: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, totalTip: 0, tours: 0 };
      groupCur.set(o.driver_id, {
        name:     prev.name,
        totalTip: prev.totalTip + (Number(o.tip_amount) || 0),
        tours:    prev.tours + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { totalTip: number; tours: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { totalTip: 0, tours: 0 };
      groupPrev.set(o.driver_id, {
        totalTip: prev.totalTip + (Number(o.tip_amount) || 0),
        tours:    prev.tours + 1,
      });
    }

    const avgTip = (acc: { totalTip: number; tours: number }) =>
      acc.tours > 0 ? Math.round((acc.totalTip / acc.tours) * 100) / 100 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:    id,
      fahrer_name:  v.name || id.slice(0, 8),
      avg_trinkgeld: avgTip(v),
    }));

    // absteigend — höchstes Trinkgeld/Tour = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.avg_trinkgeld - a.avg_trinkgeld);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p    = groupPrev.get(f.fahrer_id);
      const pVal = p ? avgTip(p) : f.avg_trinkgeld;
      return { fahrer_id: f.fahrer_id, avg_trinkgeld: pVal };
    }).sort((a, b) => b.avg_trinkgeld - a.avg_trinkgeld);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:     f.fahrer_id,
        fahrer_name:   f.fahrer_name,
        rang,
        avg_trinkgeld: f.avg_trinkgeld,
        rank_delta:    prevRang - rang,
        ampel,
        alert_niedrig: f.avg_trinkgeld < 0.50,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_trinkgeld, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_trinkgeld: teamAvg,
      beste_name:         sorted[0]?.fahrer_name ?? '',
      niedrigste_name:    sorted[total - 1]?.fahrer_name ?? '',
      alert_count:        fahrer.filter(f => f.alert_niedrig).length,
      gesamt:             total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
