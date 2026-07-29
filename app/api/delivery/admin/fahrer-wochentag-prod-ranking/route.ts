import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wochentag_tph: number;
  wochenende_tph: number;
  delta_tph: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wochentag_tph: number;
  team_avg_wochenende_tph: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, wochentag_tph: 2.8, wochenende_tph: 2.1, delta_tph:  0.7, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, wochentag_tph: 2.4, wochenende_tph: 2.6, delta_tph: -0.2, rank_delta:  1, ampel: 'rot',   alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 3, wochentag_tph: 1.9, wochenende_tph: 2.2, delta_tph: -0.3, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, wochentag_tph: 1.2, wochenende_tph: 1.5, delta_tph: -0.3, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_wochentag_tph: 2.075,
  team_avg_wochenende_tph: 2.1,
  meister_name: 'Max M.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function isWochentag(startedAt: string): boolean {
  const d = new Date(startedAt).getUTCDay();
  return d >= 1 && d <= 5; // Mo=1 … Fr=5
}

function isWochenende(startedAt: string): boolean {
  const d = new Date(startedAt).getUTCDay();
  return d === 0 || d === 6; // Sa=6, So=0
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

    // Group by driver — track weekday and weekend touren + stunden separately
    type DriverBucket = { name: string; wt_touren: number; wt_stunden: number; we_touren: number; we_stunden: number };
    const groupCur = new Map<string, DriverBucket>();
    for (const t of curData) {
      if (!t.started_at) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, wt_touren: 0, wt_stunden: 0, we_touren: 0, we_stunden: 0 };
      if (isWochentag(t.started_at)) {
        groupCur.set(t.driver_id, { ...prev, wt_touren: prev.wt_touren + 1, wt_stunden: prev.wt_stunden + durationH });
      } else if (isWochenende(t.started_at)) {
        groupCur.set(t.driver_id, { ...prev, we_touren: prev.we_touren + 1, we_stunden: prev.we_stunden + durationH });
      } else {
        groupCur.set(t.driver_id, prev); // keep in map even without match
      }
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      wochentag_tph: v.wt_stunden > 0 ? Math.round((v.wt_touren / v.wt_stunden) * 10) / 10 : 0,
      wochenende_tph: v.we_stunden > 0 ? Math.round((v.we_touren / v.we_stunden) * 10) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.wochentag_tph - a.wochentag_tph);
    const total = sorted.length;

    // Previous period ranks for rank_delta
    type PrevBucket = { wt_touren: number; wt_stunden: number };
    const groupPrev = new Map<string, PrevBucket>();
    for (const t of prevRes.data ?? []) {
      if (!t.started_at || !isWochentag(t.started_at)) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupPrev.get(t.driver_id) ?? { wt_touren: 0, wt_stunden: 0 };
      groupPrev.set(t.driver_id, { wt_touren: prev.wt_touren + 1, wt_stunden: prev.wt_stunden + durationH });
    }
    const prevUnsorted = unsorted.map(f => ({
      fahrer_id: f.fahrer_id,
      wt_tph: (() => { const p = groupPrev.get(f.fahrer_id); return p && p.wt_stunden > 0 ? p.wt_touren / p.wt_stunden : f.wochentag_tph; })(),
    }));
    const prevSorted = [...prevUnsorted].sort((a, b) => b.wt_tph - a.wt_tph);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel      = ampelVon(f.wochentag_tph);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        wochentag_tph: f.wochentag_tph,
        wochenende_tph: f.wochenende_tph,
        delta_tph: Math.round((f.wochentag_tph - f.wochenende_tph) * 10) / 10,
        rank_delta: prevRang - rang,
        ampel,
        alert_hoch: f.wochentag_tph >= 2.5,
      };
    });

    const team_avg_wochentag_tph = Math.round(
      (fahrer.reduce((s, f) => s + f.wochentag_tph, 0) / total) * 10
    ) / 10;
    const team_avg_wochenende_tph = Math.round(
      (fahrer.reduce((s, f) => s + f.wochenende_tph, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_wochentag_tph,
      team_avg_wochenende_tph,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
