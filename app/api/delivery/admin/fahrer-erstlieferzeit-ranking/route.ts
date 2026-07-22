import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, erstlieferzeit_min: 8,  rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, erstlieferzeit_min: 12, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, erstlieferzeit_min: 19, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, erstlieferzeit_min: 34, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_min: 18,
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

function ampel(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

interface TourRow {
  driver_id: string;
  driver_name: string;
  departed_at: string;
}

interface StopRow {
  driver_id: string;
  arrived_at: string;
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

    const [todayToursRes, todayStopsRes, yestToursRes, yestStopsRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_batch_stops')
        .select('driver_id, arrived_at')
        .eq('location_id', location_id)
        .eq('status', 'delivered')
        .gte('arrived_at', today.start)
        .lt('arrived_at', today.end)
        .not('arrived_at', 'is', null)
        .order('arrived_at', { ascending: true }),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_batch_stops')
        .select('driver_id, arrived_at')
        .eq('location_id', location_id)
        .eq('status', 'delivered')
        .gte('arrived_at', yesterday.start)
        .lt('arrived_at', yesterday.end)
        .not('arrived_at', 'is', null)
        .order('arrived_at', { ascending: true }),
    ]);

    const todayTours: TourRow[] = (todayToursRes.data ?? []) as TourRow[];
    const todayStops: StopRow[] = (todayStopsRes.data ?? []) as StopRow[];
    const yestTours: { driver_id: string; departed_at: string }[] = (yestToursRes.data ?? []) as { driver_id: string; departed_at: string }[];
    const yestStops: StopRow[] = (yestStopsRes.data ?? []) as StopRow[];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    // Build first delivered stop per driver (today)
    const firstStopToday = new Map<string, number>();
    for (const s of todayStops) {
      if (!firstStopToday.has(s.driver_id)) {
        firstStopToday.set(s.driver_id, new Date(s.arrived_at).getTime());
      }
    }

    // Build earliest tour departed_at per driver (today)
    const tourStartToday = new Map<string, { name: string; departed: number }>();
    for (const t of todayTours) {
      const dep = new Date(t.departed_at).getTime();
      const existing = tourStartToday.get(t.driver_id);
      if (!existing || dep < existing.departed) {
        tourStartToday.set(t.driver_id, { name: t.driver_name ?? t.driver_id, departed: dep });
      }
    }

    // Compute erstlieferzeit_min per driver
    const entries: { fahrer_id: string; fahrer_name: string; erstlieferzeit_min: number }[] = [];
    for (const [driverId, tour] of tourStartToday.entries()) {
      const firstStop = firstStopToday.get(driverId);
      if (firstStop == null) continue;
      const mins = Math.round((firstStop - tour.departed) / 60000);
      if (mins < 0 || mins > 180) continue;
      entries.push({ fahrer_id: driverId, fahrer_name: tour.name, erstlieferzeit_min: mins });
    }

    if (entries.length === 0) return NextResponse.json(MOCK_DATA);

    // Sort ascending: rank 1 = shortest erstlieferzeit = best
    entries.sort((a, b) => a.erstlieferzeit_min - b.erstlieferzeit_min);
    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.erstlieferzeit_min, 0) / total);

    // Yesterday ranking
    const firstStopYest = new Map<string, number>();
    for (const s of yestStops) {
      if (!firstStopYest.has(s.driver_id)) {
        firstStopYest.set(s.driver_id, new Date(s.arrived_at).getTime());
      }
    }
    const tourStartYest = new Map<string, number>();
    for (const t of yestTours) {
      const dep = new Date(t.departed_at).getTime();
      const existing = tourStartYest.get(t.driver_id);
      if (!existing || dep < existing) tourStartYest.set(t.driver_id, dep);
    }
    const yestEntries: { driver_id: string; mins: number }[] = [];
    for (const [driverId, dep] of tourStartYest.entries()) {
      const firstStop = firstStopYest.get(driverId);
      if (firstStop == null) continue;
      const mins = Math.round((firstStop - dep) / 60000);
      if (mins >= 0 && mins <= 180) yestEntries.push({ driver_id: driverId, mins });
    }
    yestEntries.sort((a, b) => a.mins - b.mins);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0;
      return {
        fahrer_id:           e.fahrer_id,
        fahrer_name:         e.fahrer_name,
        rang,
        erstlieferzeit_min:  e.erstlieferzeit_min,
        rank_delta,
        ampel:               amp,
        alert_bottom:        amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_min: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_min:  teamAvg,
      bester_name:   fahrer[0]?.fahrer_name ?? '—',
      letzter_name:  fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:   fahrer.filter(f => f.alert_bottom).length,
      gesamt:        total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
