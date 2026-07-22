import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren: 8, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, touren: 6, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, touren: 4, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren: 2, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_touren: 5,
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
        .select('driver_id, driver_name')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', today.start)
        .lt('departed_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end),
    ]);

    const todayTours: TourRow[] = (todayRes.data ?? []) as TourRow[];
    const yestTours: { driver_id: string }[] = (yestRes.data ?? []) as { driver_id: string }[];

    // Count tours per driver today
    const driverCount: Record<string, { name: string; count: number }> = {};
    for (const t of todayTours) {
      if (!driverCount[t.driver_id]) driverCount[t.driver_id] = { name: t.driver_name, count: 0 };
      driverCount[t.driver_id].count += 1;
    }

    // Count tours per driver yesterday
    const yestCount: Record<string, number> = {};
    for (const t of yestTours) {
      yestCount[t.driver_id] = (yestCount[t.driver_id] ?? 0) + 1;
    }

    const rows = Object.entries(driverCount).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      touren:      v.count,
    }));

    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    // Sort descending: rank 1 = most tours = best
    rows.sort((a, b) => b.touren - a.touren);
    const total    = rows.length;
    const teamAvg  = Math.round(rows.reduce((s, r) => s + r.touren, 0) / total);

    // Yesterday ranking (descending as well)
    const yestRanked = Object.entries(yestCount)
      .sort(([, a], [, b]) => b - a)
      .map(([id], i) => ({ id, rank: i + 1 }));
    const yestRankMap = new Map(yestRanked.map(e => [e.id, e.rank]));

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(r.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        touren:       r.touren,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_touren: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_touren: teamAvg,
      bester_name:     fahrer[0]?.fahrer_name ?? '—',
      letzter_name:    fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:     fahrer.filter(f => f.alert_bottom).length,
      gesamt:          total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
