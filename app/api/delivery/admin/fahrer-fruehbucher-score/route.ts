import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Frühbucher-Score: Anteil Schichten die ≥24h vor Beginn angenommen wurden
// ABSTEIGEND — höchste Quote = bester Planer = Rang 1

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  fruehbucher_quote_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, fruehbucher_quote_pct: 87, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, fruehbucher_quote_pct: 74, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, fruehbucher_quote_pct: 55, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, fruehbucher_quote_pct: 31, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 62,
  bester_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, total: number): Ampel {
  const pct = rang / total;
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
        .from('driver_shifts')
        .select('driver_id, driver_name, shift_start, accepted_at')
        .eq('location_id', locationId)
        .gte('shift_start', cur30Start)
        .not('accepted_at', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, shift_start, accepted_at')
        .eq('location_id', locationId)
        .gte('shift_start', prev30Start)
        .lt('shift_start', cur30Start)
        .not('accepted_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type ShiftRow = { driver_id: string; driver_name?: string | null; shift_start: string; accepted_at: string };
    const groupCur = new Map<string, { name: string; total: number; frueh: number }>();
    for (const s of curData as ShiftRow[]) {
      if (!s.driver_id || !s.accepted_at || !s.shift_start) continue;
      const hoursAhead = (new Date(s.shift_start).getTime() - new Date(s.accepted_at).getTime()) / 3600000;
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, total: 0, frueh: 0 };
      prev.total++;
      if (hoursAhead >= 24) prev.frueh++;
      groupCur.set(s.driver_id, prev);
    }

    const unsorted = Array.from(groupCur.entries())
      .filter(([, v]) => v.total >= 1)
      .map(([id, v]) => ({
        fahrer_id:   id,
        fahrer_name: v.name,
        fruehbucher_quote_pct: Math.round((v.frueh / v.total) * 100),
      }));

    if (!unsorted.length) return NextResponse.json(MOCK_DATA);

    const sorted = [...unsorted].sort((a, b) => b.fruehbucher_quote_pct - a.fruehbucher_quote_pct);
    const total  = sorted.length;

    type PrevRow = { driver_id: string; shift_start: string; accepted_at: string };
    const groupPrev = new Map<string, { total: number; frueh: number }>();
    for (const s of (prevRes.data ?? []) as PrevRow[]) {
      if (!s.driver_id || !s.accepted_at || !s.shift_start) continue;
      const hoursAhead = (new Date(s.shift_start).getTime() - new Date(s.accepted_at).getTime()) / 3600000;
      const prev = groupPrev.get(s.driver_id) ?? { total: 0, frueh: 0 };
      prev.total++;
      if (hoursAhead >= 24) prev.frueh++;
      groupPrev.set(s.driver_id, prev);
    }

    const prevSorted = unsorted.map(f => {
      const pv = groupPrev.get(f.fahrer_id);
      const pPct = pv && pv.total > 0 ? Math.round((pv.frueh / pv.total) * 100) : f.fruehbucher_quote_pct;
      return { fahrer_id: f.fahrer_id, pct: pPct };
    }).sort((a, b) => b.pct - a.pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const q1 = Math.floor(total * 0.25);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:   f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        fruehbucher_quote_pct: f.fruehbucher_quote_pct,
        rank_delta:  prevRang - rang,
        ampel:       ampelVon(rang, total),
        alert_niedrig: rang > total - q1,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      sorted.reduce((s, f) => s + f.fruehbucher_quote_pct, 0) / total
    );

    return NextResponse.json({
      fahrer,
      team_avg_pct:     teamAvg,
      bester_name:      sorted[0]?.fahrer_name ?? '',
      schlechteste_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_niedrig).length,
      gesamt:           total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
