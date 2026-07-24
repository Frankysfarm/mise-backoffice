import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerPuenktlichkeitRow {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerPuenktlichkeitRow[];
  team_avg_pct: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', puenktlichkeit_pct: 96, rank_delta: 1,  ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  puenktlichkeit_pct: 89, rank_delta: 0,  ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   puenktlichkeit_pct: 78, rank_delta: -1, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   puenktlichkeit_pct: 62, rank_delta: -1, ampel: 'rot',   rang: 4 },
  ],
  team_avg_pct: 81.25,
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

    const [{ data: tours }, { data: driversRaw }] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, actual_delivery_time, promised_delivery_time')
        .eq('location_id', locationId)
        .gte('created_at', since),
      supabase
        .from('delivery_drivers')
        .select('id, name')
        .eq('location_id', locationId),
    ]);

    if (!tours?.length) return NextResponse.json(MOCK);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const driverMap = new Map<string, { on_time: number; total: number }>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      const cur = driverMap.get(t.driver_id) ?? { on_time: 0, total: 0 };
      const isOnTime =
        t.actual_delivery_time && t.promised_delivery_time
          ? t.actual_delivery_time <= t.promised_delivery_time
          : false;
      driverMap.set(t.driver_id, {
        on_time: cur.on_time + (isOnTime ? 1 : 0),
        total: cur.total + 1,
      });
    }

    const unsorted = [...driverMap.entries()].map(([dId, { on_time, total }]) => ({
      fahrer_id: dId,
      fahrer_name: nameMap[dId] ?? dId,
      puenktlichkeit_pct: total > 0 ? Math.round((on_time / total) * 100) : 0,
    }));

    unsorted.sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);
    const cnt = unsorted.length;
    const teamAvg = cnt > 0 ? unsorted.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / cnt : 0;

    const fahrer: FahrerPuenktlichkeitRow[] = unsorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      ampel: calcAmpel(i + 1, cnt),
      rank_delta: 0,
    }));

    return NextResponse.json({
      fahrer,
      team_avg_pct: Math.round(teamAvg * 10) / 10,
      alert_count: fahrer.filter(f => f.ampel === 'rot').length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
