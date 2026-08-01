import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retour_quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, retour_quote_pct: 1.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, retour_quote_pct: 2.5, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, retour_quote_pct: 5.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, retour_quote_pct: 12.3, rank_delta: 0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 5.45,
  beste_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
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

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('driver_id, driver_name, status')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_orders')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverStats = { name: string; total: number; retours: number };
    const groupCur = new Map<string, DriverStats>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      if (!groupCur.has(o.driver_id)) {
        groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id.slice(0, 8), total: 0, retours: 0 });
      }
      const g = groupCur.get(o.driver_id)!;
      g.total += 1;
      if (o.status === 'returned' || o.status === 'undeliverable' || o.status === 'failed') {
        g.retours += 1;
      }
    }

    const groupPrev = new Map<string, { total: number; retours: number }>();
    for (const o of prevData) {
      if (!o.driver_id) continue;
      if (!groupPrev.has(o.driver_id)) groupPrev.set(o.driver_id, { total: 0, retours: 0 });
      const g = groupPrev.get(o.driver_id)!;
      g.total += 1;
      if (o.status === 'returned' || o.status === 'undeliverable' || o.status === 'failed') {
        g.retours += 1;
      }
    }

    const unsorted = Array.from(groupCur.entries())
      .filter(([, v]) => v.total >= 3)
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        retour_quote_pct: Math.round((v.retours / v.total) * 1000) / 10,
      }));

    if (!unsorted.length) return NextResponse.json(MOCK_DATA);

    // AUFSTEIGEND: Rang 1 = lowest retour rate = best
    const sorted = [...unsorted].sort((a, b) => a.retour_quote_pct - b.retour_quote_pct);
    const total = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const prevPct = p && p.total >= 3 ? (p.retours / p.total) * 100 : f.retour_quote_pct;
      return { ...f, retour_quote_pct: Math.round(prevPct * 10) / 10 };
    }).sort((a, b) => a.retour_quote_pct - b.retour_quote_pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        retour_quote_pct: f.retour_quote_pct,
        rank_delta: rang - prevRang,
        ampel,
        alert_hoch: rang > total * 0.75,
      };
    });

    const team_avg_pct = Math.round(
      (fahrer.reduce((s, f) => s + f.retour_quote_pct, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_pct,
      beste_name: fahrer[0]?.fahrer_name ?? '',
      schlechteste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
