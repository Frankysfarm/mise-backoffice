import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerStoppsProTour {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StoppsProTourResponse {
  fahrer: FahrerStoppsProTour[];
  team_avg_stopps: number;
  alert_count: number;
}

const MOCK: FahrerStoppsProTour[] = [
  { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stopps_pro_tour: 12.5, rank_delta:  1, ampel: 'gruen' },
  { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, stopps_pro_tour: 10.8, rank_delta:  0, ampel: 'gruen' },
  { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, stopps_pro_tour:  9.2, rank_delta: -1, ampel: 'gelb'  },
  { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_tour:  6.5, rank_delta: -1, ampel: 'rot'   },
];

function buildMockResponse(): NextResponse {
  const avg = parseFloat((MOCK.reduce((s, f) => s + f.stopps_pro_tour, 0) / MOCK.length).toFixed(1));
  const alertCount = MOCK.filter(f => f.ampel === 'rot').length;
  return NextResponse.json({ fahrer: MOCK, team_avg_stopps: avg, alert_count: alertCount } satisfies StoppsProTourResponse);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, stops_count, created_at, drivers(name)')
      .eq('location_id', location_id)
      .gte('created_at', thirtyDaysAgo)
      .not('driver_id', 'is', null);

    if (error || !tours || tours.length === 0) return buildMockResponse();

    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const t of tours) {
      const id = t.driver_id as string;
      const name = (t.drivers as { name?: string } | null)?.name ?? id;
      const stops = typeof t.stops_count === 'number' ? t.stops_count : 0;
      if (!map.has(id)) map.set(id, { name, total: 0, count: 0 });
      const e = map.get(id)!;
      e.total += stops;
      e.count += 1;
    }

    const sorted = [...map.entries()]
      .map(([id, v]) => ({ fahrer_id: id, fahrer_name: v.name, avg: parseFloat((v.total / v.count).toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg);

    const n = sorted.length;
    const q75 = Math.ceil(n * 0.75);
    const q25 = Math.ceil(n * 0.25);
    const teamAvg = parseFloat((sorted.reduce((s, f) => s + f.avg, 0) / n).toFixed(1));

    const fahrer: FahrerStoppsProTour[] = sorted.map((f, i) => {
      const rank = i + 1;
      const ampel: 'gruen' | 'gelb' | 'rot' = rank <= q25 ? 'gruen' : rank > q75 ? 'rot' : 'gelb';
      return { fahrer_id: f.fahrer_id, fahrer_name: f.fahrer_name, rang: rank, stopps_pro_tour: f.avg, rank_delta: 0, ampel };
    });

    const alertCount = fahrer.filter(f => f.ampel === 'rot').length;
    return NextResponse.json({ fahrer, team_avg_stopps: teamAvg, alert_count: alertCount } satisfies StoppsProTourResponse);
  } catch {
    return buildMockResponse();
  }
}
