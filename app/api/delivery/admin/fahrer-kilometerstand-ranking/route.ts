import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  gesamt_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_km: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, gesamt_km: 1240, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, gesamt_km: 1080, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, gesamt_km:  890, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, gesamt_km:  620, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg_km: 957.5,
  meister_name: 'Julia F.',
  wenigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_km: 800,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  // descending: Rang 1 = meiste km = bester → grün für Top-25%
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
        .select('driver_id, driver_name, distance_km')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; km: number }>();
    for (const t of curData) {
      if (!t.driver_id) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, km: 0 };
      groupCur.set(t.driver_id, { name: prev.name, km: prev.km + (t.distance_km ?? 0) });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const t of prevRes.data ?? []) {
      if (!t.driver_id) continue;
      groupPrev.set(t.driver_id, (groupPrev.get(t.driver_id) ?? 0) + (t.distance_km ?? 0));
    }

    // descending: Rang 1 = meiste km = bester
    const sorted = Array.from(groupCur.entries())
      .map(([id, v]) => ({ fahrer_id: id, fahrer_name: v.name || id.slice(0, 8), km: Math.round(v.km) }))
      .sort((a, b) => b.km - a.km);

    const total = sorted.length;

    const prevSorted = sorted
      .map(f => ({ ...f, km: Math.round(groupPrev.get(f.fahrer_id) ?? 0) }))
      .sort((a, b) => b.km - a.km);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        gesamt_km: f.km,
        rank_delta: prevRang - rang,
        ampel,
        alert_wenig: ampel === 'rot',
      };
    });

    const team_avg_km = Math.round(fahrer.reduce((s, f) => s + f.gesamt_km, 0) / total);

    return NextResponse.json({
      fahrer,
      team_avg_km,
      meister_name: fahrer[0]?.fahrer_name ?? '',
      wenigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt: total,
      ziel_km: 800,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
