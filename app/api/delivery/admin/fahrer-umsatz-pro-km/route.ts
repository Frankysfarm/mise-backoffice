import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_umsatz_pro_km: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_umsatz_pro_km: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_km: 3.20, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, umsatz_pro_km: 2.85, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, umsatz_pro_km: 2.40, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_km: 1.90, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_umsatz_pro_km: 2.59,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_umsatz_pro_km: 2.50,
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
        .select('driver_id, driver_name, order_total, distance_km')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
      supabase
        .from('delivery_tours')
        .select('driver_id, order_total, distance_km')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; totalUmsatz: number; totalKm: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, totalUmsatz: 0, totalKm: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        totalUmsatz: prev.totalUmsatz + (t.order_total ?? 0),
        totalKm: prev.totalKm + (t.distance_km ?? 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { totalUmsatz: number; totalKm: number }>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { totalUmsatz: 0, totalKm: 0 };
      groupPrev.set(t.driver_id, {
        totalUmsatz: prev.totalUmsatz + (t.order_total ?? 0),
        totalKm: prev.totalKm + (t.distance_km ?? 0),
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      upk: v.totalKm > 0 ? Math.round((v.totalUmsatz / v.totalKm) * 100) / 100 : 0,
    }));

    // descending: Rang 1 = highest €/km = best
    const sorted = [...unsorted].sort((a, b) => b.upk - a.upk);
    const total = sorted.length;

    const prevUpk = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.totalKm > 0 ? Math.round((v.totalUmsatz / v.totalKm) * 100) / 100 : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, upk: prevUpk.get(f.fahrer_id) ?? f.upk }))
      .sort((a, b) => b.upk - a.upk);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        umsatz_pro_km: f.upk,
        rank_delta: prevRang - rang,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    const team_avg_umsatz_pro_km =
      Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_km, 0) / total) * 100) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_umsatz_pro_km,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
      ziel_umsatz_pro_km: 2.50,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
