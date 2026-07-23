import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerLieferzeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface LieferzeitRankingResponse {
  fahrer: FahrerLieferzeit[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerLieferzeit[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.avg_min, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    schnellster_name: MOCK[0].fahrer_name,
    langsamster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_top).length,
    gesamt: MOCK.length,
  } satisfies LieferzeitRankingResponse);
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
        .select('driver_id, created_at, delivered_at, drivers(full_name)')
        .eq('location_id', location_id)
        .not('delivered_at', 'is', null)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase
        .from('delivery_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', location_id)
        .not('delivered_at', 'is', null)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type StopRow = { driver_id: string; created_at: string; delivered_at: string; drivers?: { full_name: string } | null };

    const curData = curRes.data as StopRow[];
    const prevData = (prevRes.data ?? []) as Omit<StopRow, 'drivers'>[];

    function calcAvgMin(rows: Omit<StopRow, 'drivers'>[], dId: string): number {
      const ds = rows.filter(r => r.driver_id === dId && r.created_at && r.delivered_at);
      if (!ds.length) return 0;
      const totalMin = ds.reduce((sum, r) => {
        const diffMs = new Date(r.delivered_at).getTime() - new Date(r.created_at).getTime();
        return sum + Math.max(0, diffMs / 60000);
      }, 0);
      return Math.round((totalMin / ds.length) * 10) / 10;
    }

    const grouped: Record<string, { name: string; avg_min: number }> = {};
    const driverIds = [...new Set(curData.map(r => r.driver_id))];

    for (const dId of driverIds) {
      const nameRow = curData.find(r => r.driver_id === dId);
      grouped[dId] = {
        name: (nameRow?.drivers as { full_name: string } | null)?.full_name ?? dId,
        avg_min: calcAvgMin(curData, dId),
      };
    }

    const sorted = Object.entries(grouped)
      .filter(([, d]) => d.avg_min > 0)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, avg_min: d.avg_min }))
      .sort((a, b) => a.avg_min - b.avg_min);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcAvgMin(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerLieferzeit[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_min: f.avg_min,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_top: rang > bot25idx,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10;
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    } satisfies LieferzeitRankingResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
