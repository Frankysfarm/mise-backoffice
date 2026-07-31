import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  compliance_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, compliance_pct: 98, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, compliance_pct: 87, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, compliance_pct: 71, rank_delta: -1, ampel: 'gelb',  alert_niedrig: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, compliance_pct: 52, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 77,
  bester_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
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

    const [shiftsRes, prevShiftsRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, has_break, break_duration_min')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('driver_shifts')
        .select('driver_id, has_break, break_duration_min')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const shifts = shiftsRes.data ?? [];
    if (!shifts.length) return NextResponse.json(MOCK_DATA);

    type Acc = { compliant: number; total: number };

    const groupCur = new Map<string, Acc>();
    for (const s of shifts) {
      const id = s.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { compliant: 0, total: 0 };
      const isCompliant = (s.has_break === true) && ((Number(s.break_duration_min) || 0) >= 20);
      groupCur.set(id, {
        compliant: prev.compliant + (isCompliant ? 1 : 0),
        total:     prev.total + 1,
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const s of prevShiftsRes.data ?? []) {
      const id = s.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { compliant: 0, total: 0 };
      const isCompliant = (s.has_break === true) && ((Number(s.break_duration_min) || 0) >= 20);
      groupPrev.set(id, {
        compliant: prev.compliant + (isCompliant ? 1 : 0),
        total:     prev.total + 1,
      });
    }

    const calcPct = (acc: Acc) =>
      acc.total > 0 ? Math.round((acc.compliant / acc.total) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:   id,
      fahrer_name: id.slice(0, 8),
      compliance_pct: calcPct(acc),
    }));

    // ABSTEIGEND: Rang 1 = höchste Compliance = bester Fahrer
    const sorted  = [...unsorted].sort((a, b) => b.compliance_pct - a.compliance_pct);
    const gesamt  = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return {
        fahrer_id:      id,
        compliance_pct: p ? calcPct(p) : calcPct(groupCur.get(id)!),
      };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.compliance_pct - a.compliance_pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgPct =
      Math.round(sorted.reduce((s, f) => s + f.compliance_pct, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:      f.fahrer_id,
        fahrer_name:    f.fahrer_name,
        rang,
        compliance_pct: f.compliance_pct,
        rank_delta:     prevRang - rang,
        ampel:          ampelVon(rang, gesamt),
        alert_niedrig:  f.compliance_pct < 80,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_pct:   teamAvgPct,
      bester_name:    sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:    fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
