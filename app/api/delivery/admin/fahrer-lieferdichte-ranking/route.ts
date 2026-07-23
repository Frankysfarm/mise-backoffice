import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stopps_pro_km: 0.85, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, stopps_pro_km: 0.71, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, stopps_pro_km: 0.54, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_km: 0.32, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 0.61,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now = new Date();
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
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = createClient();
    const today = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, km_driven, stop_count, drivers(name)')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', today.start)
        .lt('departed_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, km_driven, stop_count')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type TourRow = { driver_id: string; km_driven: number; stop_count: number; drivers?: { name?: string } | null };

    const groupCur = new Map<string, { km: number; stopps: number; name: string }>();
    for (const r of (curData as TourRow[])) {
      if (!r.driver_id || !r.km_driven) continue;
      const entry = groupCur.get(r.driver_id) ?? { km: 0, stopps: 0, name: '' };
      entry.km     += r.km_driven;
      entry.stopps += r.stop_count ?? 0;
      if (!entry.name && r.drivers?.name) entry.name = r.drivers.name;
      groupCur.set(r.driver_id, entry);
    }

    const groupPrev = new Map<string, number>();
    for (const r of (prevData as TourRow[])) {
      if (!r.driver_id || !r.km_driven) continue;
      const prev = groupPrev.get(r.driver_id) ?? 0;
      groupPrev.set(r.driver_id, prev + (r.stop_count ?? 0) / r.km_driven);
    }

    const entries = Array.from(groupCur.entries())
      .filter(([, v]) => v.km > 0)
      .map(([id, v]) => ({
        fahrer_id:    id,
        fahrer_name:  v.name || id.slice(0, 8),
        stopps_pro_km: Math.round((v.stopps / v.km) * 100) / 100,
      }))
      .sort((a, b) => b.stopps_pro_km - a.stopps_pro_km);

    if (!entries.length) return NextResponse.json(MOCK_DATA);

    const total = entries.length;
    const vals  = entries.map(e => e.stopps_pro_km);
    const teamAvg = Math.round((vals.reduce((s, v) => s + v, 0) / total) * 100) / 100;

    const prevRanks = new Map<string, number>();
    Array.from(groupPrev.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([id], i) => prevRanks.set(id, i + 1));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang      = i + 1;
      const prevRang  = prevRanks.get(e.fahrer_id) ?? rang;
      const rank_delta = prevRang - rang;
      const ampel     = ampelVon(rang, total);
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        stopps_pro_km: e.stopps_pro_km,
        rank_delta,
        ampel,
        alert_bottom: ampel === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id);
      return NextResponse.json({
        fahrer: me ? [me] : fahrer,
        team_avg: teamAvg,
        bester_name: fahrer[0]?.fahrer_name ?? '',
        letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
        alert_count: fahrer.filter(f => f.alert_bottom).length,
        gesamt: total,
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      fahrer,
      team_avg: teamAvg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: total,
    } satisfies ApiResponse);

  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
