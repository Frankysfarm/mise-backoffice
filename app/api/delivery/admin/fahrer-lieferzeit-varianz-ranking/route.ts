import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stddev_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stddev: number;
  konsistenteste_name: string;
  inkonsistenteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stddev_min: 4.2,  rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, stddev_min: 6.8,  rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, stddev_min: 11.3, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stddev_min: 18.1, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_stddev: 10.1,
  konsistenteste_name: 'Julia F.',
  inkonsistenteste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('deliveries')
        .select('driver_id, driver_name, delivery_time_min')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start)
        .not('delivery_time_min', 'is', null),
      supabase
        .from('deliveries')
        .select('driver_id, delivery_time_min')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('delivery_time_min', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; times: number[] }>();
    for (const d of curData) {
      if (!d.driver_id || typeof d.delivery_time_min !== 'number' || d.delivery_time_min <= 0) continue;
      const prev = groupCur.get(d.driver_id) ?? { name: d.driver_name ?? d.driver_id, times: [] };
      prev.times.push(d.delivery_time_min);
      groupCur.set(d.driver_id, prev);
    }

    // need at least 2 deliveries to compute stddev
    const unsorted = Array.from(groupCur.entries())
      .filter(([, v]) => v.times.length >= 2)
      .map(([id, v]) => ({
        fahrer_id:  id,
        fahrer_name: v.name || id.slice(0, 8),
        stddev_min: Math.round(stddev(v.times) * 10) / 10,
      }));

    if (!unsorted.length) return NextResponse.json(MOCK_DATA);

    // INVERTED: aufsteigend — niedrigste Varianz = bester = Rang 1
    const sorted = [...unsorted].sort((a, b) => a.stddev_min - b.stddev_min);
    const total  = sorted.length;

    const groupPrev = new Map<string, number[]>();
    for (const d of prevRes.data ?? []) {
      if (!d.driver_id || typeof d.delivery_time_min !== 'number' || d.delivery_time_min <= 0) continue;
      const arr = groupPrev.get(d.driver_id) ?? [];
      arr.push(d.delivery_time_min);
      groupPrev.set(d.driver_id, arr);
    }

    const prevSorted = [...unsorted].map(f => {
      const times = groupPrev.get(f.fahrer_id) ?? [];
      const pSigma = times.length >= 2 ? stddev(times) : f.stddev_min;
      return { fahrer_id: f.fahrer_id, stddev_min: pSigma };
    }).sort((a, b) => a.stddev_min - b.stddev_min);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:   f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        stddev_min:  f.stddev_min,
        rank_delta:  prevRang - rang,
        ampel:       ampelVon(rang, total),
        alert_hoch:  f.stddev_min > 15,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.stddev_min, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_stddev:      teamAvg,
      konsistenteste_name:  sorted[0]?.fahrer_name ?? '',
      inkonsistenteste_name: sorted[total - 1]?.fahrer_name ?? '',
      alert_count:          fahrer.filter(f => f.alert_hoch).length,
      gesamt:               total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
