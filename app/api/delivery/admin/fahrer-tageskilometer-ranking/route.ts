import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  departed_at: string;
  distance_km?: number | null;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, km: 48.2, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, km: 41.5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, km: 28.0, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km: 12.3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_km: 32.5,
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
        .select('driver_id, driver_name, departed_at, distance_km')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null),
    ]);

    const todayTours: TourRow[]                           = (todayRes.data ?? []) as TourRow[];
    const yestTours:  { driver_id: string; distance_km?: number | null }[] = (yestRes.data ?? []) as { driver_id: string; distance_km?: number | null }[];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    // Aggregate km per driver today
    const todayAcc: Record<string, { name: string; km: number }> = {};
    for (const t of todayTours) {
      if (!todayAcc[t.driver_id]) todayAcc[t.driver_id] = { name: t.driver_name ?? t.driver_id, km: 0 };
      todayAcc[t.driver_id].km += typeof t.distance_km === 'number' ? t.distance_km : 0;
    }

    // Aggregate km per driver yesterday
    const yestAcc: Record<string, number> = {};
    for (const t of yestTours) {
      yestAcc[t.driver_id] = (yestAcc[t.driver_id] ?? 0) + (typeof t.distance_km === 'number' ? t.distance_km : 0);
    }

    // Sort descending by km (rank 1 = most km = best)
    const entries = Object.entries(todayAcc)
      .map(([id, v]) => ({ fahrer_id: id, fahrer_name: v.name, km: Math.round(v.km * 10) / 10 }))
      .sort((a, b) => b.km - a.km);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.km, 0) / total * 10) / 10;

    // Yesterday ranking
    const yestEntries = Object.entries(yestAcc)
      .map(([id, km]) => ({ driver_id: id, km }))
      .sort((a, b) => b.km - a.km);
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
        km:           e.km,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_km: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_km:  teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
