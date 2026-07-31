import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  einsatztage: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tage: number;
  fleissigster_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, einsatztage: 22, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, einsatztage: 18, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, einsatztage: 12, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, einsatztage:  5, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg_tage: 14.25,
  fleissigster_name: 'Julia F.',
  wenigste_name: 'Tim B.',
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
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_shifts')
        .select('driver_id, driver_name, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30.toISOString()),
      supabase
        .from('delivery_shifts')
        .select('driver_id, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30.toISOString())
        .lt('started_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; dates: Set<string> }>();
    for (const s of curData) {
      if (!s.started_at) continue;
      const dateKey = s.started_at.slice(0, 10);
      const prev = groupCur.get(s.driver_id);
      if (prev) {
        prev.dates.add(dateKey);
      } else {
        groupCur.set(s.driver_id, { name: s.driver_name ?? s.driver_id, dates: new Set([dateKey]) });
      }
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevByDriver = new Map<string, Set<string>>();
    for (const s of prevRes.data ?? []) {
      if (!s.started_at) continue;
      const dateKey = s.started_at.slice(0, 10);
      if (!prevByDriver.has(s.driver_id)) prevByDriver.set(s.driver_id, new Set());
      prevByDriver.get(s.driver_id)!.add(dateKey);
    }

    const drivers = Array.from(groupCur.entries()).map(([id, d]) => ({
      fahrer_id: id,
      fahrer_name: d.name,
      einsatztage: d.dates.size,
    }));

    drivers.sort((a, b) => b.einsatztage - a.einsatztage);
    const gesamt = drivers.length;

    const prevRanked = Array.from(prevByDriver.entries())
      .map(([id, dates]) => ({ id, count: dates.size }))
      .sort((a, b) => b.count - a.count);
    const prevMap = new Map<string, number>();
    prevRanked.forEach((f, i) => prevMap.set(f.id, i + 1));

    const fahrer: FahrerRow[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevMap.get(d.fahrer_id) ?? rang;
      return {
        ...d,
        rang,
        rank_delta: rang - prevRang,
        ampel: ampelVon(rang, gesamt),
        alert_wenig: d.einsatztage < 8,
      };
    });

    const teamAvgTage = fahrer.reduce((s, f) => s + f.einsatztage, 0) / gesamt;

    return NextResponse.json({
      fahrer,
      team_avg_tage: Math.round(teamAvgTage * 10) / 10,
      fleissigster_name: fahrer[0]?.fahrer_name ?? '',
      wenigste_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
