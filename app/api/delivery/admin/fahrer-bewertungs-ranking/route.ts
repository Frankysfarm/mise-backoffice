import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_rating: 4.8, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_rating: 4.6, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_rating: 4.2, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_rating: 3.8, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rating: 4.35,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_ratings')
        .select('driver_id, driver_name, rating')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('rating', 'is', null),
      supabase
        .from('delivery_ratings')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('rating', 'is', null),
    ]);

    type RatingRow = { driver_id: string; driver_name?: string | null; rating: number | null };

    const curRows: RatingRow[]  = (curRes.data ?? []) as RatingRow[];
    const prevRows: RatingRow[] = (prevRes.data ?? []) as RatingRow[];

    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    const curAcc: Record<string, { name: string; total: number; count: number }> = {};
    for (const r of curRows) {
      const rating = typeof r.rating === 'number' ? r.rating : 0;
      if (rating < 1 || rating > 5) continue;
      if (!curAcc[r.driver_id]) curAcc[r.driver_id] = { name: r.driver_name ?? r.driver_id, total: 0, count: 0 };
      curAcc[r.driver_id].total += rating;
      curAcc[r.driver_id].count += 1;
    }

    const prevAcc: Record<string, { total: number; count: number }> = {};
    for (const r of prevRows) {
      const rating = typeof r.rating === 'number' ? r.rating : 0;
      if (rating < 1 || rating > 5) continue;
      if (!prevAcc[r.driver_id]) prevAcc[r.driver_id] = { total: 0, count: 0 };
      prevAcc[r.driver_id].total += rating;
      prevAcc[r.driver_id].count += 1;
    }

    if (Object.keys(curAcc).length === 0) return NextResponse.json(MOCK_DATA);

    const entries = Object.entries(curAcc)
      .map(([id, v]) => ({
        fahrer_id:   id,
        fahrer_name: v.name,
        avg_rating:  Math.round((v.total / v.count) * 10) / 10,
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.avg_rating, 0) / total * 10) / 10;

    const prevEntries = Object.entries(prevAcc)
      .map(([id, v]) => ({ driver_id: id, avg: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
    const prevRankMap = new Map(prevEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampelVon(rang, total);
      const prevRang   = prevRankMap.get(e.fahrer_id);
      const rank_delta = prevRang != null ? prevRang - rang : 0;
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        avg_rating:   e.avg_rating,
        rank_delta,
        ampel:        amp,
        alert_niedrig: amp === 'rot',
      };
    });

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_rating: teamAvg, gesamt: total } satisfies Partial<ApiResponse>);
    }

    return NextResponse.json({
      fahrer,
      team_avg_rating:  teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      letzter_name:     fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_niedrig).length,
      gesamt:           total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
