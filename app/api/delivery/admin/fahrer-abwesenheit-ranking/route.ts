import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, tage: 0, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, tage: 1, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, tage: 3, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, tage: 5, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_tage: 2.25,
  zuverlaessigster_name: 'Max M.',
  hoechste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function last30DaysRange() {
  const end   = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function prev30DaysRange() {
  const end   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function ampelFn(tage: number): string {
  if (tage <= 1) return 'gruen';
  if (tage <= 3) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const cur  = last30DaysRange();
    const prev = prev30DaysRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('driver_absences')
        .select('driver_id, driver_name, absence_date')
        .eq('location_id', location_id)
        .gte('absence_date', cur.start)
        .lt('absence_date', cur.end),
      supabase
        .from('driver_absences')
        .select('driver_id, absence_date')
        .eq('location_id', location_id)
        .gte('absence_date', prev.start)
        .lt('absence_date', prev.end),
    ]);

    const curRows: { driver_id: string; driver_name: string }[] = curRes.data ?? [];
    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Count days per driver current period
    const driverMap: Record<string, { name: string; tage: number }> = {};
    for (const r of curRows) {
      if (!driverMap[r.driver_id]) driverMap[r.driver_id] = { name: r.driver_name, tage: 0 };
      driverMap[r.driver_id].tage += 1;
    }

    // Count days per driver previous period
    const prevMap: Record<string, number> = {};
    for (const r of (prevRes.data ?? []) as { driver_id: string }[]) {
      prevMap[r.driver_id] = (prevMap[r.driver_id] ?? 0) + 1;
    }

    let rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      tage:        v.tage,
    }));

    // Rank: fewer absences = better rank
    rows.sort((a, b) => a.tage - b.tage);
    const total = rows.length;
    const teamAvg = rows.reduce((s, r) => s + r.tage, 0) / total;

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampelFn(r.tage);
      const prevTage   = prevMap[r.fahrer_id] ?? r.tage;
      const rank_delta = r.tage - prevTage;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        tage:         r.tage,
        rank_delta,
        ampel:        amp,
        alert_bottom: r.tage >= 4,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_tage:        Math.round(teamAvg * 10) / 10,
      zuverlaessigster_name: fahrer[0]?.fahrer_name ?? '—',
      hoechste_name:        fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:          fahrer.filter(f => f.alert_bottom).length,
      gesamt:               total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
