import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wochenende_tph: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wochenende_tph: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 1, wochenende_tph: 3.1, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 2, wochenende_tph: 2.8, rank_delta: -1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 3, wochenende_tph: 2.2, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, wochenende_tph: 1.4, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_wochenende_tph: 2.375,
  meister_name: 'Sara K.',
  wenigster_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function isWochenende(startedAt: string): boolean {
  const d = new Date(startedAt).getUTCDay();
  return d === 0 || d === 6; // So=0, Sa=6
}

function ampelVon(tph: number): 'gruen' | 'gelb' | 'rot' {
  if (tph >= 2.5) return 'rot';
  if (tph >= 1.5) return 'gelb';
  return 'gruen';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, started_at, completed_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverBucket = { name: string; touren: number; stunden: number };
    const groupCur = new Map<string, DriverBucket>();
    for (const t of curData) {
      if (!t.started_at || !isWochenende(t.started_at)) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, touren: 0, stunden: 0 };
      groupCur.set(t.driver_id, { ...prev, touren: prev.touren + 1, stunden: prev.stunden + durationH });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      wochenende_tph: v.stunden > 0 ? Math.round((v.touren / v.stunden) * 10) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.wochenende_tph - a.wochenende_tph);
    const total = sorted.length;

    type PrevBucket = { touren: number; stunden: number };
    const groupPrev = new Map<string, PrevBucket>();
    for (const t of prevRes.data ?? []) {
      if (!t.started_at || !isWochenende(t.started_at)) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupPrev.get(t.driver_id) ?? { touren: 0, stunden: 0 };
      groupPrev.set(t.driver_id, { touren: prev.touren + 1, stunden: prev.stunden + durationH });
    }
    const prevSorted = unsorted
      .map(f => {
        const p = groupPrev.get(f.fahrer_id);
        return { fahrer_id: f.fahrer_id, tph: p && p.stunden > 0 ? p.touren / p.stunden : f.wochenende_tph };
      })
      .sort((a, b) => b.tph - a.tph);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        wochenende_tph: f.wochenende_tph,
        rank_delta: (prevRanks.get(f.fahrer_id) ?? rang) - rang,
        ampel: ampelVon(f.wochenende_tph),
        alert_hoch: f.wochenende_tph >= 2.5,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.wochenende_tph, 0) / total) * 10) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_wochenende_tph: team_avg,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
