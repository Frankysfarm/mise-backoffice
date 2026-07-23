import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_pct: number;
  leerfahrten: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_leerfahrten: number;
  team_avg_leerfahrten_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, leerfahrten_pct:  5, leerfahrten:  5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, leerfahrten_pct: 12, leerfahrten: 12, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, leerfahrten_pct: 22, leerfahrten: 22, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten_pct: 38, leerfahrten: 38, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_leerfahrten: 19,
  team_avg_leerfahrten_pct: 19.25,
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
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase  = await createClient();
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, km_leer, total_distance_km')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('completed_at', today.start)
        .lt('completed_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, km_leer, total_distance_km')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('completed_at', yesterday.start)
        .lt('completed_at', yesterday.end),
    ]);

    const groupCur  = new Map<string, { name: string; km_leer: number; km_total: number }>();
    const groupPrev = new Map<string, { km_leer: number; km_total: number }>();

    for (const t of (curRes.data ?? [])) {
      const km_leer  = Number(t.km_leer ?? 0);
      const km_total = Number(t.total_distance_km ?? 0);
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, km_leer: 0, km_total: 0 };
      groupCur.set(t.driver_id, { name: prev.name, km_leer: prev.km_leer + km_leer, km_total: prev.km_total + km_total });
    }

    for (const t of (prevRes.data ?? [])) {
      const km_leer  = Number(t.km_leer ?? 0);
      const km_total = Number(t.total_distance_km ?? 0);
      const prev = groupPrev.get(t.driver_id) ?? { km_leer: 0, km_total: 0 };
      groupPrev.set(t.driver_id, { km_leer: prev.km_leer + km_leer, km_total: prev.km_total + km_total });
    }

    const entries = Array.from(groupCur.entries())
      .map(([id, v]) => ({
        fahrer_id:      id,
        fahrer_name:    v.name || id.slice(0, 8),
        leerfahrten_pct: v.km_total > 0 ? Math.round((v.km_leer / v.km_total) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => a.leerfahrten_pct - b.leerfahrten_pct);

    if (!entries.length) return NextResponse.json(MOCK_DATA);

    const total      = entries.length;
    const vals       = entries.map(e => e.leerfahrten_pct);
    const teamAvgPct = Math.round((vals.reduce((s, v) => s + v, 0) / total) * 10) / 10;

    const prevRanks = new Map<string, number>();
    Array.from(groupPrev.entries())
      .map(([id, v]) => ({ id, pct: v.km_total > 0 ? v.km_leer / v.km_total * 100 : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .forEach(({ id }, i) => prevRanks.set(id, i + 1));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(e.fahrer_id) ?? rang;
      const rank_delta = rang - prevRang;
      const ampel      = ampelVon(rang, total);
      return {
        fahrer_id:       e.fahrer_id,
        fahrer_name:     e.fahrer_name,
        rang,
        leerfahrten_pct: e.leerfahrten_pct,
        leerfahrten:     e.leerfahrten_pct,
        rank_delta,
        ampel,
        alert_bottom:    ampel === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id);
      return NextResponse.json({
        fahrer:                  me ? [me] : fahrer,
        team_avg_leerfahrten:    teamAvgPct,
        team_avg_leerfahrten_pct: teamAvgPct,
        bester_name:             fahrer[0]?.fahrer_name ?? '',
        letzter_name:            fahrer[total - 1]?.fahrer_name ?? '',
        alert_count:             fahrer.filter(f => f.alert_bottom).length,
        gesamt:                  total,
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      fahrer,
      team_avg_leerfahrten:     teamAvgPct,
      team_avg_leerfahrten_pct: teamAvgPct,
      bester_name:              fahrer[0]?.fahrer_name ?? '',
      letzter_name:             fahrer[total - 1]?.fahrer_name ?? '',
      alert_count:              fahrer.filter(f => f.alert_bottom).length,
      gesamt:                   total,
    } satisfies ApiResponse);

  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
