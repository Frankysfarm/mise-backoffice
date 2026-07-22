import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow { driver_id: string; assigned_at: string; departed_at: string; }

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sek: 45,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sek: 62,  rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sek: 90,  rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sek: 148, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sek: 86,
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
        .from('delivery_tours')
        .select('driver_id, driver_name, assigned_at, departed_at')
        .eq('location_id', location_id)
        .gte('assigned_at', today.start)
        .lt('assigned_at', today.end)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, assigned_at, departed_at')
        .eq('location_id', location_id)
        .gte('assigned_at', yesterday.start)
        .lt('assigned_at', yesterday.end)
        .not('departed_at', 'is', null),
    ]);

    const tours: { driver_id: string; driver_name: string; assigned_at: string; departed_at: string }[] =
      todayRes.data ?? [];

    // Compute yesterday avg reaction time per driver
    const yestMap: Record<string, number> = {};
    const yestAcc: Record<string, { sum: number; count: number }> = {};
    for (const y of (yestRes.data ?? []) as TourRow[]) {
      const sek = (new Date(y.departed_at).getTime() - new Date(y.assigned_at).getTime()) / 1000;
      if (sek < 0 || sek > 3600) continue;
      if (!yestAcc[y.driver_id]) yestAcc[y.driver_id] = { sum: 0, count: 0 };
      yestAcc[y.driver_id].sum   += sek;
      yestAcc[y.driver_id].count += 1;
    }
    for (const [id, v] of Object.entries(yestAcc)) {
      yestMap[id] = Math.round(v.sum / v.count);
    }

    // Compute per-driver avg reaction time (assigned_at → departed_at) in seconds
    const driverMap: Record<string, { name: string; sums: number; count: number }> = {};
    for (const t of tours) {
      const sek = (new Date(t.departed_at).getTime() - new Date(t.assigned_at).getTime()) / 1000;
      if (sek < 0 || sek > 3600) continue; // sanity filter
      if (!driverMap[t.driver_id]) driverMap[t.driver_id] = { name: t.driver_name, sums: 0, count: 0 };
      driverMap[t.driver_id].sums  += sek;
      driverMap[t.driver_id].count += 1;
    }

    let rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      avg_sek:     Math.round(v.sums / v.count),
    }));

    if (driver_id) rows = rows.filter(r => r.fahrer_id === driver_id);
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    // Rank: lower avg_sek = better rank
    rows.sort((a, b) => a.avg_sek - b.avg_sek);
    const total = rows.length;
    const teamAvgSek = Math.round(rows.reduce((s, r) => s + r.avg_sek, 0) / total);

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestAvg    = yestMap[r.fahrer_id];
      // rank_delta: negative = improved (smaller value = better)
      const rank_delta = yestAvg != null ? Math.round(r.avg_sek - yestAvg) : 0;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        avg_sek:      r.avg_sek,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_sek: teamAvgSek,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
