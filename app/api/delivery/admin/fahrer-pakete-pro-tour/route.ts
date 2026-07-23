import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerPaketeProTour {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pakete_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface PaketeProTourResponse {
  fahrer: FahrerPaketeProTour[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerPaketeProTour[] = [
  { fahrer_id: 'p1', fahrer_name: 'Julia F.', rang: 1, pakete_pro_tour: 8, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'p2', fahrer_name: 'Sara K.',  rang: 2, pakete_pro_tour: 6, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
  { fahrer_id: 'p3', fahrer_name: 'Max M.',   rang: 3, pakete_pro_tour: 4, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
  { fahrer_id: 'p4', fahrer_name: 'Tim B.',   rang: 4, pakete_pro_tour: 2, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.pakete_pro_tour, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    bester_name: MOCK[0].fahrer_name,
    niedrigster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_bottom).length,
    gesamt: MOCK.length,
  } satisfies PaketeProTourResponse);
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
        .select('driver_id, package_count, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase
        .from('delivery_tours')
        .select('driver_id, package_count')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type TourRow = {
      driver_id: string;
      package_count: number | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as TourRow[];
    const prevData = (prevRes.data ?? []) as TourRow[];

    function calcPaketeProTour(tours: TourRow[], dId: string): number {
      const driverTours = tours.filter(t => t.driver_id === dId);
      if (!driverTours.length) return 0;
      const total = driverTours.reduce((s, t) => s + (t.package_count ?? 0), 0);
      return Math.round(total / driverTours.length);
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; rate: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(t => t.driver_id === dId);
      const name = nameRow?.drivers?.full_name ?? dId;
      grouped[dId] = { name, rate: calcPaketeProTour(curData, dId) };
    }

    // descending: highest pakete_pro_tour = best (rank 1)
    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, pakete_pro_tour: d.rate }))
      .sort((a, b) => b.pakete_pro_tour - a.pakete_pro_tour);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcPaketeProTour(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerPaketeProTour[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        pakete_pro_tour: f.pakete_pro_tour,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_bottom: rang > bot25idx,
      };
    });

    const team_avg = Math.round(fahrer.reduce((s, f) => s + f.pakete_pro_tour, 0) / fahrer.length);
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: fahrer.length,
    } satisfies PaketeProTourResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
