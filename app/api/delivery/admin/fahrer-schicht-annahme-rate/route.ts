import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 97, accepted: 29, offered: 30, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate_pct: 88, accepted: 22, offered: 25, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate_pct: 75, accepted: 15, offered: 20, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 58, accepted:  7, offered: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 79.5,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
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

function ampelFn(rate: number): string {
  if (rate >= 90) return 'gruen';
  if (rate >= 70) return 'gelb';
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

    // Fetch shifts from current and previous 30-day window where planned_end has passed
    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, status, mise_drivers(first_name, last_name)')
        .eq('location_id', location_id)
        .gte('planned_end', cur.start)
        .lt('planned_end', cur.end)
        .in('status', ['completed', 'missed']),
      supabase
        .from('driver_shifts')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .gte('planned_end', prev.start)
        .lt('planned_end', prev.end)
        .in('status', ['completed', 'missed']),
    ]);

    const curRows = curRes.data ?? [];
    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Aggregate per driver
    const driverMap: Record<string, { name: string; accepted: number; offered: number }> = {};
    for (const r of curRows as { driver_id: string; status: string; mise_drivers?: { first_name: string; last_name: string } | null }[]) {
      if (!driverMap[r.driver_id]) {
        const d = r.mise_drivers;
        const name = d ? `${d.first_name} ${d.last_name[0]}.` : r.driver_id.slice(0, 6);
        driverMap[r.driver_id] = { name, accepted: 0, offered: 0 };
      }
      driverMap[r.driver_id].offered += 1;
      if (r.status === 'completed') driverMap[r.driver_id].accepted += 1;
    }

    // Aggregate previous window for rank delta
    const prevMap: Record<string, { accepted: number; offered: number }> = {};
    for (const r of (prevRes.data ?? []) as { driver_id: string; status: string }[]) {
      if (!prevMap[r.driver_id]) prevMap[r.driver_id] = { accepted: 0, offered: 0 };
      prevMap[r.driver_id].offered += 1;
      if (r.status === 'completed') prevMap[r.driver_id].accepted += 1;
    }

    const rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      accepted:    v.accepted,
      offered:     v.offered,
      rate_pct:    v.offered > 0 ? Math.round((v.accepted / v.offered) * 100) : 0,
    }));

    // Rank: highest rate = best
    rows.sort((a, b) => b.rate_pct - a.rate_pct);
    const total   = rows.length;
    const teamAvg = rows.reduce((s, r) => s + r.rate_pct, 0) / total;

    // Previous rates for rank delta
    const prevRates = Object.entries(prevMap).map(([id, v]) => ({
      fahrer_id: id,
      rate_pct:  v.offered > 0 ? Math.round((v.accepted / v.offered) * 100) : 0,
    }));
    prevRates.sort((a, b) => b.rate_pct - a.rate_pct);
    const prevRankMap: Record<string, number> = {};
    prevRates.forEach((r, i) => { prevRankMap[r.fahrer_id] = i + 1; });

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const prevRang   = prevRankMap[r.fahrer_id] ?? rang;
      const rank_delta = prevRang - rang; // positive = improved
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        rate_pct:     r.rate_pct,
        accepted:     r.accepted,
        offered:      r.offered,
        rank_delta,
        ampel:        ampelFn(r.rate_pct),
        alert_bottom: r.rate_pct < 70,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_pct:    Math.round(teamAvg * 10) / 10,
      bester_name:     fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:     fahrer.filter(f => f.alert_bottom).length,
      gesamt:          total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
