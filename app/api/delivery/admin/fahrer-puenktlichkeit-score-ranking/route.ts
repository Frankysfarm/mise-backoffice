import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pct_on_time: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 1, pct_on_time: 94, rank_delta:  1, ampel: 'rot',  alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, pct_on_time: 82, rank_delta:  0, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 3, pct_on_time: 71, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, pct_on_time: 58, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg: 76.25,
  beste_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(val: number): 'gruen' | 'gelb' | 'rot' {
  if (val >= 90) return 'rot';
  if (val >= 70) return 'gelb';
  return 'gruen';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, driver_name, delivered_at, promised_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, total_revenue, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    if (curRes.error || !curRes.data?.length) return NextResponse.json(MOCK_DATA);

    // Group by driver
    const driverMap: Record<string, { name: string; total: number; on_time: number }> = {};
    for (const row of curRes.data) {
      if (!row.driver_id) continue;
      if (!driverMap[row.driver_id]) {
        driverMap[row.driver_id] = { name: row.driver_name ?? row.driver_id, total: 0, on_time: 0 };
      }
      driverMap[row.driver_id].total += 1;
      if (row.delivered_at && row.promised_at && row.delivered_at <= row.promised_at) {
        driverMap[row.driver_id].on_time += 1;
      }
    }

    // Prev period for rank_delta
    const prevMap: Record<string, number> = {};
    for (const row of prevRes.data ?? []) {
      if (!row.driver_id) continue;
      prevMap[row.driver_id] = (prevMap[row.driver_id] ?? 0) + 1;
    }

    const sorted = Object.entries(driverMap)
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        pct_on_time: d.total > 0 ? Math.round((d.on_time / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.pct_on_time - a.pct_on_time);

    const prevSorted = [...sorted].sort((a, b) => (prevMap[b.fahrer_id] ?? 0) - (prevMap[a.fahrer_id] ?? 0));
    const prevRankMap: Record<string, number> = {};
    prevSorted.forEach((f, i) => { prevRankMap[f.fahrer_id] = i + 1; });

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap[f.fahrer_id] ?? rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        pct_on_time: f.pct_on_time,
        rank_delta: prevRang - rang,
        ampel: ampelVon(f.pct_on_time),
        alert_hoch: f.pct_on_time >= 90,
      };
    });

    const teamSum = fahrer.reduce((s, f) => s + f.pct_on_time, 0);
    const team_avg = fahrer.length > 0 ? Math.round(teamSum / fahrer.length) : 0;

    return NextResponse.json({
      fahrer,
      team_avg,
      beste_name: fahrer[0]?.fahrer_name ?? '',
      schlechteste_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: fahrer.length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
