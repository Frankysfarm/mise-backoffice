import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_spaet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_rate: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_rate: 92, rank_delta:  1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlichkeit_rate: 84, rank_delta:  0, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlichkeit_rate: 71, rank_delta: -1, ampel: 'gelb',  alert_spaet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_rate: 55, rank_delta:  0, ampel: 'rot',   alert_spaet: true  },
  ],
  team_avg_rate: 75.5,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_rate: 90,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

const TOLERANZ_MS = 3 * 60 * 1000; // 3 Minuten Toleranz

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
        .select('driver_id, driver_name, picked_up_at, estimated_pickup_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('picked_up_at', 'is', null)
        .not('estimated_pickup_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, picked_up_at, estimated_pickup_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('picked_up_at', 'is', null)
        .not('estimated_pickup_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    // Group current period
    const groupCur = new Map<string, { name: string; total: number; puenktlich: number }>();
    for (const t of curData) {
      const pickedMs = new Date(t.picked_up_at).getTime();
      const estMs = new Date(t.estimated_pickup_at).getTime();
      const isPuenktlich = pickedMs <= estMs + TOLERANZ_MS;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, total: 0, puenktlich: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        total: prev.total + 1,
        puenktlich: prev.puenktlich + (isPuenktlich ? 1 : 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    // Group previous period
    const groupPrev = new Map<string, { total: number; puenktlich: number }>();
    for (const t of prevData) {
      const pickedMs = new Date(t.picked_up_at).getTime();
      const estMs = new Date(t.estimated_pickup_at).getTime();
      const isPuenktlich = pickedMs <= estMs + TOLERANZ_MS;
      const prev = groupPrev.get(t.driver_id) ?? { total: 0, puenktlich: 0 };
      groupPrev.set(t.driver_id, { total: prev.total + 1, puenktlich: prev.puenktlich + (isPuenktlich ? 1 : 0) });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      rate: Math.round((v.puenktlich / Math.max(v.total, 1)) * 100),
    }));

    // descending: Rang 1 = höchste Rate = bester
    const sorted = [...unsorted].sort((a, b) => b.rate - a.rate);
    const total = sorted.length;

    const prevRates = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        Math.round((v.puenktlich / Math.max(v.total, 1)) * 100),
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, rate: prevRates.get(f.fahrer_id) ?? f.rate }))
      .sort((a, b) => b.rate - a.rate);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        puenktlichkeit_rate: f.rate,
        rank_delta: rang - prevRang,
        ampel,
        alert_spaet: ampel === 'rot',
      };
    });

    const team_avg_rate = Math.round(
      fahrer.reduce((s, f) => s + f.puenktlichkeit_rate, 0) / total
    );

    return NextResponse.json({
      fahrer,
      team_avg_rate,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_spaet).length,
      gesamt: total,
      ziel_rate: 90,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
