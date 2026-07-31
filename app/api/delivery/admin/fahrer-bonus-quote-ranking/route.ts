import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bonus_quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 1, bonus_quote_pct: 67, rank_delta:  1, ampel: 'gruen', alert_hoch: true  },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 2, bonus_quote_pct: 52, rank_delta: -1, ampel: 'gruen', alert_hoch: true  },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, bonus_quote_pct: 38, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bonus_quote_pct: 24, rank_delta:  0, ampel: 'rot',   alert_hoch: false },
  ],
  team_avg_pct: 45,
  meister_name: 'Max M.',
  wenigster_name: 'Tim B.',
  alert_count: 2,
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

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, bonus')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, bonus')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const tours = curRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { mit_bonus: number; total: number };

    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { mit_bonus: 0, total: 0 };
      const hasBonus = typeof t.bonus === 'number' ? t.bonus > 0 : Boolean(t.bonus);
      groupCur.set(id, {
        mit_bonus: prev.mit_bonus + (hasBonus ? 1 : 0),
        total: prev.total + 1,
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { mit_bonus: 0, total: 0 };
      const hasBonus = typeof t.bonus === 'number' ? t.bonus > 0 : Boolean(t.bonus);
      groupPrev.set(id, {
        mit_bonus: prev.mit_bonus + (hasBonus ? 1 : 0),
        total: prev.total + 1,
      });
    }

    const calcPct = (acc: Acc) =>
      acc.total > 0 ? Math.round((acc.mit_bonus / acc.total) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:       id,
      fahrer_name:     id.slice(0, 8),
      bonus_quote_pct: calcPct(acc),
    }));

    // ABSTEIGEND: Rang 1 = höchste Bonus-Quote = bester Fahrer
    const sorted = [...unsorted].sort((a, b) => b.bonus_quote_pct - a.bonus_quote_pct);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.keys()).map((id) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, bonus_quote_pct: p ? calcPct(p) : calcPct(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.bonus_quote_pct - a.bonus_quote_pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgPct =
      Math.round(sorted.reduce((s, f) => s + f.bonus_quote_pct, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        bonus_quote_pct: f.bonus_quote_pct,
        rank_delta:      prevRang - rang,
        ampel:           ampelVon(rang, gesamt),
        alert_hoch:      f.bonus_quote_pct >= 50,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_pct: teamAvgPct,
      meister_name:  sorted[0]?.fahrer_name ?? '',
      wenigster_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:   fahrer.filter(f => f.alert_hoch).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
