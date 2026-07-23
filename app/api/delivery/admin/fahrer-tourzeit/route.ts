import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerTourzeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  tourzeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface TourzeitResponse {
  fahrer: FahrerTourzeit[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerTourzeit[] = [
  { fahrer_id: 't1', fahrer_name: 'Julia F.', rang: 1, tourzeit_min: 42, rank_delta:  0, ampel: 'gruen', alert_top: false },
  { fahrer_id: 't2', fahrer_name: 'Sara K.',  rang: 2, tourzeit_min: 58, rank_delta:  1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 't3', fahrer_name: 'Max M.',   rang: 3, tourzeit_min: 74, rank_delta: -1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 't4', fahrer_name: 'Tim B.',   rang: 4, tourzeit_min: 95, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.tourzeit_min, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    schnellster_name: MOCK[0].fahrer_name,
    langsamster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_top).length,
    gesamt: MOCK.length,
  } satisfies TourzeitResponse);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`)
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type TourRow = {
      driver_id: string;
      started_at: string | null;
      completed_at: string | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as TourRow[];
    const prevData = (prevRes.data ?? []) as TourRow[];

    function calcAvgTourzeit(tours: TourRow[], dId: string): number {
      const driverTours = tours.filter(t => t.driver_id === dId && t.started_at && t.completed_at);
      if (!driverTours.length) return 0;
      const totalMin = driverTours.reduce((s, t) => {
        const diffMs = new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime();
        return s + diffMs / 60000;
      }, 0);
      return Math.round(totalMin / driverTours.length);
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; avg: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(t => t.driver_id === dId);
      const name = nameRow?.drivers?.full_name ?? dId;
      grouped[dId] = { name, avg: calcAvgTourzeit(curData, dId) };
    }

    // ascending: shortest tourzeit = best (rank 1)
    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, tourzeit_min: d.avg }))
      .filter(f => f.tourzeit_min > 0)
      .sort((a, b) => a.tourzeit_min - b.tourzeit_min);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcAvgTourzeit(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const bot25idx = Math.ceil(n * 0.25);
    const top25idx = Math.floor(n * 0.75);

    const fahrer: FahrerTourzeit[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        tourzeit_min: f.tourzeit_min,
        rank_delta,
        ampel: rang <= bot25idx ? 'gruen' : rang <= top25idx ? 'gelb' : 'rot',
        alert_top: rang > top25idx,
      };
    });

    const team_avg = Math.round(fahrer.reduce((s, f) => s + f.tourzeit_min, 0) / fahrer.length);
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    } satisfies TourzeitResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
