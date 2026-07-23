import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerErsteStoppZeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  erste_stopp_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ErsteStoppZeitResponse {
  fahrer: FahrerErsteStoppZeit[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerErsteStoppZeit[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, erste_stopp_min: 8,  rank_delta: -1, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, erste_stopp_min: 12, rank_delta:  0, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, erste_stopp_min: 18, rank_delta:  1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, erste_stopp_min: 27, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.erste_stopp_min, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    schnellster_name: MOCK[0].fahrer_name,
    langsamster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_top).length,
    gesamt: MOCK.length,
  } satisfies ErsteStoppZeitResponse);
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
        .select('driver_id, departed_at, delivery_stops(created_at, delivered_at, drivers(full_name))')
        .eq('location_id', location_id)
        .not('departed_at', 'is', null)
        .gte('departed_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('departed_at', `${today}T23:59:59`),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, delivery_stops(created_at, delivered_at)')
        .eq('location_id', location_id)
        .not('departed_at', 'is', null)
        .gte('departed_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('departed_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type TourRow = {
      driver_id: string;
      departed_at: string;
      delivery_stops?: { created_at: string; delivered_at: string | null; drivers?: { full_name: string } | null }[];
    };

    const curData = curRes.data as TourRow[];
    const prevData = (prevRes.data ?? []) as TourRow[];

    function calcErsteStoppMin(tours: TourRow[], dId: string): number {
      const driverTours = tours.filter(t => t.driver_id === dId && t.departed_at);
      if (!driverTours.length) return 0;
      let totalMin = 0;
      let count = 0;
      for (const tour of driverTours) {
        const stops = tour.delivery_stops ?? [];
        const firstStop = stops
          .filter(s => s.created_at)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        if (!firstStop) continue;
        const diffMs = new Date(firstStop.created_at).getTime() - new Date(tour.departed_at).getTime();
        if (diffMs > 0) {
          totalMin += diffMs / 60000;
          count++;
        }
      }
      if (!count) return 0;
      return Math.round((totalMin / count) * 10) / 10;
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; erste_stopp_min: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(t => t.driver_id === dId);
      const nameFromStop = nameRow?.delivery_stops?.find(s => s.drivers?.full_name)?.drivers?.full_name;
      grouped[dId] = {
        name: nameFromStop ?? dId,
        erste_stopp_min: calcErsteStoppMin(curData, dId),
      };
    }

    const sorted = Object.entries(grouped)
      .filter(([, d]) => d.erste_stopp_min > 0)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, erste_stopp_min: d.erste_stopp_min }))
      .sort((a, b) => a.erste_stopp_min - b.erste_stopp_min);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcErsteStoppMin(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerErsteStoppZeit[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        erste_stopp_min: f.erste_stopp_min,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_top: rang > bot25idx,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.erste_stopp_min, 0) / fahrer.length) * 10) / 10;
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    } satisfies ErsteStoppZeitResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
