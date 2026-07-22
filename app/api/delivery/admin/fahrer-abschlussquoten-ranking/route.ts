import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface StopRow {
  driver_id: string;
  driver_name: string;
  status: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, quote_pct: 97, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, quote_pct: 89, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 76, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 52, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 78,
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

function accumulateQuote(
  stops: StopRow[],
): Record<string, { name: string; delivered: number; total: number }> {
  const map: Record<string, { name: string; delivered: number; total: number }> = {};
  for (const s of stops) {
    if (!map[s.driver_id]) map[s.driver_id] = { name: s.driver_name, delivered: 0, total: 0 };
    map[s.driver_id].total += 1;
    if (s.status === 'delivered') map[s.driver_id].delivered += 1;
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
        .from('batch_stops')
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end),
      supabase
        .from('batch_stops')
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end),
    ]);

    const todayMap = accumulateQuote((todayRes.data ?? []) as StopRow[]);
    const yestMap  = accumulateQuote((yestRes.data ?? []) as StopRow[]);
    const yestQuotes: Record<string, number> = {};
    for (const [id, v] of Object.entries(yestMap)) {
      yestQuotes[id] = v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0;
    }

    let rows = Object.entries(todayMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      quote_pct:   v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0,
    }));

    if (driver_id) rows = rows.filter(r => r.fahrer_id === driver_id);
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    rows.sort((a, b) => b.quote_pct - a.quote_pct);
    const total   = rows.length;
    const teamAvg = Math.round(rows.reduce((s, r) => s + r.quote_pct, 0) / total);

    const fahrer = rows.map((r, i) => {
      const rang     = i + 1;
      const amp      = rankAmpel(rang, total);
      const yestQ    = yestQuotes[r.fahrer_id];
      const yestRows = rows.filter(x => (yestQuotes[x.fahrer_id] ?? 0) > (yestQ ?? 0));
      const yestRang = yestQ !== undefined ? yestRows.length + 1 : rang;
      const rank_delta = yestRang - rang;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        quote_pct:    r.quote_pct,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    const alertFahrer = fahrer.filter(f => f.alert_bottom);
    return NextResponse.json({
      fahrer,
      team_avg_pct: teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '-',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '-',
      alert_count:  alertFahrer.length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
