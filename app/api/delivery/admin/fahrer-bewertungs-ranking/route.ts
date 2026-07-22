import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  driver_rating: number | null;
  departed_at: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, score: 4.8, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, score: 4.5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, score: 3.9, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, score: 2.8, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_score: 4.0,
  bester_name: 'Sara K.',
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
        .select('driver_id, driver_name, driver_rating, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('driver_rating', 'is', null)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_rating')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('driver_rating', 'is', null)
        .not('departed_at', 'is', null),
    ]);

    const todayTours: TourRow[] = (todayRes.data ?? []) as TourRow[];
    const yestTours: { driver_id: string; driver_rating: number | null }[] =
      (yestRes.data ?? []) as { driver_id: string; driver_rating: number | null }[];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    // Aggregate avg rating per driver today
    const todayAcc: Record<string, { name: string; total: number; count: number }> = {};
    for (const t of todayTours) {
      const rating = typeof t.driver_rating === 'number' ? t.driver_rating : 0;
      if (rating <= 0 || rating > 5) continue;
      if (!todayAcc[t.driver_id]) todayAcc[t.driver_id] = { name: t.driver_name ?? t.driver_id, total: 0, count: 0 };
      todayAcc[t.driver_id].total += rating;
      todayAcc[t.driver_id].count += 1;
    }

    // Aggregate avg rating per driver yesterday
    const yestAcc: Record<string, { total: number; count: number }> = {};
    for (const t of yestTours) {
      const rating = typeof t.driver_rating === 'number' ? t.driver_rating : 0;
      if (rating <= 0 || rating > 5) continue;
      if (!yestAcc[t.driver_id]) yestAcc[t.driver_id] = { total: 0, count: 0 };
      yestAcc[t.driver_id].total += rating;
      yestAcc[t.driver_id].count += 1;
    }

    if (Object.keys(todayAcc).length === 0) return NextResponse.json(MOCK_DATA);

    // Sort descending by avg score (rank 1 = highest = best)
    const entries = Object.entries(todayAcc)
      .map(([id, v]) => ({
        fahrer_id:   id,
        fahrer_name: v.name,
        score:       Math.round((v.total / v.count) * 10) / 10,
      }))
      .sort((a, b) => b.score - a.score);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.score, 0) / total * 10) / 10;

    // Yesterday ranking
    const yestEntries = Object.entries(yestAcc)
      .map(([id, v]) => ({ driver_id: id, score: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => b.score - a.score);
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
        score:        e.score,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_score: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_score:   teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
