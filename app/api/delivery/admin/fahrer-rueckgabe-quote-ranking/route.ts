import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 1.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, quote_pct: 2.8, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, quote_pct: 4.5, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 8.1, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 4.15,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
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

    const [curAllRes, curRetRes, prevAllRes, prevRetRes] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('driver_id, driver_name')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_orders')
        .select('driver_id')
        .eq('location_id', locationId)
        .in('status', ['returned', 'rejected'])
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_orders')
        .select('driver_id')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
      supabase
        .from('delivery_orders')
        .select('driver_id')
        .eq('location_id', locationId)
        .in('status', ['returned', 'rejected'])
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curAll = curAllRes.data ?? [];
    const curRet = curRetRes.data ?? [];
    const prevAll = prevAllRes.data ?? [];
    const prevRet = prevRetRes.data ?? [];

    if (!curAll.length) return NextResponse.json(MOCK_DATA);

    const totalByDriver = new Map<string, { name: string; total: number; ret: number }>();
    for (const o of curAll) {
      const prev = totalByDriver.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, ret: 0 };
      totalByDriver.set(o.driver_id, { ...prev, total: prev.total + 1 });
    }
    for (const o of curRet) {
      const prev = totalByDriver.get(o.driver_id);
      if (prev) totalByDriver.set(o.driver_id, { ...prev, ret: prev.ret + 1 });
    }

    if (!totalByDriver.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(totalByDriver.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      quote_pct: v.total > 0 ? Math.round((v.ret / v.total) * 10000) / 100 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => a.quote_pct - b.quote_pct);
    const total = sorted.length;

    const prevTotalByDriver = new Map<string, { total: number; ret: number }>();
    for (const o of prevAll) {
      const prev = prevTotalByDriver.get(o.driver_id) ?? { total: 0, ret: 0 };
      prevTotalByDriver.set(o.driver_id, { ...prev, total: prev.total + 1 });
    }
    for (const o of prevRet) {
      const prev = prevTotalByDriver.get(o.driver_id);
      if (prev) prevTotalByDriver.set(o.driver_id, { ...prev, ret: prev.ret + 1 });
    }

    const prevQuote = new Map<string, number>();
    for (const [id, v] of prevTotalByDriver.entries()) {
      prevQuote.set(id, v.total > 0 ? v.ret / v.total : 0);
    }

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, quote_pct: prevQuote.has(f.fahrer_id) ? (prevQuote.get(f.fahrer_id)! * 100) : f.quote_pct }))
      .sort((a, b) => a.quote_pct - b.quote_pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        quote_pct: f.quote_pct,
        rank_delta: rang - prevRang,
        ampel,
        alert_top: ampel === 'rot',
      };
    });

    const team_avg = Math.round(
      (fahrer.reduce((s, f) => s + f.quote_pct, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
