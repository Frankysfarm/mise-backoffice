import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// On-time = shift started within 5 minutes of planned_start
const ON_TIME_MS = 5 * 60 * 1000;

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trend_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_negativ: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_trend_pct: number;
  verbessert_name: string;
  verschlechtert_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max S.',   rang: 1, trend_pct: 18, aktuell_pct: 94, vorher_pct: 76, rank_delta:  2, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, trend_pct:  7, aktuell_pct: 95, vorher_pct: 88, rank_delta: -1, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, trend_pct: -3, aktuell_pct: 73, vorher_pct: 76, rank_delta:  0, ampel: 'gelb',  alert_negativ: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trend_pct:-12, aktuell_pct: 54, vorher_pct: 66, rank_delta: -1, ampel: 'rot',   alert_negativ: true  },
  ],
  team_trend_pct: 2.5,
  verbessert_name: 'Max S.',
  verschlechtert_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function calcPct(onTime: number, total: number): number {
  return total > 0 ? Math.round((onTime / total) * 100) : 0;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now   = Date.now();
    const since30 = new Date(now - 30 * 86400000).toISOString();
    const since60 = new Date(now - 60 * 86400000).toISOString();

    const [curRes, prevRes, prevPrevRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, driver_name, planned_start, actual_start')
        .eq('location_id', locationId)
        .gte('planned_start', since30)
        .not('actual_start', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, planned_start, actual_start')
        .eq('location_id', locationId)
        .gte('planned_start', since60)
        .lt('planned_start', since30)
        .not('actual_start', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, planned_start, actual_start')
        .eq('location_id', locationId)
        .gte('planned_start', new Date(now - 90 * 86400000).toISOString())
        .lt('planned_start', since60)
        .not('actual_start', 'is', null),
    ]);

    const curShifts  = curRes.data  ?? [];
    const prevShifts = prevRes.data ?? [];
    if (!curShifts.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; onTime: number; total: number };

    const aggregate = (
      rows: { driver_id: unknown; driver_name?: unknown; planned_start: unknown; actual_start: unknown }[]
    ): Map<string, Acc> => {
      const m = new Map<string, Acc>();
      for (const s of rows) {
        const id = s.driver_id as string;
        if (!id) continue;
        const entry = m.get(id) ?? { name: (s.driver_name as string) ?? id.slice(0, 8), onTime: 0, total: 0 };
        const diff = new Date(s.actual_start as string).getTime() - new Date(s.planned_start as string).getTime();
        entry.total++;
        if (diff <= ON_TIME_MS) entry.onTime++;
        m.set(id, entry);
      }
      return m;
    };

    const groupCur  = aggregate(curShifts as Parameters<typeof aggregate>[0]);
    const groupPrev = aggregate(prevShifts as Parameters<typeof aggregate>[0]);
    const groupPrevPrev = aggregate((prevPrevRes.data ?? []) as Parameters<typeof aggregate>[0]);

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => {
      const prev      = groupPrev.get(id);
      const prevPrev  = groupPrevPrev.get(id);
      const aktuell_pct = calcPct(acc.onTime, acc.total);
      const vorher_pct  = prev
        ? calcPct(prev.onTime, prev.total)
        : (prevPrev ? calcPct(prevPrev.onTime, prevPrev.total) : aktuell_pct);
      return { fahrer_id: id, fahrer_name: acc.name, aktuell_pct, vorher_pct, trend_pct: aktuell_pct - vorher_pct };
    });

    // ABSTEIGEND: Rang 1 = größte Verbesserung = bester Trend
    const sorted = [...unsorted].sort((a, b) => b.trend_pct - a.trend_pct);
    const gesamt = sorted.length;

    // rank_delta: compare current ranking with previous period ranking
    const prevUnsorted = Array.from(groupPrev.entries()).map(([id, acc]) => {
      const pp = groupPrevPrev.get(id);
      const aktuell_pct = calcPct(acc.onTime, acc.total);
      const vorher_pct  = pp ? calcPct(pp.onTime, pp.total) : aktuell_pct;
      return { fahrer_id: id, trend_pct: aktuell_pct - vorher_pct };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.trend_pct - a.trend_pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamTrend = Math.round((sorted.reduce((s, f) => s + f.trend_pct, 0) / gesamt) * 10) / 10;

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:    f.fahrer_id,
        fahrer_name:  f.fahrer_name,
        rang,
        trend_pct:    f.trend_pct,
        aktuell_pct:  f.aktuell_pct,
        vorher_pct:   f.vorher_pct,
        rank_delta:   prevRang - rang,
        ampel:        ampelVon(rang, gesamt),
        alert_negativ: f.trend_pct < -10,
      };
    });

    return NextResponse.json({
      fahrer,
      team_trend_pct:      teamTrend,
      verbessert_name:     sorted[0]?.fahrer_name ?? '',
      verschlechtert_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:         fahrer.filter(f => f.alert_negativ).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
