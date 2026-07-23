import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  departed_at: string;
}

interface StopRow {
  employee_id: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, leerfahrten: 0, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, leerfahrten: 0, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, leerfahrten: 1, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten: 3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_leerfahrten: 1,
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

function ampel(rank: number, total: number): string {
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

  const supabase = await createClient();

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [todayToursRes, yestToursRes, todayStopsRes, yestStopsRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_batch_stops')
        .select('employee_id')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end),
      supabase
        .from('delivery_batch_stops')
        .select('employee_id')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end),
    ]);

    const todayTours: TourRow[]                      = (todayToursRes.data ?? []) as TourRow[];
    const yestTours:  { driver_id: string }[]        = (yestToursRes.data  ?? []) as { driver_id: string }[];
    const todayStops: StopRow[]                      = (todayStopsRes.data ?? []) as StopRow[];
    const yestStops:  { employee_id: string }[]      = (yestStopsRes.data  ?? []) as { employee_id: string }[];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    // Drivers who had at least one stop today / yesterday (employee_id ≈ driver_id)
    const todayHasStops = new Set(todayStops.map(s => s.employee_id));
    const yestHasStops  = new Set(yestStops.map(s => s.employee_id));

    // Count tours per driver today
    const todayAcc: Record<string, { name: string; count: number }> = {};
    for (const t of todayTours) {
      if (!todayAcc[t.driver_id]) todayAcc[t.driver_id] = { name: t.driver_name ?? t.driver_id, count: 0 };
      todayAcc[t.driver_id].count++;
    }

    // Count tours per driver yesterday
    const yestAcc: Record<string, number> = {};
    for (const t of yestTours) {
      yestAcc[t.driver_id] = (yestAcc[t.driver_id] ?? 0) + 1;
    }

    // Leerfahrten: if driver has no batch_stops today → all tours are Leerfahrten; else 0
    const entries = Object.entries(todayAcc)
      .map(([id, v]) => ({
        fahrer_id:   id,
        fahrer_name: v.name,
        leerfahrten: todayHasStops.has(id) ? 0 : v.count,
      }))
      .sort((a, b) => a.leerfahrten - b.leerfahrten); // rank 1 = fewest (best)

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.leerfahrten, 0) / total);

    // Yesterday ranking for rank_delta
    const yestEntries = Object.entries(yestAcc)
      .map(([id, count]) => ({ driver_id: id, leerfahrten: yestHasStops.has(id) ? 0 : count }))
      .sort((a, b) => a.leerfahrten - b.leerfahrten);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0;
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        leerfahrten:  e.leerfahrten,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_leerfahrten: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_leerfahrten: teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
