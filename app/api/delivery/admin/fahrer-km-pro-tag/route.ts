import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_km_pro_tag: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km_pro_tag: number;
  aktivster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, avg_km_pro_tag: 87.4, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_km_pro_tag: 74.2, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', rang: 3, avg_km_pro_tag: 58.1, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_km_pro_tag: 31.5, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_km_pro_tag: 62.8,
  aktivster_name: 'Sara K.',
  wenigster_name: 'Tim B.',
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
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, distance_km, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30.toISOString())
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30.toISOString())
        .lt('started_at', cur30.toISOString())
        .not('distance_km', 'is', null)
        .gt('distance_km', 0),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    // Group current period: sum km and distinct active days per driver
    const groupCur = new Map<string, { name: string; totalKm: number; days: Set<string> }>();
    for (const t of curData) {
      const day = (t.started_at as string).slice(0, 10);
      const entry = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, totalKm: 0, days: new Set<string>() };
      entry.totalKm += t.distance_km ?? 0;
      entry.days.add(day);
      groupCur.set(t.driver_id, entry);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avgKm: v.days.size > 0 ? Math.round((v.totalKm / v.days.size) * 10) / 10 : 0,
    }));

    // Descending: Rang 1 = highest km/day = most active driver
    const sorted = [...unsorted].sort((a, b) => b.avgKm - a.avgKm);
    const total = sorted.length;

    // Previous period for rank delta
    const groupPrev = new Map<string, { totalKm: number; days: Set<string> }>();
    for (const t of prevData) {
      const day = (t.started_at as string).slice(0, 10);
      const entry = groupPrev.get(t.driver_id) ?? { totalKm: 0, days: new Set<string>() };
      entry.totalKm += t.distance_km ?? 0;
      entry.days.add(day);
      groupPrev.set(t.driver_id, entry);
    }
    const prevUnsorted = unsorted.map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const avgKm = p && p.days.size > 0 ? Math.round((p.totalKm / p.days.size) * 10) / 10 : f.avgKm;
      return { fahrer_id: f.fahrer_id, avgKm };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.avgKm - a.avgKm);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id:      f.fahrer_id,
        fahrer_name:    f.fahrer_name,
        rang,
        avg_km_pro_tag: f.avgKm,
        rank_delta:     prevRang - rang,
        ampel,
        alert_niedrig:  ampel === 'rot',
      };
    });

    const team_avg_km_pro_tag =
      Math.round((fahrer.reduce((s, f) => s + f.avg_km_pro_tag, 0) / total) * 10) / 10;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({
        fahrer:             me ? [me] : fahrer,
        team_avg_km_pro_tag,
        aktivster_name:     fahrer[0]?.fahrer_name ?? '',
        wenigster_name:     fahrer[total - 1]?.fahrer_name ?? '',
        alert_count:        fahrer.filter(f => f.alert_niedrig).length,
        gesamt:             total,
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      fahrer,
      team_avg_km_pro_tag,
      aktivster_name:  fahrer[0]?.fahrer_name ?? '',
      wenigster_name:  fahrer[total - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt:          total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
