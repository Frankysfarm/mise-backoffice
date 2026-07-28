import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  vollstaendigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, vollstaendigkeit_pct: 97.0, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, vollstaendigkeit_pct: 94.0, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, vollstaendigkeit_pct: 91.0, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, vollstaendigkeit_pct: 84.0, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 91.5,
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
        .select('driver_id, driver_name, status')
        .eq('location_id', locationId)
        .in('status', ['delivered', 'failed', 'returned'])
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .in('status', ['delivered', 'failed', 'returned'])
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; delivered: number; total: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, delivered: 0, total: 0 };
      groupCur.set(o.driver_id, {
        name:      prev.name,
        delivered: prev.delivered + (o.status === 'delivered' ? 1 : 0),
        total:     prev.total + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { delivered: number; total: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { delivered: 0, total: 0 };
      groupPrev.set(o.driver_id, {
        delivered: prev.delivered + (o.status === 'delivered' ? 1 : 0),
        total:     prev.total + 1,
      });
    }

    const calcPct = (acc: { delivered: number; total: number }) =>
      acc.total > 0 ? Math.round((acc.delivered / acc.total) * 1000) / 10 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:            id,
      fahrer_name:          v.name || id.slice(0, 8),
      vollstaendigkeit_pct: calcPct(v),
    }));

    // absteigend — höchste Vollständigkeitsrate = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.vollstaendigkeit_pct - a.vollstaendigkeit_pct);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p    = groupPrev.get(f.fahrer_id);
      const pVal = p ? calcPct(p) : f.vollstaendigkeit_pct;
      return { fahrer_id: f.fahrer_id, vollstaendigkeit_pct: pVal };
    }).sort((a, b) => b.vollstaendigkeit_pct - a.vollstaendigkeit_pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:            f.fahrer_id,
        fahrer_name:          f.fahrer_name,
        rang,
        vollstaendigkeit_pct: f.vollstaendigkeit_pct,
        rank_delta:           prevRang - rang,
        ampel,
        alert_niedrig:        f.vollstaendigkeit_pct < 88,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.vollstaendigkeit_pct, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_pct:    teamAvg,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt:          total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
