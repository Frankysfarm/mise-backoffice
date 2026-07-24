import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  effizientester_name: string;
  hoechster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_km: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_pro_tour: 4.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_pro_tour: 5.1, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_pro_tour: 6.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_pro_tour: 9.2, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_km: 6.325,
  effizientester_name: 'Julia F.',
  hoechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_km: 5,
};

interface TourRow {
  driver_id: string;
  driver_name: string;
  distance_km: number | null;
  completed_at: string | null;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

// Lower is better for km per tour
function rankAmpel(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = thirtyDaysAgo();

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('driver_id, driver_name, distance_km, completed_at')
      .eq('location_id', location_id)
      .gte('completed_at', since)
      .not('completed_at', 'is', null)
      .not('distance_km', 'is', null);

    const rows = (tours ?? []) as TourRow[];
    if (rows.length === 0) return NextResponse.json(MOCK);

    const map: Record<string, { name: string; total_km: number; count: number }> = {};
    for (const t of rows) {
      if (!t.distance_km) continue;
      if (!map[t.driver_id]) map[t.driver_id] = { name: t.driver_name, total_km: 0, count: 0 };
      map[t.driver_id].total_km += t.distance_km;
      map[t.driver_id].count += 1;
    }

    const sorted = Object.entries(map)
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        km_pro_tour: v.count > 0 ? Math.round((v.total_km / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.km_pro_tour - b.km_pro_tour); // Ascending: lower = better

    const total = sorted.length;
    const teamAvg = Math.round((sorted.reduce((s, r) => s + r.km_pro_tour, 0) / total) * 100) / 100;

    const fahrer: FahrerRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const ampel = rankAmpel(rang, total);
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        km_pro_tour: r.km_pro_tour,
        rank_delta: 0,
        ampel,
        alert_hoch: ampel === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_km: teamAvg,
      effizientester_name: fahrer[0]?.fahrer_name ?? '—',
      hoechster_name: fahrer[total - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
      ziel_km: 5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
