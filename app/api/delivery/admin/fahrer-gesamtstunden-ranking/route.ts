import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  gesamt_stunden: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_h: number;
  fleissigster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 1, gesamt_stunden: 148, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, gesamt_stunden: 131, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, gesamt_stunden: 109, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 4, gesamt_stunden:  87, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_h: 118.75,
  fleissigster_name: 'Tim B.',
  wenigster_name: 'Julia F.',
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
        .select('driver_id, driver_name, duration_minutes')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('driver_shifts')
        .select('driver_id, duration_minutes')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; minutes: number }>();
    for (const s of curData) {
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, minutes: 0 };
      groupCur.set(s.driver_id, { name: prev.name, minutes: prev.minutes + (s.duration_minutes ?? 0) });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const s of prevRes.data ?? []) {
      groupPrev.set(s.driver_id, (groupPrev.get(s.driver_id) ?? 0) + (s.duration_minutes ?? 0));
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      stunden: Math.round((v.minutes / 60) * 10) / 10,
    }));

    const sorted = [...unsorted].sort((a, b) => b.stunden - a.stunden);
    const total  = sorted.length;

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, stunden: Math.round(((groupPrev.get(f.fahrer_id) ?? 0) / 60) * 10) / 10 }))
      .sort((a, b) => b.stunden - a.stunden);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:     f.fahrer_id,
        fahrer_name:   f.fahrer_name,
        rang,
        gesamt_stunden: f.stunden,
        rank_delta:    prevRang - rang,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.stunden, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_h: teamAvg,
      fleissigster_name: sorted[0]?.fahrer_name ?? '',
      wenigster_name:    sorted[total - 1]?.fahrer_name ?? '',
      alert_count:       fahrer.filter(f => f.alert_niedrig).length,
      gesamt:            total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
