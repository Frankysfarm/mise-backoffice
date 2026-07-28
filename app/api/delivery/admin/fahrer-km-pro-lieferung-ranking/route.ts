import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_km_pro_lieferung: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  effizientester_name: string;
  ineffizientester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_km_pro_lieferung: 3.2, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, avg_km_pro_lieferung: 4.5, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, avg_km_pro_lieferung: 6.1, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_km_pro_lieferung: 8.7, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_km: 5.6,
  effizientester_name: 'Julia F.',
  ineffizientester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('deliveries')
        .select('driver_id, driver_name, route_km')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('route_km', 'is', null),
      supabase
        .from('deliveries')
        .select('driver_id, route_km')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('route_km', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; totalKm: number; count: number }>();
    for (const d of curData) {
      if (!d.driver_id || typeof d.route_km !== 'number' || d.route_km <= 0) continue;
      const prev = groupCur.get(d.driver_id) ?? { name: d.driver_name ?? d.driver_id, totalKm: 0, count: 0 };
      groupCur.set(d.driver_id, { name: prev.name, totalKm: prev.totalKm + d.route_km, count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { totalKm: number; count: number }>();
    for (const d of prevRes.data ?? []) {
      if (!d.driver_id || typeof d.route_km !== 'number' || d.route_km <= 0) continue;
      const prev = groupPrev.get(d.driver_id) ?? { totalKm: 0, count: 0 };
      groupPrev.set(d.driver_id, { totalKm: prev.totalKm + d.route_km, count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:           id,
      fahrer_name:         v.name || id.slice(0, 8),
      avg_km_pro_lieferung: v.count > 0 ? Math.round((v.totalKm / v.count) * 10) / 10 : 0,
    }));

    // INVERTED: aufsteigend — wenigste km/Lieferung = bester = Rang 1
    const sorted = [...unsorted].sort((a, b) => a.avg_km_pro_lieferung - b.avg_km_pro_lieferung);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pKm = p && p.count > 0 ? p.totalKm / p.count : f.avg_km_pro_lieferung;
      return { fahrer_id: f.fahrer_id, avg_km: pKm };
    }).sort((a, b) => a.avg_km - b.avg_km);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:           f.fahrer_id,
        fahrer_name:         f.fahrer_name,
        rang,
        avg_km_pro_lieferung: f.avg_km_pro_lieferung,
        rank_delta:          prevRang - rang,
        ampel,
        alert_hoch:          f.avg_km_pro_lieferung > 8,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_km_pro_lieferung, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_km:          teamAvg,
      effizientester_name:  sorted[0]?.fahrer_name ?? '',
      ineffizientester_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:          fahrer.filter(f => f.alert_hoch).length,
      gesamt:               total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
