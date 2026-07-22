import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface StopRow {
  driver_id: string;
  driver_name: string;
  departed_at: string;
  delivered_at: string;
}

interface YestRow {
  driver_id: string;
  departed_at: string;
  delivered_at: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_min: 12, rank_delta:  -2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_min: 15, rank_delta:   0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_min: 22, rank_delta:   3, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 35, rank_delta:   0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_min: 21,
  bester_name: 'Max M.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: start.toISOString(), end: end.toISOString() };
}

function ampel(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [todayRes, yestRes] = await Promise.all([
      supabase
        .from('batch_stops')
        .select('driver_id, driver_name, departed_at, delivered_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null)
        .not('delivered_at', 'is', null),
      supabase
        .from('batch_stops')
        .select('driver_id, departed_at, delivered_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null)
        .not('delivered_at', 'is', null),
    ]);

    const todayStops: StopRow[] = (todayRes.data ?? []) as StopRow[];
    const yestStops: YestRow[]  = (yestRes.data  ?? []) as YestRow[];

    // Compute yesterday avg delivery minutes per driver
    const yestAcc: Record<string, { sum: number; count: number }> = {};
    for (const s of yestStops) {
      const mins = (new Date(s.delivered_at).getTime() - new Date(s.departed_at).getTime()) / 60000;
      if (mins < 0 || mins > 240) continue;
      if (!yestAcc[s.driver_id]) yestAcc[s.driver_id] = { sum: 0, count: 0 };
      yestAcc[s.driver_id].sum   += mins;
      yestAcc[s.driver_id].count += 1;
    }
    const yestMap: Record<string, number> = {};
    for (const [id, v] of Object.entries(yestAcc)) {
      yestMap[id] = v.sum / v.count;
    }

    // Compute per-driver avg delivery time (departed_at → delivered_at) in minutes
    const driverMap: Record<string, { name: string; sum: number; count: number }> = {};
    for (const s of todayStops) {
      const mins = (new Date(s.delivered_at).getTime() - new Date(s.departed_at).getTime()) / 60000;
      if (mins < 0 || mins > 240) continue;
      if (!driverMap[s.driver_id]) driverMap[s.driver_id] = { name: s.driver_name, sum: 0, count: 0 };
      driverMap[s.driver_id].sum   += mins;
      driverMap[s.driver_id].count += 1;
    }

    let rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      avg_min:     Math.round(v.sum / v.count),
    }));

    if (driver_id) rows = rows.filter(r => r.fahrer_id === driver_id);
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    // Rank: lower avg_min = better rank (Rang 1 = schnellster)
    rows.sort((a, b) => a.avg_min - b.avg_min);
    const total      = rows.length;
    const teamAvgMin = Math.round(rows.reduce((s, r) => s + r.avg_min, 0) / total);

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestAvg    = yestMap[r.fahrer_id];
      // rank_delta: negative = faster today = improved
      const rank_delta = yestAvg != null ? Math.round(r.avg_min - yestAvg) : 0;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        avg_min:      r.avg_min,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_min: teamAvgMin,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
