import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abbruch_pct: number;
  abbrueche: number;
  schichten: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_abbruch_pct: number;
  bester_name: string;
  hoechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, abbruch_pct: 1.5,  abbrueche: 1,  schichten: 67, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, abbruch_pct: 3.8,  abbrueche: 2,  schichten: 53, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, abbruch_pct: 7.2,  abbrueche: 4,  schichten: 55, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, abbruch_pct: 14.3, abbrueche: 8,  schichten: 56, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_abbruch_pct: 6.7,
  bester_name: 'Julia F.',
  hoechster_name: 'Tim B.',
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
        .from('driver_shifts')
        .select('driver_id, driver_name, status, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('driver_shifts')
        .select('driver_id, status, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; schichten: number; abbrueche: number }>();
    for (const s of curData) {
      if (!s.driver_id) continue;
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, schichten: 0, abbrueche: 0 };
      prev.schichten += 1;
      if (s.status === 'abgebrochen' || s.status === 'cancelled' || s.status === 'abandoned') {
        prev.abbrueche += 1;
      }
      groupCur.set(s.driver_id, prev);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { schichten: number; abbrueche: number }>();
    for (const s of prevRes.data ?? []) {
      if (!s.driver_id) continue;
      const prev = groupPrev.get(s.driver_id) ?? { schichten: 0, abbrueche: 0 };
      prev.schichten += 1;
      if (s.status === 'abgebrochen' || s.status === 'cancelled' || s.status === 'abandoned') {
        prev.abbrueche += 1;
      }
      groupPrev.set(s.driver_id, prev);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name || id.slice(0, 8),
      abbrueche:   v.abbrueche,
      schichten:   v.schichten,
      abbruch_pct: v.schichten > 0
        ? Math.round((v.abbrueche / v.schichten) * 1000) / 10
        : 0,
    }));

    // AUFSTEIGEND — niedrigste Abbruch-Quote = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => a.abbruch_pct - b.abbruch_pct);
    const total  = sorted.length;

    const prevSorted = unsorted.map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const prevPct = p && p.schichten > 0
        ? Math.round((p.abbrueche / p.schichten) * 1000) / 10
        : f.abbruch_pct;
      return { fahrer_id: f.fahrer_id, pct: prevPct };
    }).sort((a, b) => a.pct - b.pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:   f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        abbruch_pct: f.abbruch_pct,
        abbrueche:   f.abbrueche,
        schichten:   f.schichten,
        rank_delta:  prevRang - rang,
        ampel,
        alert_hoch:  ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvgPct = Math.round(
      (sorted.reduce((s, f) => s + f.abbruch_pct, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_abbruch_pct: teamAvgPct,
      bester_name:          sorted[0]?.fahrer_name ?? '',
      hoechster_name:       sorted[total - 1]?.fahrer_name ?? '',
      alert_count:          fahrer.filter(f => f.alert_hoch).length,
      gesamt:               total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
