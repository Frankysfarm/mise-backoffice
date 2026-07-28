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
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_rating: 4.5, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_rating: 4.1, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_rating: 3.7, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rating: 4.275,
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
        .from('orders')
        .select('driver_id, driver_name, rating')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('rating', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('rating', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; sum: number }>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, sum: 0 };
      groupCur.set(o.driver_id, {
        name:  prev.name,
        total: prev.total + 1,
        sum:   prev.sum + (Number(o.rating) || 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; sum: number }>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { total: 0, sum: 0 };
      groupPrev.set(o.driver_id, { total: prev.total + 1, sum: prev.sum + (Number(o.rating) || 0) });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:  id,
      fahrer_name: v.name || id.slice(0, 8),
      avg_rating: v.total > 0 ? Math.round((v.sum / v.total) * 100) / 100 : 0,
    }));

    // absteigend — höchste Bewertung = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.avg_rating - a.avg_rating);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p   = groupPrev.get(f.fahrer_id);
      const pRating = p && p.total > 0 ? Math.round((p.sum / p.total) * 100) / 100 : f.avg_rating;
      return { fahrer_id: f.fahrer_id, avg_rating: pRating };
    }).sort((a, b) => b.avg_rating - a.avg_rating);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:    f.fahrer_id,
        fahrer_name:  f.fahrer_name,
        rang,
        avg_rating:   f.avg_rating,
        rank_delta:   prevRang - rang,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_rating, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_rating: teamAvg,
      bester_name:     sorted[0]?.fahrer_name ?? '',
      letzter_name:    sorted[total - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt:          total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
