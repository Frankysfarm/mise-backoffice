import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerReaktionszeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reaktionszeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ReaktionszeitResponse {
  fahrer: FahrerReaktionszeit[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerReaktionszeit[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, reaktionszeit_min:  3, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, reaktionszeit_min:  6, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, reaktionszeit_min: 12, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, reaktionszeit_min: 22, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.reaktionszeit_min, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    bester_name: MOCK[0].fahrer_name,
    niedrigster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_bottom).length,
    gesamt: MOCK.length,
  } satisfies ReaktionszeitResponse);
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

    // departed_at - assigned_at (or created_at as fallback) = reaction time in minutes
    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, assigned_at, created_at, drivers(full_name)')
        .eq('location_id', location_id)
        .not('departed_at', 'is', null)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase
        .from('delivery_tours')
        .select('driver_id, departed_at, assigned_at, created_at')
        .eq('location_id', location_id)
        .not('departed_at', 'is', null)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type TourRow = {
      driver_id: string;
      departed_at: string | null;
      assigned_at: string | null;
      created_at: string | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as TourRow[];
    const prevData = (prevRes.data ?? []) as TourRow[];

    function calcReaktionszeit(tours: TourRow[], dId: string): number {
      const driverTours = tours.filter(t => t.driver_id === dId && t.departed_at);
      if (!driverTours.length) return 999;
      const times = driverTours.map(t => {
        const start = t.assigned_at ?? t.created_at;
        if (!start || !t.departed_at) return null;
        const diffMin = (new Date(t.departed_at).getTime() - new Date(start).getTime()) / 60000;
        return diffMin >= 0 ? diffMin : null;
      }).filter((x): x is number => x !== null);
      if (!times.length) return 999;
      return Math.round(times.reduce((s, v) => s + v, 0) / times.length);
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; min: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(t => t.driver_id === dId);
      const name = nameRow?.drivers?.full_name ?? dId;
      grouped[dId] = { name, min: calcReaktionszeit(curData, dId) };
    }

    // ascending: lowest reaction time = best (rank 1)
    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, reaktionszeit_min: d.min }))
      .sort((a, b) => a.reaktionszeit_min - b.reaktionszeit_min);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcReaktionszeit(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerReaktionszeit[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        reaktionszeit_min: f.reaktionszeit_min,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_bottom: rang > bot25idx,
      };
    });

    const team_avg = Math.round(fahrer.reduce((s, f) => s + f.reaktionszeit_min, 0) / fahrer.length);
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: fahrer.length,
    } satisfies ReaktionszeitResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
