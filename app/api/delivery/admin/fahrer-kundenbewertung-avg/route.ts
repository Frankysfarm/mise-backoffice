import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerBewertungRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_bewertung: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerBewertungRow[];
  team_avg_bewertung: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', avg_bewertung: 4.9, rank_delta: 1,  ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_bewertung: 4.7, rank_delta: 0,  ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   avg_bewertung: 4.3, rank_delta: -1, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   avg_bewertung: 3.8, rank_delta: -1, ampel: 'rot',   rang: 4 },
  ],
  team_avg_bewertung: 4.425,
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

    const [{ data: ratings }, { data: driversRaw }] = await Promise.all([
      supabase
        .from('driver_ratings')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', since),
      supabase
        .from('delivery_drivers')
        .select('id, name')
        .eq('location_id', locationId),
    ]);

    if (!ratings?.length) return NextResponse.json(MOCK);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const driverMap = new Map<string, { sum: number; count: number }>();
    for (const r of ratings) {
      if (!r.driver_id) continue;
      const cur = driverMap.get(r.driver_id) ?? { sum: 0, count: 0 };
      driverMap.set(r.driver_id, { sum: cur.sum + (r.rating ?? 0), count: cur.count + 1 });
    }

    const unsorted = [...driverMap.entries()].map(([dId, { sum, count }]) => ({
      fahrer_id: dId,
      fahrer_name: nameMap[dId] ?? dId,
      avg_bewertung: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    }));

    // Descending: highest rating = rank 1 = best
    unsorted.sort((a, b) => b.avg_bewertung - a.avg_bewertung);
    const total = unsorted.length;
    const teamAvg = total > 0 ? unsorted.reduce((s, f) => s + f.avg_bewertung, 0) / total : 0;

    const fahrer: FahrerBewertungRow[] = unsorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      ampel: calcAmpel(i + 1, total),
      rank_delta: 0,
    }));

    return NextResponse.json({
      fahrer,
      team_avg_bewertung: Math.round(teamAvg * 10) / 10,
      alert_count: fahrer.filter(f => f.ampel === 'rot').length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
