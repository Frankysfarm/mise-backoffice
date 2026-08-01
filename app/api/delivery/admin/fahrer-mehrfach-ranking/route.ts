import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_lieferungen: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
  fahrer_single?: FahrerRow & { team_avg: number; gesamt: number };
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_lieferungen: 3.8, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_lieferungen: 3.2, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_lieferungen: 2.5, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_lieferungen: 1.6, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 2.8,
  hoechste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
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
        .select('driver_id, driver_name, tour_id')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, tour_id')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; tours: Set<string>; deliveries: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!groupCur.has(o.driver_id)) groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, tours: new Set(), deliveries: 0 });
      const acc = groupCur.get(o.driver_id)!;
      if (o.tour_id) acc.tours.add(o.tour_id);
      acc.deliveries += 1;
    }

    const prevData = prevRes.data ?? [];
    type PrevAcc = { tours: Set<string>; deliveries: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevData) {
      if (!groupPrev.has(o.driver_id)) groupPrev.set(o.driver_id, { tours: new Set(), deliveries: 0 });
      const acc = groupPrev.get(o.driver_id)!;
      if (o.tour_id) acc.tours.add(o.tour_id);
      acc.deliveries += 1;
    }

    type SortRow = { id: string; name: string; avg: number };
    const sorted: SortRow[] = Array.from(groupCur.entries())
      .map(([id, acc]) => {
        const tourCount = acc.tours.size || 1;
        return { id, name: acc.name, avg: acc.deliveries / tourCount };
      })
      .sort((a, b) => b.avg - a.avg);

    const prevRankMap = new Map<string, number>();
    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, acc]) => {
        const tourCount = acc.tours.size || 1;
        return { id, avg: acc.deliveries / tourCount };
      })
      .sort((a, b) => b.avg - a.avg);
    prevSorted.forEach((r, i) => prevRankMap.set(r.id, i + 1));

    const total = sorted.length;
    const fahrerRows: FahrerRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(r.id) ?? rang;
      return {
        fahrer_id: r.id,
        fahrer_name: r.name,
        rang,
        avg_lieferungen: Math.round(r.avg * 10) / 10,
        rank_delta: prevRang - rang,
        ampel: ampelVon(rang, total),
        alert_niedrig: r.avg < 2.0,
      };
    });

    const teamAvg = sorted.reduce((s, r) => s + r.avg, 0) / (sorted.length || 1);
    const teamAvgRounded = Math.round(teamAvg * 10) / 10;

    const response: ApiResponse = {
      fahrer: fahrerRows,
      team_avg: teamAvgRounded,
      hoechste_name: sorted[0]?.name ?? '',
      niedrigste_name: sorted[sorted.length - 1]?.name ?? '',
      alert_count: fahrerRows.filter(f => f.alert_niedrig).length,
      gesamt: total,
    };

    if (driverId) {
      const me = fahrerRows.find(f => f.fahrer_id === driverId);
      if (me) {
        (response as ApiResponse & { fahrer_single: unknown }).fahrer_single = {
          ...me,
          team_avg: teamAvgRounded,
          gesamt: total,
        };
      }
    }

    return NextResponse.json(response satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
