import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerUmsatz {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface UmsatzRankingResponse {
  fahrer: FahrerUmsatz[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerUmsatz[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_schicht: 285, rank_delta: 1, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, umsatz_pro_schicht: 241, rank_delta: 0, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, umsatz_pro_schicht: 198, rank_delta: -1, ampel: 'gelb', alert_bottom: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_schicht: 143, rank_delta: 0, ampel: 'rot', alert_bottom: true },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.umsatz_pro_schicht, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    bester_name: MOCK[0].fahrer_name,
    niedrigster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_bottom).length,
    gesamt: MOCK.length,
  } satisfies UmsatzRankingResponse);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id = searchParams.get('driver_id');

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, revenue, drivers(full_name)')
        .eq('location_id', location_id ?? '')
        .gte('started_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`)
        .gt('revenue', 0),
      supabase
        .from('driver_shifts')
        .select('driver_id, revenue')
        .eq('location_id', location_id ?? '')
        .gte('started_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('started_at', `${yesterday}T23:59:59`)
        .gt('revenue', 0),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    const curData = curRes.data as Array<{ driver_id: string; revenue: number; drivers: { full_name: string } | null }>;
    const prevData = (prevRes.data ?? []) as Array<{ driver_id: string; revenue: number }>;

    const grouped: Record<string, { name: string; total_revenue: number; shift_count: number }> = {};
    for (const row of curData) {
      if (!grouped[row.driver_id]) {
        grouped[row.driver_id] = {
          name: (row.drivers as { full_name: string } | null)?.full_name ?? row.driver_id,
          total_revenue: 0,
          shift_count: 0,
        };
      }
      grouped[row.driver_id].total_revenue += row.revenue ?? 0;
      grouped[row.driver_id].shift_count += 1;
    }

    const prevGrouped: Record<string, number> = {};
    for (const row of prevData) {
      if (!prevGrouped[row.driver_id]) prevGrouped[row.driver_id] = 0;
      prevGrouped[row.driver_id] += row.revenue ?? 0;
    }

    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        avg: d.shift_count > 0 ? Math.round(d.total_revenue / d.shift_count) : 0,
      }))
      .sort((a, b) => b.avg - a.avg);

    const n = sorted.length;
    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const prevSortedIds = Object.entries(prevGrouped)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const fahrer: FahrerUmsatz[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevSortedIds.indexOf(f.fahrer_id) >= 0 ? prevSortedIds.indexOf(f.fahrer_id) + 1 : rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        umsatz_pro_schicht: f.avg,
        rank_delta: prevRang - rang,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_bottom: rang > bot25idx,
      };
    });

    const team_avg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.umsatz_pro_schicht, 0) / fahrer.length)
      : 0;

    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: fahrer.length,
    } satisfies UmsatzRankingResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
