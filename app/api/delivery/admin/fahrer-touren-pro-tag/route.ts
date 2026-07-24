import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerTourenRow {
  fahrer_id: string;
  fahrer_name: string;
  touren_pro_tag: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerTourenRow[];
  team_avg_touren: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', touren_pro_tag: 8.2, rank_delta: 1,  ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  touren_pro_tag: 7.1, rank_delta: 0,  ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   touren_pro_tag: 6.5, rank_delta: -1, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   touren_pro_tag: 4.8, rank_delta: -1, ampel: 'rot',   rang: 4 },
  ],
  team_avg_touren: 6.65,
  alert_count: 1,
};

function calcAmpel(rang: number, total: number): Ampel {
  const pct = rang / total;
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
      .select('driver_id, created_at')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', since);

    if (!tours?.length) return NextResponse.json(MOCK);

    const dayMap = new Map<string, Map<string, number>>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const day = t.created_at.slice(0, 10);
      if (!dayMap.has(t.driver_id)) dayMap.set(t.driver_id, new Map());
      const dm = dayMap.get(t.driver_id)!;
      dm.set(day, (dm.get(day) ?? 0) + 1);
    }

    const driverIds = [...dayMap.keys()];
    const { data: driversRaw } = await supabase
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const rows = driverIds.map((dId, i) => {
      const dm = dayMap.get(dId)!;
      const totalTours = [...dm.values()].reduce((s, c) => s + c, 0);
      const days = dm.size || 1;
      return {
        fahrer_id: dId,
        fahrer_name: nameMap[dId] ?? `Fahrer ${i + 1}`,
        touren_pro_tag: Math.round((totalTours / days) * 10) / 10,
        rank_delta: 0,
        ampel: 'gelb' as Ampel,
        rang: 0,
      };
    });

    rows.sort((a, b) => b.touren_pro_tag - a.touren_pro_tag);
    rows.forEach((r, i) => {
      r.rang = i + 1;
      r.ampel = calcAmpel(i + 1, rows.length);
    });

    const teamAvg = rows.length
      ? Math.round((rows.reduce((s, r) => s + r.touren_pro_tag, 0) / rows.length) * 10) / 10
      : 0;

    return NextResponse.json({
      fahrer: rows,
      team_avg_touren: teamAvg,
      alert_count: rows.filter(r => r.ampel === 'rot').length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
