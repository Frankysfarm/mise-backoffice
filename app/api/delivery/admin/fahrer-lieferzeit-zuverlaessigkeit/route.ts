import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  zuverlaessigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, zuverlaessigkeit_pct: 94, rank_delta:  0, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, zuverlaessigkeit_pct: 87, rank_delta:  1, ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, zuverlaessigkeit_pct: 79, rank_delta: -1, ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, zuverlaessigkeit_pct: 61, rank_delta:  0, ampel: 'rot',   alert_low: true  },
  ],
  team_avg: 80,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(pct: number, top25: number, bottom25: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= top25) return 'gruen';
  if (pct >= bottom25) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('driver_id, driver_name, delivered_at, promised_eta')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('delivered_at', 'is', null),
      supabase
        .from('delivery_stops')
        .select('driver_id, delivered_at, promised_eta')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('delivered_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; onTime: number }>();
    for (const r of curData) {
      if (!r.driver_id) continue;
      if (!groupCur.has(r.driver_id)) groupCur.set(r.driver_id, { name: r.driver_name ?? r.driver_id, total: 0, onTime: 0 });
      const entry = groupCur.get(r.driver_id)!;
      entry.total++;
      if (r.delivered_at && r.promised_eta && new Date(r.delivered_at) <= new Date(r.promised_eta)) {
        entry.onTime++;
      }
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; onTime: number }>();
    for (const r of prevData) {
      if (!r.driver_id) continue;
      if (!groupPrev.has(r.driver_id)) groupPrev.set(r.driver_id, { total: 0, onTime: 0 });
      const entry = groupPrev.get(r.driver_id)!;
      entry.total++;
      if (r.delivered_at && r.promised_eta && new Date(r.delivered_at) <= new Date(r.promised_eta)) {
        entry.onTime++;
      }
    }

    const rows = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name,
      zuverlaessigkeit_pct: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
      prev_pct: (() => {
        const p = groupPrev.get(id);
        return p && p.total > 0 ? Math.round((p.onTime / p.total) * 100) : null;
      })(),
    }));

    rows.sort((a, b) => b.zuverlaessigkeit_pct - a.zuverlaessigkeit_pct);

    const sorted = rows.map((r, i) => ({ ...r, rang: i + 1 }));
    const n = sorted.length;
    const top25 = sorted[Math.floor(n * 0.25)]?.zuverlaessigkeit_pct ?? sorted[0].zuverlaessigkeit_pct;
    const bottom25 = sorted[Math.floor(n * 0.75)]?.zuverlaessigkeit_pct ?? sorted[n - 1].zuverlaessigkeit_pct;

    const ranked: FahrerRow[] = sorted.map((r, i) => {
      const prevPct = r.prev_pct;
      const prevRankIdx = prevPct != null
        ? rows.filter(x => x.zuverlaessigkeit_pct > prevPct).length + 1
        : r.rang;
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang: r.rang,
        zuverlaessigkeit_pct: r.zuverlaessigkeit_pct,
        rank_delta: prevRankIdx - r.rang,
        ampel: ampelVon(r.zuverlaessigkeit_pct, top25, bottom25),
        alert_low: r.zuverlaessigkeit_pct < bottom25,
      };
    });

    const teamAvg = Math.round(ranked.reduce((s, r) => s + r.zuverlaessigkeit_pct, 0) / ranked.length);

    return NextResponse.json({
      fahrer: ranked,
      team_avg: teamAvg,
      bester_name: ranked[0]?.fahrer_name ?? '',
      letzter_name: ranked[ranked.length - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(r => r.alert_low).length,
      gesamt: ranked.length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
