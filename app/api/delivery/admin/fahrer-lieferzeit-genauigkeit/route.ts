import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  genauigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_spaet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, genauigkeit_pct: 95, rank_delta:  1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, genauigkeit_pct: 87, rank_delta:  0, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, genauigkeit_pct: 74, rank_delta: -1, ampel: 'gelb',  alert_spaet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, genauigkeit_pct: 58, rank_delta:  0, ampel: 'rot',   alert_spaet: true  },
  ],
  team_avg_pct: 79,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 90,
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
        .from('delivery_tours')
        .select('driver_id, driver_name, delivered_at, promised_delivery_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('delivered_at', 'is', null)
        .not('promised_delivery_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, delivered_at, promised_delivery_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('delivered_at', 'is', null)
        .not('promised_delivery_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; onTime: number; total: number }>();
    for (const t of curData) {
      const onTime = t.delivered_at <= t.promised_delivery_at ? 1 : 0;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, onTime: 0, total: 0 };
      groupCur.set(t.driver_id, { name: prev.name, onTime: prev.onTime + onTime, total: prev.total + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { onTime: number; total: number }>();
    for (const t of prevData) {
      const onTime = t.delivered_at <= t.promised_delivery_at ? 1 : 0;
      const prev = groupPrev.get(t.driver_id) ?? { onTime: 0, total: 0 };
      groupPrev.set(t.driver_id, { onTime: prev.onTime + onTime, total: prev.total + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      pct: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
    }));

    // descending: Rang 1 = höchste Rate = bester
    const sorted = [...unsorted].sort((a, b) => b.pct - a.pct);
    const total = sorted.length;

    const prevPcts = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, pct: prevPcts.get(f.fahrer_id) ?? f.pct }))
      .sort((a, b) => b.pct - a.pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        genauigkeit_pct: f.pct,
        rank_delta: prevRang - rang,
        ampel,
        alert_spaet: ampel === 'rot',
      };
    });

    const team_avg_pct = Math.round(fahrer.reduce((s, f) => s + f.genauigkeit_pct, 0) / total);

    return NextResponse.json({
      fahrer,
      team_avg_pct,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_spaet).length,
      gesamt: total,
      ziel_pct: 90,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
