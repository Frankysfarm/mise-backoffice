import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  status: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, touren_anzahl: 12, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, touren_anzahl:  9, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, touren_anzahl:  6, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_anzahl:  3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 7.5,
  bester_name: 'Max M.',
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

function rankAmpel(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function countTours(tours: TourRow[]): Record<string, { name: string; count: number }> {
  const map: Record<string, { name: string; count: number }> = {};
  for (const t of tours) {
    if (!map[t.driver_id]) map[t.driver_id] = { name: t.driver_name, count: 0 };
    if (t.status === 'completed') map[t.driver_id].count += 1;
  }
  return map;
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
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end),
    ]);

    const todayMap = countTours((todayRes.data ?? []) as TourRow[]);
    const yestMap  = countTours((yestRes.data ?? []) as TourRow[]);
    const yestCounts: Record<string, number> = {};
    for (const [id, v] of Object.entries(yestMap)) {
      yestCounts[id] = v.count;
    }

    let rows = Object.entries(todayMap).map(([id, v]) => ({
      fahrer_id:    id,
      fahrer_name:  v.name,
      touren_anzahl: v.count,
    }));

    if (driver_id) rows = rows.filter(r => r.fahrer_id === driver_id);
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    rows.sort((a, b) => b.touren_anzahl - a.touren_anzahl);
    const total   = rows.length;
    const teamAvg = Math.round((rows.reduce((s, r) => s + r.touren_anzahl, 0) / total) * 10) / 10;

    const fahrer = rows.map((r, i) => {
      const rang      = i + 1;
      const amp       = rankAmpel(rang, total);
      const yestCount = yestCounts[r.fahrer_id] ?? r.touren_anzahl;
      const yestRang  = rows.filter(x => (yestCounts[x.fahrer_id] ?? 0) > yestCount).length + 1;
      const rank_delta = yestRang - rang;
      return {
        fahrer_id:     r.fahrer_id,
        fahrer_name:   r.fahrer_name,
        rang,
        touren_anzahl: r.touren_anzahl,
        rank_delta,
        ampel:         amp,
        alert_bottom:  amp === 'rot',
      };
    });

    const alertFahrer = fahrer.filter(f => f.alert_bottom);
    return NextResponse.json({
      fahrer,
      team_avg:    teamAvg,
      bester_name: fahrer[0]?.fahrer_name ?? '-',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '-',
      alert_count: alertFahrer.length,
      gesamt:      total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
