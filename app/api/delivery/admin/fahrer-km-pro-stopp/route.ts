import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_pro_stopp: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_pro_stopp: 1.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_pro_stopp: 1.8, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_pro_stopp: 2.5, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_pro_stopp: 3.8, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 2.33,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: start.toISOString(), end: end.toISOString() };
}

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = createClient();
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, total_distance_km, completed_stops')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('completed_at', today.start)
        .lt('completed_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_distance_km, completed_stops')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('completed_at', yesterday.start)
        .lt('completed_at', yesterday.end),
    ]);

    const groupCur  = new Map<string, { name: string; km: number; stopps: number }>();
    const groupPrev = new Map<string, number>();

    for (const t of (curRes.data ?? [])) {
      const km     = Number(t.total_distance_km ?? 0);
      const stopps = Number(t.completed_stops ?? 0);
      if (stopps > 0 && km > 0) {
        const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, km: 0, stopps: 0 };
        groupCur.set(t.driver_id, { name: prev.name, km: prev.km + km, stopps: prev.stopps + stopps });
      }
    }

    for (const t of (prevRes.data ?? [])) {
      const km     = Number(t.total_distance_km ?? 0);
      const stopps = Number(t.completed_stops ?? 0);
      if (stopps > 0 && km > 0) {
        const prev = groupPrev.get(t.driver_id) ?? 0;
        groupPrev.set(t.driver_id, prev + km / stopps);
      }
    }

    const entries = Array.from(groupCur.entries())
      .map(([id, v]) => ({
        fahrer_id:    id,
        fahrer_name:  v.name || id.slice(0, 8),
        km_pro_stopp: Math.round((v.km / v.stopps) * 100) / 100,
      }))
      .sort((a, b) => a.km_pro_stopp - b.km_pro_stopp);

    if (!entries.length) return NextResponse.json(MOCK_DATA);

    const total   = entries.length;
    const vals    = entries.map(e => e.km_pro_stopp);
    const teamAvg = Math.round((vals.reduce((s, v) => s + v, 0) / total) * 100) / 100;

    const prevRanks = new Map<string, number>();
    Array.from(groupPrev.entries())
      .sort((a, b) => a[1] - b[1])
      .forEach(([id], i) => prevRanks.set(id, i + 1));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(e.fahrer_id) ?? rang;
      const rank_delta = prevRang - rang;
      const ampel      = ampelVon(rang, total);
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        km_pro_stopp: e.km_pro_stopp,
        rank_delta,
        ampel,
        alert_top: ampel === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id);
      return NextResponse.json({
        fahrer:       me ? [me] : fahrer,
        team_avg:     teamAvg,
        bester_name:  fahrer[0]?.fahrer_name ?? '',
        letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
        alert_count:  fahrer.filter(f => f.alert_top).length,
        gesamt:       total,
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      fahrer,
      team_avg:     teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count:  fahrer.filter(f => f.alert_top).length,
      gesamt:       total,
    } satisfies ApiResponse);

  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
