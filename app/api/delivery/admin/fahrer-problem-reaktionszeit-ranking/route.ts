import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reaktionszeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, reaktionszeit_min:  8.0, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, reaktionszeit_min: 14.0, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, reaktionszeit_min: 22.0, rank_delta: -1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, reaktionszeit_min: 38.0, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_min: 20.5,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
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
        .select('driver_id, driver_name, issue_reported_at, issue_resolved_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('issue_reported_at', 'is', null)
        .not('issue_resolved_at', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, issue_reported_at, issue_resolved_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('issue_reported_at', 'is', null)
        .not('issue_resolved_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; totalMin: number; count: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      const diffMin = (new Date(o.issue_resolved_at).getTime() - new Date(o.issue_reported_at).getTime()) / 60000;
      if (!groupCur.has(o.driver_id)) groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, totalMin: 0, count: 0 });
      const acc = groupCur.get(o.driver_id)!;
      acc.totalMin += diffMin;
      acc.count += 1;
    }

    const prevData = prevRes.data ?? [];
    type PrevAcc = { totalMin: number; count: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevData) {
      const diffMin = (new Date(o.issue_resolved_at).getTime() - new Date(o.issue_reported_at).getTime()) / 60000;
      if (!groupPrev.has(o.driver_id)) groupPrev.set(o.driver_id, { totalMin: 0, count: 0 });
      const acc = groupPrev.get(o.driver_id)!;
      acc.totalMin += diffMin;
      acc.count += 1;
    }

    type SortRow = { id: string; name: string; avg: number };
    const sorted: SortRow[] = Array.from(groupCur.entries())
      .map(([id, acc]) => ({ id, name: acc.name, avg: acc.count ? acc.totalMin / acc.count : 0 }))
      .sort((a, b) => a.avg - b.avg);

    const prevRankMap = new Map<string, number>();
    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, acc]) => ({ id, avg: acc.count ? acc.totalMin / acc.count : 0 }))
      .sort((a, b) => a.avg - b.avg);
    prevSorted.forEach((r, i) => prevRankMap.set(r.id, i + 1));

    const total = sorted.length;
    const fahrerRows: FahrerRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(r.id) ?? rang;
      return {
        fahrer_id: r.id,
        fahrer_name: r.name,
        rang,
        reaktionszeit_min: Math.round(r.avg * 10) / 10,
        rank_delta: prevRang - rang,
        ampel: ampelVon(rang, total),
        alert_langsam: r.avg > 30,
      };
    });

    const teamAvg = sorted.reduce((s, r) => s + r.avg, 0) / (sorted.length || 1);

    const result: ApiResponse = {
      fahrer: fahrerRows,
      team_avg_min: Math.round(teamAvg * 10) / 10,
      schnellste_name: sorted[0]?.name ?? '',
      langsamste_name: sorted[sorted.length - 1]?.name ?? '',
      alert_count: fahrerRows.filter(f => f.alert_langsam).length,
      gesamt: total,
    };
    if (driverId) {
      const me = fahrerRows.find(f => f.fahrer_id === driverId);
      return NextResponse.json({ ...result, fahrer_single: me ?? null });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
