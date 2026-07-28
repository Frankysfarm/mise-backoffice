import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  fenster_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_schlecht: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, fenster_pct: 94.0, rank_delta:  0, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, fenster_pct: 87.0, rank_delta:  1, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, fenster_pct: 79.0, rank_delta: -1, ampel: 'gelb',  alert_schlecht: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, fenster_pct: 67.0, rank_delta:  0, ampel: 'rot',   alert_schlecht: true  },
  ],
  team_avg_pct: 81.8,
  beste_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
  alert_count: 2,
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
        .select('driver_id, driver_name, promised_delivery_at, actual_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('promised_delivery_at', 'is', null)
        .not('actual_delivery_at', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, promised_delivery_at, actual_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('promised_delivery_at', 'is', null)
        .not('actual_delivery_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; total: number; inWindow: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      const actual    = new Date(o.actual_delivery_at).getTime();
      const promised  = new Date(o.promised_delivery_at).getTime();
      const onTime    = actual <= promised;
      if (!groupCur.has(o.driver_id)) groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, total: 0, inWindow: 0 });
      const acc = groupCur.get(o.driver_id)!;
      acc.total += 1;
      if (onTime) acc.inWindow += 1;
    }

    const prevData = prevRes.data ?? [];
    type PrevAcc = { total: number; inWindow: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevData) {
      const actual   = new Date(o.actual_delivery_at).getTime();
      const promised = new Date(o.promised_delivery_at).getTime();
      if (!groupPrev.has(o.driver_id)) groupPrev.set(o.driver_id, { total: 0, inWindow: 0 });
      const acc = groupPrev.get(o.driver_id)!;
      acc.total += 1;
      if (actual <= promised) acc.inWindow += 1;
    }

    type SortRow = { id: string; name: string; pct: number };
    const sorted: SortRow[] = Array.from(groupCur.entries())
      .map(([id, acc]) => ({ id, name: acc.name, pct: acc.total ? (acc.inWindow / acc.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);

    const prevRankMap = new Map<string, number>();
    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, acc]) => ({ id, pct: acc.total ? (acc.inWindow / acc.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    prevSorted.forEach((r, i) => prevRankMap.set(r.id, i + 1));

    const total = sorted.length;
    const fahrerRows: FahrerRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(r.id) ?? rang;
      return {
        fahrer_id: r.id,
        fahrer_name: r.name,
        rang,
        fenster_pct: Math.round(r.pct * 10) / 10,
        rank_delta: prevRang - rang,
        ampel: ampelVon(rang, total),
        alert_schlecht: r.pct < 80,
      };
    });

    const filteredRows = driverId ? fahrerRows.filter(f => f.fahrer_id === driverId) : fahrerRows;
    const teamAvg = sorted.reduce((s, r) => s + r.pct, 0) / (sorted.length || 1);

    return NextResponse.json({
      fahrer: filteredRows.length ? filteredRows : fahrerRows,
      team_avg_pct: Math.round(teamAvg * 10) / 10,
      beste_name: sorted[0]?.name ?? '',
      schlechteste_name: sorted[sorted.length - 1]?.name ?? '',
      alert_count: fahrerRows.filter(f => f.alert_schlecht).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
