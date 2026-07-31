import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Pünktlichkeit = Schicht innerhalb von 5 Minuten nach planned_start begonnen
const ON_TIME_MS = 5 * 60 * 1000;

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  schichten_gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_spaet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  puenktlichste_name: string;
  unzuverlaessigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 95, schichten_gesamt: 22, rank_delta:  1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, puenktlichkeit_pct: 88, schichten_gesamt: 18, rank_delta: -1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, puenktlichkeit_pct: 73, schichten_gesamt: 15, rank_delta:  0, ampel: 'gelb',  alert_spaet: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 54, schichten_gesamt: 13, rank_delta:  0, ampel: 'rot',   alert_spaet: true  },
  ],
  team_avg_pct: 78,
  puenktlichste_name: 'Julia F.',
  unzuverlaessigste_name: 'Tim B.',
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
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since60 = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
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
    ]);

    const shifts = curRes.data ?? [];
    if (!shifts.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; pünktlich: number; total: number };
    const groupCur = new Map<string, Acc>();
    for (const s of shifts) {
      const id = s.driver_id as string;
      if (!id) continue;
      const entry = groupCur.get(id) ?? { name: (s.driver_name as string) ?? id.slice(0, 8), pünktlich: 0, total: 0 };
      const diffMs = new Date(s.actual_start as string).getTime() - new Date(s.planned_start as string).getTime();
      entry.total++;
      if (diffMs <= ON_TIME_MS) entry.pünktlich++;
      groupCur.set(id, entry);
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevShifts = prevRes.data ?? [];
    const groupPrev = new Map<string, { pünktlich: number; total: number }>();
    for (const s of prevShifts) {
      const id = s.driver_id as string;
      if (!id) continue;
      const entry = groupPrev.get(id) ?? { pünktlich: 0, total: 0 };
      const diffMs = new Date(s.actual_start as string).getTime() - new Date(s.planned_start as string).getTime();
      entry.total++;
      if (diffMs <= ON_TIME_MS) entry.pünktlich++;
      groupPrev.set(id, entry);
    }

    const calcPct = (pünktlich: number, total: number) =>
      total > 0 ? Math.round((pünktlich / total) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id: id,
      fahrer_name: acc.name,
      puenktlichkeit_pct: calcPct(acc.pünktlich, acc.total),
      schichten_gesamt: acc.total,
    }));

    // ABSTEIGEND: Rang 1 = höchste Pünktlichkeit = bester Fahrer
    const sorted = [...unsorted].sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);
    const gesamt = sorted.length;

    const prevPcts = Array.from(groupCur.keys()).map(id => {
      const p = groupPrev.get(id);
      const c = groupCur.get(id)!;
      return { fahrer_id: id, pct: p ? calcPct(p.pünktlich, p.total) : calcPct(c.pünktlich, c.total) };
    });
    const prevSorted = [...prevPcts].sort((a, b) => b.pct - a.pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgPct = Math.round(sorted.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / gesamt);

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:          f.fahrer_id,
        fahrer_name:        f.fahrer_name,
        rang,
        puenktlichkeit_pct: f.puenktlichkeit_pct,
        schichten_gesamt:   f.schichten_gesamt,
        rank_delta:         prevRang - rang,
        ampel:              ampelVon(rang, gesamt),
        alert_spaet:        f.puenktlichkeit_pct < 75,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_pct:           teamAvgPct,
      puenktlichste_name:     sorted[0]?.fahrer_name ?? '',
      unzuverlaessigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:            fahrer.filter(f => f.alert_spaet).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
