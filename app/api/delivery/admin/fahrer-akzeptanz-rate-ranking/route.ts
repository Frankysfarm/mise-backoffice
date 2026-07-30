import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  akzeptanz_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_akzeptanz: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, akzeptanz_rate: 96, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, akzeptanz_rate: 89, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, akzeptanz_rate: 78, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, akzeptanz_rate: 62, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_akzeptanz: 81.25,
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
    const since30  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30   = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('assignment_suggestions')
        .select('driver_id, status, mise_drivers(name)')
        .eq('location_id', locationId)
        .gte('created_at', since30),
      supabase
        .from('assignment_suggestions')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', prev30)
        .lt('created_at', since30),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; total: number; accepted: number };
    const groupCur = new Map<string, Acc>();
    for (const row of curData) {
      if (!row.driver_id) continue;
      const name = (Array.isArray(row.mise_drivers) ? row.mise_drivers[0] : (row.mise_drivers as { name: string } | null))?.name ?? row.driver_id.slice(0, 8);
      const prev = groupCur.get(row.driver_id) ?? { name, total: 0, accepted: 0 };
      groupCur.set(row.driver_id, {
        name:     prev.name,
        total:    prev.total + 1,
        accepted: prev.accepted + (row.status === 'accepted' ? 1 : 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { total: number; accepted: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const row of prevRes.data ?? []) {
      if (!row.driver_id) continue;
      const prev = groupPrev.get(row.driver_id) ?? { total: 0, accepted: 0 };
      groupPrev.set(row.driver_id, {
        total:    prev.total + 1,
        accepted: prev.accepted + (row.status === 'accepted' ? 1 : 0),
      });
    }

    const rateOf = (total: number, accepted: number) =>
      total > 0 ? Math.round((accepted / total) * 1000) / 10 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      rate:        rateOf(v.total, v.accepted),
    }));

    const sorted = [...unsorted].sort((a, b) => b.rate - a.rate);
    const gesamt = sorted.length;

    const prevSorted = unsorted
      .map(f => {
        const p = groupPrev.get(f.fahrer_id);
        return { fahrer_id: f.fahrer_id, rate: p ? rateOf(p.total, p.accepted) : f.rate };
      })
      .sort((a, b) => b.rate - a.rate);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:      f.fahrer_id,
        fahrer_name:    f.fahrer_name,
        rang,
        akzeptanz_rate: f.rate,
        rank_delta:     prevRang - rang,
        ampel:          ampelVon(rang, gesamt),
        alert_niedrig:  f.rate < 75,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.rate, 0) / gesamt) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_akzeptanz: teamAvg,
      beste_name:         sorted[0]?.fahrer_name ?? '',
      niedrigste_name:    sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:        fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
