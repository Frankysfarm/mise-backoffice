import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerStreckeRow {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerStreckeRow[];
  team_avg_km: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', km_pro_tour: 4.2, rank_delta: 1,  ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  km_pro_tour: 5.1, rank_delta: 0,  ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   km_pro_tour: 6.8, rank_delta: -1, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   km_pro_tour: 9.3, rank_delta: -1, ampel: 'rot',   rang: 4 },
  ],
  team_avg_km: 6.35,
  alert_count: 1,
};

function calcAmpel(rang: number, total: number): Ampel {
  const pct = rang / total;
  // rank 1 = shortest km/tour = best (Bottom-25% by km = Top-25% by efficiency)
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('driver_id, distance_km')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', since);

    if (!tours?.length) return NextResponse.json(MOCK);

    const driverMap = new Map<string, { total_km: number; count: number }>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const km = t.distance_km ?? 0;
      const cur = driverMap.get(t.driver_id) ?? { total_km: 0, count: 0 };
      driverMap.set(t.driver_id, { total_km: cur.total_km + km, count: cur.count + 1 });
    }

    const driverIds = [...driverMap.keys()];
    const { data: driversRaw } = await supabase
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const unsorted = driverIds.map(dId => {
      const { total_km, count } = driverMap.get(dId)!;
      return {
        fahrer_id: dId,
        fahrer_name: nameMap[dId] ?? dId,
        km_pro_tour: count > 0 ? Math.round((total_km / count) * 10) / 10 : 0,
      };
    });

    // Sort ascending: shortest km/tour = rank 1 = most efficient
    unsorted.sort((a, b) => a.km_pro_tour - b.km_pro_tour);
    const total = unsorted.length;
    const teamAvg = total > 0 ? unsorted.reduce((s, f) => s + f.km_pro_tour, 0) / total : 0;

    const fahrer: FahrerStreckeRow[] = unsorted.map((f, i) => {
      const rang = i + 1;
      const ampel = calcAmpel(rang, total);
      return {
        ...f,
        rang,
        ampel,
        rank_delta: 0,
      };
    });

    const alertCount = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      fahrer,
      team_avg_km: Math.round(teamAvg * 10) / 10,
      alert_count: alertCount,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
