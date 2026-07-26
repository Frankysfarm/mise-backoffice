import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_tour: number;
  rank_delta: number;
  ampel: Ampel;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stopps: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stopps_pro_tour: 12.5, rank_delta:  1, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, stopps_pro_tour: 10.8, rank_delta:  0, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, stopps_pro_tour:  9.2, rank_delta: -1, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_tour:  6.5, rank_delta: -1, ampel: 'rot'   },
  ],
  team_avg_stopps: 9.75,
  alert_count: 1,
};

function calcAmpel(rang: number, total: number): Ampel {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('driver_id, stops_count')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', since);

    if (!tours?.length) return NextResponse.json(MOCK);

    const driverMap = new Map<string, { total: number; count: number }>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const cur = driverMap.get(t.driver_id) ?? { total: 0, count: 0 };
      cur.total += t.stops_count ?? 0;
      cur.count += 1;
      driverMap.set(t.driver_id, cur);
    }

    const driverIds = [...driverMap.keys()];
    const { data: driversRaw } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; full_name: string | null }) => [d.id, d.full_name ?? 'Fahrer'])
    );

    const rows = driverIds.map(dId => {
      const d = driverMap.get(dId)!;
      return {
        fahrer_id: dId,
        fahrer_name: nameMap[dId] ?? dId,
        rang: 0,
        stopps_pro_tour: d.count > 0 ? Math.round((d.total / d.count) * 10) / 10 : 0,
        rank_delta: 0,
        ampel: 'gelb' as Ampel,
      };
    });

    rows.sort((a, b) => b.stopps_pro_tour - a.stopps_pro_tour);
    rows.forEach((r, i) => {
      r.rang = i + 1;
      r.ampel = calcAmpel(i + 1, rows.length);
    });

    const teamAvg = rows.length
      ? Math.round((rows.reduce((s, r) => s + r.stopps_pro_tour, 0) / rows.length) * 10) / 10
      : 0;

    return NextResponse.json({
      fahrer: rows,
      team_avg_stopps: teamAvg,
      alert_count: rows.filter(r => r.ampel === 'rot').length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
