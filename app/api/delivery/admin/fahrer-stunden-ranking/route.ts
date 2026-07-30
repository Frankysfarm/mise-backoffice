import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stunden_gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stunden: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stunden_gesamt: 92, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, stunden_gesamt: 78, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, stunden_gesamt: 55, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stunden_gesamt: 32, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_stunden: 64.25,
  bester_name:  'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(h: number): 'gruen' | 'gelb' | 'rot' {
  if (h >= 80) return 'rot';
  if (h >= 40) return 'gelb';
  return 'gruen';
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
        .select('driver_id, driver_name, duration_hours')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('driver_shifts')
        .select('driver_id, duration_hours')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; hours: number }>();
    for (const s of curData) {
      if (!s.driver_id) continue;
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, hours: 0 };
      groupCur.set(s.driver_id, { name: prev.name, hours: prev.hours + (s.duration_hours ?? 0) });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const s of prevRes.data ?? []) {
      if (!s.driver_id) continue;
      groupPrev.set(s.driver_id, (groupPrev.get(s.driver_id) ?? 0) + (s.duration_hours ?? 0));
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:      id,
      fahrer_name:    v.name || id.slice(0, 8),
      stunden_gesamt: Math.round(v.hours * 10) / 10,
    }));

    // Descending — most hours = Rang 1 = best
    const sorted = [...unsorted].sort((a, b) => b.stunden_gesamt - a.stunden_gesamt);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => ({
      fahrer_id: f.fahrer_id,
      hours: groupPrev.get(f.fahrer_id) ?? f.stunden_gesamt,
    })).sort((a, b) => b.hours - a.hours);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel      = ampelVon(f.stunden_gesamt);
      const alert_hoch = f.stunden_gesamt >= 80;
      return {
        fahrer_id:      f.fahrer_id,
        fahrer_name:    f.fahrer_name,
        rang,
        stunden_gesamt: f.stunden_gesamt,
        rank_delta:     prevRang - rang,
        ampel,
        alert_hoch,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.stunden_gesamt, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_stunden: teamAvg,
      bester_name:   sorted[0]?.fahrer_name ?? '',
      letzter_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:   fahrer.filter(f => f.alert_hoch).length,
      gesamt:        total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
