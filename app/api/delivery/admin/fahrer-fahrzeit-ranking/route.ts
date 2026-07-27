import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, fahrzeit_min: 14, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, fahrzeit_min: 18, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, fahrzeit_min: 24, rank_delta: -1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, fahrzeit_min: 32, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg: 22,
  schnellster_name: 'Sara K.',
  langsamster_name: 'Tim B.',
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

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = await createClient();

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [todayRes, yestRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at, drivers(full_name)')
        .eq('location_id', location_id)
        .gte('started_at', today.start)
        .lt('started_at', today.end)
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at')
        .eq('location_id', location_id)
        .gte('started_at', yesterday.start)
        .lt('started_at', yesterday.end)
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null),
    ]);

    const todayTours = todayRes.data ?? [];
    const yestTours  = yestRes.data  ?? [];

    if (todayTours.length === 0) return NextResponse.json(MOCK_DATA);

    // Yesterday avg fahrzeit per driver
    const yestMap: Record<string, number> = {};
    const yestAcc: Record<string, { sum: number; cnt: number }> = {};
    for (const t of yestTours) {
      const mins = (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 60000;
      if (mins <= 0 || mins > 480) continue;
      if (!yestAcc[t.driver_id]) yestAcc[t.driver_id] = { sum: 0, cnt: 0 };
      yestAcc[t.driver_id].sum += mins;
      yestAcc[t.driver_id].cnt += 1;
    }
    for (const [id, v] of Object.entries(yestAcc)) yestMap[id] = v.sum / v.cnt;

    // Today avg fahrzeit per driver
    const acc: Record<string, { name: string; sum: number; cnt: number }> = {};
    for (const t of todayTours) {
      const mins = (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 60000;
      if (mins <= 0 || mins > 480) continue;
      const driversRaw = t.drivers as unknown as { full_name: string } | null;
      const name = driversRaw?.full_name ?? (t.driver_id as string);
      if (!acc[t.driver_id]) acc[t.driver_id] = { name, sum: 0, cnt: 0 };
      acc[t.driver_id].sum += mins;
      acc[t.driver_id].cnt += 1;
    }

    const rows = Object.entries(acc).map(([id, v]) => ({
      fahrer_id:    id,
      fahrer_name:  v.name,
      fahrzeit_min: Math.round(v.sum / v.cnt),
    }));

    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    rows.sort((a, b) => a.fahrzeit_min - b.fahrzeit_min);
    const total    = rows.length;
    const team_avg = Math.round(rows.reduce((s, r) => s + r.fahrzeit_min, 0) / total);

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const rank_delta = yestMap[r.fahrer_id] != null ? Math.round(r.fahrzeit_min - yestMap[r.fahrer_id]) : 0;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        fahrzeit_min: r.fahrzeit_min,
        rank_delta,
        ampel:        amp,
        alert_langsam: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg,
      schnellster_name: fahrer[0]?.fahrer_name ?? '—',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_langsam).length,
      gesamt: total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
