import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_stunden: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stunden: number;
  fleissigster_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_stunden: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_stunden: 7.5, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_stunden: 6.8, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_stunden: 5.5, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_stunden: 3.9, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg_stunden: 5.93,
  fleissigster_name: 'Julia F.',
  wenigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_stunden: 6,
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
        .select('driver_id, driver_name, started_at, ended_at, duration_hours')
        .eq('location_id', locationId)
        .gte('started_at', cur30.toISOString())
        .not('ended_at', 'is', null),
      supabase
        .from('delivery_shifts')
        .select('driver_id, started_at, ended_at, duration_hours')
        .eq('location_id', locationId)
        .gte('started_at', prev30.toISOString())
        .lt('started_at', cur30.toISOString())
        .not('ended_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; hSum: number; count: number }>();
    for (const s of curData) {
      let h = Number(s.duration_hours ?? 0);
      if (!h && s.started_at && s.ended_at) {
        h = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
      }
      if (h <= 0 || h > 24) continue;
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, hSum: 0, count: 0 };
      groupCur.set(s.driver_id, { name: prev.name, hSum: prev.hSum + h, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevByDriver = new Map<string, number[]>();
    for (const s of prevData) {
      let h = Number(s.duration_hours ?? 0);
      if (!h && s.started_at && s.ended_at) {
        h = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
      }
      if (h <= 0 || h > 24) continue;
      if (!prevByDriver.has(s.driver_id)) prevByDriver.set(s.driver_id, []);
      prevByDriver.get(s.driver_id)!.push(h);
    }
    const groupPrevAvg = new Map<string, number>();
    for (const [id, vals] of prevByDriver.entries()) {
      groupPrevAvg.set(id, vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg_stunden: Math.round((v.hSum / v.count) * 10) / 10,
    }));

    // descending: Rang 1 = most hours = best
    const sorted = [...unsorted].sort((a, b) => b.avg_stunden - a.avg_stunden);
    const total = sorted.length;

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg_stunden: groupPrevAvg.get(f.fahrer_id) ?? f.avg_stunden }))
      .sort((a, b) => b.avg_stunden - a.avg_stunden);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_stunden: f.avg_stunden,
        rank_delta: rang - prevRang,
        ampel,
        alert_wenig: ampel === 'rot',
      };
    });

    const team_avg_stunden = Math.round(
      (fahrer.reduce((s, f) => s + f.avg_stunden, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_stunden,
      fleissigster_name: fahrer[0]?.fahrer_name ?? '',
      wenigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt: total,
      ziel_stunden: 6,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
