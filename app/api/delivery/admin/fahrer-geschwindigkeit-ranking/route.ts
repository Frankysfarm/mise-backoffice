import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_kmh: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_kmh: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_kmh: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_kmh: 28, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_kmh: 25, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_kmh: 21, rank_delta: -1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_kmh: 16, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_kmh: 22.5,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_kmh: 25,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  // descending: Rang 1 = höchste km/h = bester → grün für Top-25%
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
        .select('driver_id, driver_name, distance_km, duration_minutes')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km, duration_minutes')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; totalKm: number; totalMin: number }>();
    for (const t of curData) {
      if (!t.driver_id) continue;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, totalKm: 0, totalMin: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        totalKm: prev.totalKm + (t.distance_km ?? 0),
        totalMin: prev.totalMin + (t.duration_minutes ?? 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { totalKm: number; totalMin: number }>();
    for (const t of prevRes.data ?? []) {
      if (!t.driver_id) continue;
      const prev = groupPrev.get(t.driver_id) ?? { totalKm: 0, totalMin: 0 };
      groupPrev.set(t.driver_id, {
        totalKm: prev.totalKm + (t.distance_km ?? 0),
        totalMin: prev.totalMin + (t.duration_minutes ?? 0),
      });
    }

    // avg km/h = (totalKm / totalMin) * 60; descending: Rang 1 = höchste km/h = bester
    const sorted = Array.from(groupCur.entries())
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name || id.slice(0, 8),
        avg_kmh: v.totalMin > 0 ? Math.round((v.totalKm / v.totalMin) * 60 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avg_kmh - a.avg_kmh);

    const total = sorted.length;

    const prevSorted = Array.from(groupPrev.entries())
      .map(([id, v]) => ({
        fahrer_id: id,
        avg_kmh: v.totalMin > 0 ? (v.totalKm / v.totalMin) * 60 : 0,
      }))
      .sort((a, b) => b.avg_kmh - a.avg_kmh);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_kmh: f.avg_kmh,
        rank_delta: prevRang - rang,
        ampel,
        alert_langsam: ampel === 'rot',
      };
    });

    const team_avg_kmh =
      Math.round((fahrer.reduce((s, f) => s + f.avg_kmh, 0) / total) * 10) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_kmh,
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_langsam).length,
      gesamt: total,
      ziel_kmh: 25,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
