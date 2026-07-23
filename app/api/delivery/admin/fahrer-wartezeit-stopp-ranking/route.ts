import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerWartezeitRanking {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wartezeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface WartezeitRankingResponse {
  fahrer: FahrerWartezeitRanking[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerWartezeitRanking[] = [
  { fahrer_id: 'p1', fahrer_name: 'Julia F.', rang: 1, wartezeit_min: 2.1, rank_delta:  0, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'p2', fahrer_name: 'Sara K.',  rang: 2, wartezeit_min: 3.5, rank_delta:  1, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'p3', fahrer_name: 'Max M.',   rang: 3, wartezeit_min: 5.2, rank_delta: -1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'p4', fahrer_name: 'Tim B.',   rang: 4, wartezeit_min: 8.1, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round((MOCK.reduce((s, f) => s + f.wartezeit_min, 0) / MOCK.length) * 10) / 10;
  return NextResponse.json({
    fahrer: data,
    team_avg,
    bester_name: MOCK[0].fahrer_name,
    letzter_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_top).length,
    gesamt: MOCK.length,
  } satisfies WartezeitRankingResponse);
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
        .from('delivery_stops')
        .select('driver_id, arrived_at, departed_at, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase
        .from('delivery_stops')
        .select('driver_id, arrived_at, departed_at')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type StopRow = {
      driver_id: string;
      arrived_at: string | null;
      departed_at: string | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as StopRow[];
    const prevData = (prevRes.data ?? []) as StopRow[];

    function calcWartezeit(stops: StopRow[], dId: string): number {
      const driverStops = stops.filter(s => s.driver_id === dId && s.arrived_at && s.departed_at);
      if (!driverStops.length) return 0;
      const totalMin = driverStops.reduce((sum, s) => {
        const diff = (new Date(s.departed_at!).getTime() - new Date(s.arrived_at!).getTime()) / 60000;
        return sum + Math.max(0, diff);
      }, 0);
      return Math.round((totalMin / driverStops.length) * 10) / 10;
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; rate: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(s => s.driver_id === dId);
      const name = nameRow?.drivers?.full_name ?? dId;
      grouped[dId] = { name, rate: calcWartezeit(curData, dId) };
    }

    // ascending: lowest wartezeit = best (rank 1)
    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, wartezeit_min: d.rate }))
      .sort((a, b) => a.wartezeit_min - b.wartezeit_min);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcWartezeit(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerWartezeitRanking[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = prevRang - rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        wartezeit_min: f.wartezeit_min,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_top: rang > bot25idx,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.wartezeit_min, 0) / fahrer.length) * 10) / 10;
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    } satisfies WartezeitRankingResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
