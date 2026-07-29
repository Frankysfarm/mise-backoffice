import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  zufriedenheits_index: number;
  avg_rating: number;
  puenktlichkeit_pct: number;
  erstkontakt_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_index: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, zufriedenheits_index: 91, avg_rating: 4.8, puenktlichkeit_pct: 92, erstkontakt_pct: 88, rank_delta: 0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, zufriedenheits_index: 80, avg_rating: 4.4, puenktlichkeit_pct: 79, erstkontakt_pct: 74, rank_delta: 1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, zufriedenheits_index: 71, avg_rating: 4.1, puenktlichkeit_pct: 68, erstkontakt_pct: 62, rank_delta: -1, ampel: 'gelb', alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, zufriedenheits_index: 58, avg_rating: 3.6, puenktlichkeit_pct: 55, erstkontakt_pct: 41, rank_delta: 0, ampel: 'rot', alert_niedrig: true },
  ],
  team_avg_index: 75,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function calcIndex(avgRating: number, puenktlichkeit: number, erstkontakt: number): number {
  // composite: avg_rating*0.5 (scale 1-5 → 0-100) + puenktlichkeit_pct*0.3 + erstkontakt_pct*0.2
  const ratingScore = ((avgRating - 1) / 4) * 100;
  return Math.round(ratingScore * 0.5 + puenktlichkeit * 0.3 + erstkontakt * 0.2);
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
        .select('driver_id, driver_name, rating, delivered_on_time, first_contact')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, rating, delivered_on_time, first_contact')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = {
      name: string;
      ratingSum: number;
      ratingCount: number;
      onTime: number;
      contacted: number;
      total: number;
    };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, ratingSum: 0, ratingCount: 0, onTime: 0, contacted: 0, total: 0 };
      groupCur.set(o.driver_id, {
        name:        prev.name,
        ratingSum:   prev.ratingSum + (o.rating ? Number(o.rating) : 0),
        ratingCount: prev.ratingCount + (o.rating ? 1 : 0),
        onTime:      prev.onTime + (o.delivered_on_time ? 1 : 0),
        contacted:   prev.contacted + (o.first_contact ? 1 : 0),
        total:       prev.total + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { ratingSum: number; ratingCount: number; onTime: number; contacted: number; total: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { ratingSum: 0, ratingCount: 0, onTime: 0, contacted: 0, total: 0 };
      groupPrev.set(o.driver_id, {
        ratingSum:   prev.ratingSum + (o.rating ? Number(o.rating) : 0),
        ratingCount: prev.ratingCount + (o.rating ? 1 : 0),
        onTime:      prev.onTime + (o.delivered_on_time ? 1 : 0),
        contacted:   prev.contacted + (o.first_contact ? 1 : 0),
        total:       prev.total + 1,
      });
    }

    const computeMetrics = (acc: DriverAcc | PrevAcc) => {
      const avgRating      = acc.ratingCount > 0 ? acc.ratingSum / acc.ratingCount : 0;
      const puenktlichkeit = acc.total > 0 ? Math.round((acc.onTime / acc.total) * 10000) / 100 : 0;
      const erstkontakt    = acc.total > 0 ? Math.round((acc.contacted / acc.total) * 10000) / 100 : 0;
      return { avgRating, puenktlichkeit, erstkontakt, index: calcIndex(avgRating, puenktlichkeit, erstkontakt) };
    };

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => {
      const m = computeMetrics(v);
      return { fahrer_id: id, fahrer_name: v.name || id.slice(0, 8), ...m };
    });

    const sorted = [...unsorted].sort((a, b) => b.index - a.index);
    const gesamt = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const idx = p ? computeMetrics(p as DriverAcc).index : f.index;
      return { fahrer_id: f.fahrer_id, index: idx };
    }).sort((a, b) => b.index - a.index);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgIndex = Math.round(sorted.reduce((s, f) => s + f.index, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:            f.fahrer_id,
        fahrer_name:          f.fahrer_name,
        rang,
        zufriedenheits_index: f.index,
        avg_rating:           Math.round(f.avgRating * 100) / 100,
        puenktlichkeit_pct:   f.puenktlichkeit,
        erstkontakt_pct:      f.erstkontakt,
        rank_delta:           prevRang - rang,
        ampel:                ampelVon(rang, gesamt),
        alert_niedrig:        teamAvgIndex < 60,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_index:  teamAvgIndex,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     teamAvgIndex < 60 ? gesamt : 0,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
