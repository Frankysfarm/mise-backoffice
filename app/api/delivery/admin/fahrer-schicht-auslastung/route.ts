import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  departed_at: string;
  returned_at: string | null;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, auslastung_pct: 82.4, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, auslastung_pct: 71.0, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, auslastung_pct: 48.5, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 21.3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 55.8,
  bester_name:  'Max M.',
  niedrigster_name: 'Tim B.',
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

function ampel(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function calcUtilization(tours: TourRow[]): Record<string, { name: string; activeMin: number; shiftMin: number }> {
  const acc: Record<string, { name: string; departures: number[]; returns: number[] }> = {};
  for (const t of tours) {
    if (!t.departed_at) continue;
    if (!acc[t.driver_id]) acc[t.driver_id] = { name: t.driver_name ?? t.driver_id, departures: [], returns: [] };
    acc[t.driver_id].departures.push(new Date(t.departed_at).getTime());
    if (t.returned_at) acc[t.driver_id].returns.push(new Date(t.returned_at).getTime());
  }
  const result: Record<string, { name: string; activeMin: number; shiftMin: number }> = {};
  for (const [id, v] of Object.entries(acc)) {
    const allTs = [...v.departures, ...v.returns];
    const shiftMin = allTs.length >= 2
      ? (Math.max(...allTs) - Math.min(...allTs)) / 60000
      : 60;
    let activeMin = 0;
    for (let i = 0; i < v.departures.length; i++) {
      const dep = v.departures[i];
      const ret = v.returns[i] ?? (dep + 30 * 60000);
      activeMin += (ret - dep) / 60000;
    }
    result[id] = { name: v.name, activeMin, shiftMin: Math.max(shiftMin, activeMin, 1) };
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [todayRes, yestRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, departed_at, returned_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, returned_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null),
    ]);

    const todayTours: TourRow[] = (todayRes.data ?? []) as TourRow[];
    const yestTours: TourRow[]  = (yestRes.data ?? []).map((t: Record<string, unknown>) => ({ ...t, driver_name: String(t.driver_id ?? '') })) as TourRow[];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    const todayAcc = calcUtilization(todayTours);
    const yestAcc  = calcUtilization(yestTours);

    const entries = Object.entries(todayAcc)
      .map(([id, v]) => ({
        fahrer_id:      id,
        fahrer_name:    v.name,
        auslastung_pct: Math.min(100, Math.round((v.activeMin / v.shiftMin) * 1000) / 10),
      }))
      .sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.auslastung_pct, 0) / total * 10) / 10;

    const yestEntries = Object.entries(yestAcc)
      .map(([id, v]) => ({ driver_id: id, pct: v.activeMin / v.shiftMin }))
      .sort((a, b) => b.pct - a.pct);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? yestRank - rang : 0;
      return {
        fahrer_id:      e.fahrer_id,
        fahrer_name:    e.fahrer_name,
        rang,
        auslastung_pct: e.auslastung_pct,
        rank_delta,
        ampel:          amp,
        alert_bottom:   amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_pct: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_pct:     teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
