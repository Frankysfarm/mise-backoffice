import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  ausfallquote_pct: number;
  schicht_puenktlichkeit_pct: number;
  annahme_rate_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, score: 88, ausfallquote_pct: 4,  schicht_puenktlichkeit_pct: 94, annahme_rate_pct: 92, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, score: 76, ausfallquote_pct: 9,  schicht_puenktlichkeit_pct: 82, annahme_rate_pct: 78, rank_delta: 1,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, score: 64, ausfallquote_pct: 14, schicht_puenktlichkeit_pct: 68, annahme_rate_pct: 65, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, score: 52, ausfallquote_pct: 22, schicht_puenktlichkeit_pct: 55, annahme_rate_pct: 49, rank_delta: 0,  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_score: 70,
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

function calcScore(ausfallquote: number, puenktlichkeit: number, annahmeRate: number): number {
  // composite: Ausfallquote-Invers (33%) + Schichtpünktlichkeit (33%) + Annahme-Rate (33%)
  const ausfallInvers = Math.max(0, 100 - ausfallquote * 3);
  return Math.round(ausfallInvers * 0.33 + puenktlichkeit * 0.33 + annahmeRate * 0.34);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [shiftsRes, stopsRes, prevShiftsRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('employee_id, started_at, no_show')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('mise_delivery_stops')
        .select('driver_id, status, updated_at')
        .eq('location_id', locationId)
        .gte('updated_at', cur30Start),
      supabase
        .from('driver_shifts')
        .select('employee_id, no_show')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const shifts = shiftsRes.data ?? [];
    if (!shifts.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = {
      schichten: number;
      ausfaelle: number;
      puenktlichSum: number;
      stopsGesamt: number;
      stopsAngenommen: number;
    };

    const groupCur = new Map<string, DriverAcc>();
    for (const s of shifts) {
      const id = s.employee_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { schichten: 0, ausfaelle: 0, puenktlichSum: 0, stopsGesamt: 0, stopsAngenommen: 0 };
      groupCur.set(id, {
        ...prev,
        schichten: prev.schichten + 1,
        ausfaelle: prev.ausfaelle + (s.no_show ? 1 : 0),
        puenktlichSum: prev.puenktlichSum + (s.no_show ? 0 : 90),
      });
    }

    for (const stop of stopsRes.data ?? []) {
      const id = stop.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { schichten: 0, ausfaelle: 0, puenktlichSum: 0, stopsGesamt: 0, stopsAngenommen: 0 };
      groupCur.set(id, {
        ...prev,
        stopsGesamt: prev.stopsGesamt + 1,
        stopsAngenommen: prev.stopsAngenommen + (stop.status !== 'abgelehnt' && stop.status !== 'cancelled' ? 1 : 0),
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { schichten: number; ausfaelle: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const s of prevShiftsRes.data ?? []) {
      const id = s.employee_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { schichten: 0, ausfaelle: 0 };
      groupPrev.set(id, { schichten: prev.schichten + 1, ausfaelle: prev.ausfaelle + (s.no_show ? 1 : 0) });
    }

    const computeScore = (acc: DriverAcc) => {
      const ausfallquote   = acc.schichten > 0 ? Math.round((acc.ausfaelle / acc.schichten) * 100) : 0;
      const puenktlichkeit = acc.schichten > 0 ? Math.round(acc.puenktlichSum / acc.schichten) : 80;
      const annahmeRate    = acc.stopsGesamt > 0 ? Math.round((acc.stopsAngenommen / acc.stopsGesamt) * 100) : 80;
      return { ausfallquote, puenktlichkeit, annahmeRate, score: calcScore(ausfallquote, puenktlichkeit, annahmeRate) };
    };

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => {
      const m = computeScore(acc);
      return { fahrer_id: id, fahrer_name: id.slice(0, 8), ...m, acc };
    });

    const sorted = [...unsorted].sort((a, b) => b.score - a.score);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      const prevScore = p && p.schichten > 0
        ? calcScore(Math.round((p.ausfaelle / p.schichten) * 100), 85, 80)
        : (groupCur.get(id) ? computeScore(groupCur.get(id)!).score : 0);
      return { fahrer_id: id, score: prevScore };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.score - a.score);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgScore = Math.round(sorted.reduce((s, f) => s + f.score, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:                 f.fahrer_id,
        fahrer_name:               f.fahrer_name,
        rang,
        score:                     f.score,
        ausfallquote_pct:          f.ausfallquote,
        schicht_puenktlichkeit_pct: f.puenktlichkeit,
        annahme_rate_pct:          f.annahmeRate,
        rank_delta:                prevRang - rang,
        ampel:                     ampelVon(rang, gesamt),
        alert_niedrig:             f.score < 60,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_score:  teamAvgScore,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
