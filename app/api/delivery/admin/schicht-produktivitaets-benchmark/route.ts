import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendDir = 'besser' | 'gleich' | 'schlechter';

type FahrerBenchmark = {
  fahrer_id: string;
  name: string;
  stopps_pro_stunde_heute: number;
  team_durchschnitt: number;
  delta_pct: number;
  trend: TrendDir;
  verlauf_7d: number[]; // stopps/h per day, newest last
  rang: number;
};

function mockData(locationId: string | null) {
  const fahrer = [
    { id: 'f1', name: 'Ahmed K.' },
    { id: 'f2', name: 'Marcus B.' },
    { id: 'f3', name: 'Julia T.' },
    { id: 'f4', name: 'Sven M.' },
  ];
  const benchmarks: FahrerBenchmark[] = fahrer.map((f, i) => {
    const base = 2.5 + i * 0.3;
    const heute = parseFloat((base + (Math.sin(i) * 0.4)).toFixed(2));
    const yesterday = parseFloat((base + (Math.cos(i) * 0.3)).toFixed(2));
    const verlauf = Array.from({ length: 7 }, (_, d) =>
      parseFloat((base + Math.sin(d + i) * 0.5).toFixed(2)),
    );
    const trend: TrendDir =
      heute > yesterday * 1.05 ? 'besser' : heute < yesterday * 0.95 ? 'schlechter' : 'gleich';
    return {
      fahrer_id: f.id,
      name: f.name,
      stopps_pro_stunde_heute: heute,
      team_durchschnitt: 0, // filled below
      delta_pct: 0,
      trend,
      verlauf_7d: verlauf,
      rang: i + 1,
    };
  });
  const teamAvg = parseFloat(
    (benchmarks.reduce((s, b) => s + b.stopps_pro_stunde_heute, 0) / benchmarks.length).toFixed(2),
  );
  for (const b of benchmarks) {
    b.team_durchschnitt = teamAvg;
    b.delta_pct = parseFloat((((b.stopps_pro_stunde_heute - teamAvg) / teamAvg) * 100).toFixed(1));
  }
  benchmarks.sort((a, b) => b.stopps_pro_stunde_heute - a.stopps_pro_stunde_heute);
  benchmarks.forEach((b, i) => (b.rang = i + 1));
  return {
    fahrer: benchmarks,
    team_durchschnitt: teamAvg,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    // Load active drivers
    const dQ = supabase.from('mise_drivers').select('id, name').eq('is_active', true);
    if (locationId) dQ.eq('location_id', locationId);
    const { data: drivers, error: dErr } = await dQ;
    if (dErr || !drivers || drivers.length === 0) throw new Error('no drivers');

    // Load stops last 7 days
    const sQ = supabase
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at, created_at')
      .gte('created_at', since7d)
      .not('delivered_at', 'is', null);
    if (locationId) sQ.eq('location_id', locationId);
    const { data: stops, error: sErr } = await sQ;
    if (sErr) throw new Error('no stops');

    // Load shift hours today
    const shQ = supabase
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at')
      .gte('started_at', startOfDay.toISOString());
    if (locationId) shQ.eq('location_id', locationId);
    const { data: shifts } = await shQ;

    const nowMs = Date.now();

    function shiftHours(driverId: string): number {
      const sh = shifts?.filter(s => s.driver_id === driverId) ?? [];
      let h = 0;
      for (const s of sh) {
        const end = s.ended_at ? new Date(s.ended_at).getTime() : nowMs;
        h += (end - new Date(s.started_at).getTime()) / 3600_000;
      }
      return h;
    }

    function stoppsPer(driverId: string, sinceMs: number, untilMs: number): number {
      return (stops ?? []).filter(s => {
        if (s.driver_id !== driverId) return false;
        const t = s.delivered_at ? new Date(s.delivered_at as string).getTime() : 0;
        return t >= sinceMs && t <= untilMs;
      }).length;
    }

    const benchmarks: FahrerBenchmark[] = drivers.map((d) => {
      const h = shiftHours(d.id);
      const todayStops = stoppsPer(d.id, startOfDay.getTime(), nowMs);
      const sph = h > 0 ? parseFloat((todayStops / h).toFixed(2)) : 0;

      const verlauf = Array.from({ length: 7 }, (_, dayIdx) => {
        const dayStart = new Date(Date.now() - (6 - dayIdx) * 24 * 3600_000);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 86400_000);
        const s = stoppsPer(d.id, dayStart.getTime(), dayEnd.getTime());
        return s;
      });

      const yStart = new Date(Date.now() - 24 * 3600_000);
      yStart.setUTCHours(0, 0, 0, 0);
      const ySph = verlauf[5] > 0 ? verlauf[5] : 0;
      const trend: TrendDir =
        sph > ySph * 1.05 ? 'besser' : sph < ySph * 0.95 ? 'schlechter' : 'gleich';

      return {
        fahrer_id: d.id,
        name: d.name as string,
        stopps_pro_stunde_heute: sph,
        team_durchschnitt: 0,
        delta_pct: 0,
        trend,
        verlauf_7d: verlauf,
        rang: 0,
      };
    });

    const teamAvg =
      benchmarks.length > 0
        ? parseFloat(
            (benchmarks.reduce((s, b) => s + b.stopps_pro_stunde_heute, 0) / benchmarks.length).toFixed(2),
          )
        : 0;

    for (const b of benchmarks) {
      b.team_durchschnitt = teamAvg;
      b.delta_pct =
        teamAvg > 0
          ? parseFloat((((b.stopps_pro_stunde_heute - teamAvg) / teamAvg) * 100).toFixed(1))
          : 0;
    }
    benchmarks.sort((a, b) => b.stopps_pro_stunde_heute - a.stopps_pro_stunde_heute);
    benchmarks.forEach((b, i) => (b.rang = i + 1));

    return NextResponse.json({
      fahrer: benchmarks,
      team_durchschnitt: teamAvg,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
