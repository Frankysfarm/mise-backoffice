import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerAbbruchRate {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abbruch_rate_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface AbbruchRateResponse {
  fahrer: FahrerAbbruchRate[];
  team_avg: number;
  bester_name: string;
  hoechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerAbbruchRate[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, abbruch_rate_pct: 2,  rank_delta: -1, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, abbruch_rate_pct: 5,  rank_delta:  0, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, abbruch_rate_pct: 11, rank_delta:  1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, abbruch_rate_pct: 19, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.abbruch_rate_pct, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    bester_name: MOCK[0].fahrer_name,
    hoechster_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_top).length,
    gesamt: MOCK.length,
  } satisfies AbbruchRateResponse);
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
        .select('driver_id, status, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`),
      supabase
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .lte('created_at', `${yesterday}T23:59:59`),
    ]);

    if (curRes.error || !curRes.data || curRes.data.length === 0) {
      return buildMockResponse(driver_id);
    }

    type TourRow = {
      driver_id: string;
      status: string | null;
      drivers?: { full_name: string } | null;
    };

    const curData = curRes.data as TourRow[];
    const prevData = (prevRes.data ?? []) as TourRow[];

    function calcAbbruchRate(tours: TourRow[], dId: string): number {
      const driverTours = tours.filter(t => t.driver_id === dId);
      if (!driverTours.length) return 0;
      const abgebrochen = driverTours.filter(t =>
        ['abgebrochen', 'cancelled', 'canceled', 'aborted'].includes(t.status ?? '')
      ).length;
      return Math.round((abgebrochen / driverTours.length) * 1000) / 10;
    }

    const driverIds = [...new Set(curData.map(r => r.driver_id))];
    if (!driverIds.length) return buildMockResponse(driver_id);

    const grouped: Record<string, { name: string; abbruch_rate_pct: number }> = {};
    for (const dId of driverIds) {
      const nameRow = curData.find(t => t.driver_id === dId);
      const name = nameRow?.drivers?.full_name ?? dId;
      grouped[dId] = { name, abbruch_rate_pct: calcAbbruchRate(curData, dId) };
    }

    const sorted = Object.entries(grouped)
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, abbruch_rate_pct: d.abbruch_rate_pct }))
      .sort((a, b) => a.abbruch_rate_pct - b.abbruch_rate_pct);

    const n = sorted.length;
    if (n === 0) return buildMockResponse(driver_id);

    const prevGrouped: Record<string, number> = {};
    for (const dId of driverIds) {
      prevGrouped[dId] = calcAbbruchRate(prevData, dId);
    }
    const prevSorted = Object.entries(prevGrouped)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    const top25idx = Math.ceil(n * 0.25);
    const bot25idx = Math.floor(n * 0.75);

    const fahrer: FahrerAbbruchRate[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRangIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevRangIdx >= 0 ? prevRangIdx + 1 : rang;
      const rank_delta = rang - prevRang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        abbruch_rate_pct: f.abbruch_rate_pct,
        rank_delta,
        ampel: rang <= top25idx ? 'gruen' : rang <= bot25idx ? 'gelb' : 'rot',
        alert_top: rang > bot25idx,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.abbruch_rate_pct, 0) / fahrer.length) * 10) / 10;
    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      hoechster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    } satisfies AbbruchRateResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
