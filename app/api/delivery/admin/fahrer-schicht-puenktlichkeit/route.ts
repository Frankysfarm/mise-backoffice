import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlich_pct: 95, puenktlich: 19, gesamt: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlich_pct: 85, puenktlich: 17, gesamt: 20, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlich_pct: 72, puenktlich: 13, gesamt: 18, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlich_pct: 55, puenktlich:  6, gesamt: 11, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 76.8,
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

function ampelFn(pct: number): string {
  if (pct >= 90) return 'gruen';
  if (pct >= 70) return 'gelb';
  return 'rot';
}

const TOLERANCE_MS = 5 * 60 * 1000; // 5 Minuten Toleranz

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
        .from('driver_shifts')
        .select('driver_id, actual_start, planned_start, mise_drivers(first_name, last_name)')
        .eq('location_id', location_id)
        .gte('planned_start', cur.start)
        .lt('planned_start', cur.end)
        .not('actual_start', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, actual_start, planned_start')
        .eq('location_id', location_id)
        .gte('planned_start', prev.start)
        .lt('planned_start', prev.end)
        .not('actual_start', 'is', null),
    ]);

    const curRows = curRes.data ?? [];
    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    type ShiftRow = {
      driver_id: string;
      actual_start: string;
      planned_start: string;
      mise_drivers?: { first_name: string; last_name: string } | null;
    };

    const driverMap: Record<string, { name: string; puenktlich: number; gesamt: number }> = {};
    for (const r of curRows as ShiftRow[]) {
      if (!driverMap[r.driver_id]) {
        const d = r.mise_drivers;
        const name = d ? `${d.first_name} ${d.last_name[0]}.` : r.driver_id.slice(0, 6);
        driverMap[r.driver_id] = { name, puenktlich: 0, gesamt: 0 };
      }
      driverMap[r.driver_id].gesamt += 1;
      const actual  = new Date(r.actual_start).getTime();
      const planned = new Date(r.planned_start).getTime();
      if (actual <= planned + TOLERANCE_MS) driverMap[r.driver_id].puenktlich += 1;
    }

    const prevMap: Record<string, { puenktlich: number; gesamt: number }> = {};
    for (const r of (prevRes.data ?? []) as ShiftRow[]) {
      if (!prevMap[r.driver_id]) prevMap[r.driver_id] = { puenktlich: 0, gesamt: 0 };
      prevMap[r.driver_id].gesamt += 1;
      const actual  = new Date(r.actual_start).getTime();
      const planned = new Date(r.planned_start).getTime();
      if (actual <= planned + TOLERANCE_MS) prevMap[r.driver_id].puenktlich += 1;
    }

    const rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:      id,
      fahrer_name:    v.name,
      puenktlich:     v.puenktlich,
      gesamt:         v.gesamt,
      puenktlich_pct: v.gesamt > 0 ? Math.round((v.puenktlich / v.gesamt) * 100) : 0,
    }));

    rows.sort((a, b) => b.puenktlich_pct - a.puenktlich_pct);
    const total   = rows.length;
    const teamAvg = rows.reduce((s, r) => s + r.puenktlich_pct, 0) / total;

    const prevRates = Object.entries(prevMap).map(([id, v]) => ({
      fahrer_id:      id,
      puenktlich_pct: v.gesamt > 0 ? Math.round((v.puenktlich / v.gesamt) * 100) : 0,
    }));
    prevRates.sort((a, b) => b.puenktlich_pct - a.puenktlich_pct);
    const prevRankMap: Record<string, number> = {};
    prevRates.forEach((r, i) => { prevRankMap[r.fahrer_id] = i + 1; });

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const prevRang   = prevRankMap[r.fahrer_id] ?? rang;
      const rank_delta = prevRang - rang;
      return {
        fahrer_id:      r.fahrer_id,
        fahrer_name:    r.fahrer_name,
        rang,
        puenktlich_pct: r.puenktlich_pct,
        puenktlich:     r.puenktlich,
        gesamt:         r.gesamt,
        rank_delta,
        ampel:          ampelFn(r.puenktlich_pct),
        alert_bottom:   r.puenktlich_pct < 70,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_pct:     Math.round(teamAvg * 10) / 10,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
