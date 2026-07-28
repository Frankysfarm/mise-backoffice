import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  spitzen_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, spitzen_pct: 78, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, spitzen_pct: 65, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, spitzen_pct: 51, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, spitzen_pct: 32, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg: 57,
  hoechste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

const MITTAGSTART  = 12;
const MITTAGEND    = 14;
const ABENDSTART   = 18;
const ABENDEND     = 22;

function isSpitzenzeit(hour: number): boolean {
  return (hour >= MITTAGSTART && hour < MITTAGEND) || (hour >= ABENDSTART && hour < ABENDEND);
}

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
        .select('driver_id, driver_name, created_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, created_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; total: number; spitzen: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!groupCur.has(o.driver_id)) groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, total: 0, spitzen: 0 });
      const acc = groupCur.get(o.driver_id)!;
      acc.total += 1;
      if (isSpitzenzeit(new Date(o.created_at).getHours())) acc.spitzen += 1;
    }

    const prevData = prevRes.data ?? [];
    type PrevAcc = { total: number; spitzen: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevData) {
      if (!groupPrev.has(o.driver_id)) groupPrev.set(o.driver_id, { total: 0, spitzen: 0 });
      const acc = groupPrev.get(o.driver_id)!;
      acc.total += 1;
      if (isSpitzenzeit(new Date(o.created_at).getHours())) acc.spitzen += 1;
    }

    type SortRow = { id: string; name: string; pct: number };
    const sorted: SortRow[] = Array.from(groupCur.entries())
      .map(([id, acc]) => ({ id, name: acc.name, pct: acc.total > 0 ? (acc.spitzen / acc.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);

    const prevRankMap = new Map<string, number>();
    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, acc]) => ({ id, pct: acc.total > 0 ? (acc.spitzen / acc.total) * 100 : 0 }))
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
        spitzen_pct: Math.round(r.pct),
        rank_delta: prevRang - rang,
        ampel: ampelVon(rang, total),
        alert_wenig: r.pct < 40,
      };
    });

    const filteredRows = driverId ? fahrerRows.filter(f => f.fahrer_id === driverId) : fahrerRows;
    const teamAvg = sorted.reduce((s, r) => s + r.pct, 0) / (sorted.length || 1);

    return NextResponse.json({
      fahrer: filteredRows.length ? filteredRows : fahrerRows,
      team_avg: Math.round(teamAvg),
      hoechste_name: sorted[0]?.name ?? '',
      niedrigste_name: sorted[sorted.length - 1]?.name ?? '',
      alert_count: fahrerRows.filter(f => f.alert_wenig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
