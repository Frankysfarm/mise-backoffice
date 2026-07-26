import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rate_pct: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 92, rank_delta:  1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate_pct: 84, rank_delta:  0, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate_pct: 71, rank_delta: -1, ampel: 'gelb',  alert_spaet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 55, rank_delta:  0, ampel: 'rot',   alert_spaet: true  },
  ],
  team_avg_pct: 75.5,
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

    // 3 minutes tolerance in ms
    const TOLERANCE_MS = 3 * 60 * 1000;

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, picked_up_at, estimated_pickup_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('picked_up_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, picked_up_at, estimated_pickup_at')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('picked_up_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type GroupEntry = { name: string; total: number; puenktlich: number };
    const groupCur = new Map<string, GroupEntry>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, total: 0, puenktlich: 0 };
      let isPuenktlich = false;
      if (t.picked_up_at && t.estimated_pickup_at) {
        const pickedMs = new Date(t.picked_up_at).getTime();
        const estMs = new Date(t.estimated_pickup_at).getTime();
        isPuenktlich = pickedMs <= estMs + TOLERANCE_MS;
      }
      groupCur.set(t.driver_id, {
        name: prev.name,
        total: prev.total + 1,
        puenktlich: prev.puenktlich + (isPuenktlich ? 1 : 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevEntry = { total: number; puenktlich: number };
    const groupPrev = new Map<string, PrevEntry>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { total: 0, puenktlich: 0 };
      let isPuenktlich = false;
      if (t.picked_up_at && t.estimated_pickup_at) {
        const pickedMs = new Date(t.picked_up_at).getTime();
        const estMs = new Date(t.estimated_pickup_at).getTime();
        isPuenktlich = pickedMs <= estMs + TOLERANCE_MS;
      }
      groupPrev.set(t.driver_id, {
        total: prev.total + 1,
        puenktlich: prev.puenktlich + (isPuenktlich ? 1 : 0),
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      rate_pct: v.total > 0 ? Math.round((v.puenktlich / v.total) * 100) : 0,
    }));

    // descending: Rang 1 = highest rate = best
    const sorted = [...unsorted].sort((a, b) => b.rate_pct - a.rate_pct);
    const total = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const prevRate = p && p.total > 0 ? (p.puenktlich / p.total) * 100 : f.rate_pct;
      return { ...f, rate_pct: prevRate };
    }).sort((a, b) => b.rate_pct - a.rate_pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        rate_pct: f.rate_pct,
        rank_delta: rang - prevRang,
        ampel,
        alert_spaet: ampel === 'rot',
      };
    });

    const team_avg_pct = Math.round(
      fahrer.reduce((s, f) => s + f.rate_pct, 0) / total
    );

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
