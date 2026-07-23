import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate: 8.4, touren: 42, schichten: 5, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate: 7.1, touren: 35, schichten: 5, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate: 5.8, touren: 29, schichten: 5, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate: 3.9, touren: 19, schichten: 5, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_rate: 6.3,
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

function ampelFn(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
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

    const [toursRes, shiftsRes, prevToursRes, prevShiftsRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', cur.start)
        .lt('departed_at', cur.end),
      supabase
        .from('driver_shifts')
        .select('driver_id, mise_drivers(first_name, last_name)')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('planned_end', cur.start)
        .lt('planned_end', cur.end),
      supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('departed_at', prev.start)
        .lt('departed_at', prev.end),
      supabase
        .from('driver_shifts')
        .select('driver_id')
        .eq('location_id', location_id)
        .eq('status', 'completed')
        .gte('planned_end', prev.start)
        .lt('planned_end', prev.end),
    ]);

    const tourRows  = (toursRes.data  ?? []) as { driver_id: string; driver_name?: string }[];
    const shiftRows = (shiftsRes.data ?? []) as { driver_id: string; mise_drivers?: { first_name: string; last_name: string } | null }[];

    if (tourRows.length === 0 && shiftRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Build name map from shifts (more complete)
    const nameMap: Record<string, string> = {};
    for (const s of shiftRows) {
      if (!nameMap[s.driver_id]) {
        const d = s.mise_drivers;
        nameMap[s.driver_id] = d ? `${d.first_name} ${d.last_name[0]}.` : s.driver_id.slice(0, 6);
      }
    }
    for (const t of tourRows) {
      if (!nameMap[t.driver_id] && t.driver_name) nameMap[t.driver_id] = t.driver_name;
    }

    // Count tours and shifts per driver (current period)
    const tourenMap: Record<string, number> = {};
    for (const t of tourRows) tourenMap[t.driver_id] = (tourenMap[t.driver_id] ?? 0) + 1;

    const schichtenMap: Record<string, number> = {};
    for (const s of shiftRows) schichtenMap[s.driver_id] = (schichtenMap[s.driver_id] ?? 0) + 1;

    // Combine all known drivers
    const allDriverIds = new Set([...Object.keys(tourenMap), ...Object.keys(schichtenMap)]);
    const rows = Array.from(allDriverIds).map(id => {
      const touren   = tourenMap[id] ?? 0;
      const schichten = schichtenMap[id] ?? 1;
      return {
        fahrer_id:   id,
        fahrer_name: nameMap[id] ?? id.slice(0, 6),
        touren,
        schichten,
        rate: Math.round((touren / schichten) * 10) / 10,
      };
    });

    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    // Sort descending: rank 1 = highest rate = best
    rows.sort((a, b) => b.rate - a.rate);
    const total   = rows.length;
    const teamAvg = Math.round(rows.reduce((s, r) => s + r.rate, 0) / total * 10) / 10;

    // Previous period rates for rank delta
    const prevTourMap: Record<string, number>   = {};
    for (const t of (prevToursRes.data ?? []) as { driver_id: string }[]) prevTourMap[t.driver_id] = (prevTourMap[t.driver_id] ?? 0) + 1;

    const prevShiftMap: Record<string, number>  = {};
    for (const s of (prevShiftsRes.data ?? []) as { driver_id: string }[]) prevShiftMap[s.driver_id] = (prevShiftMap[s.driver_id] ?? 0) + 1;

    const prevRows = Array.from(new Set([...Object.keys(prevTourMap), ...Object.keys(prevShiftMap)])).map(id => ({
      fahrer_id: id,
      rate: Math.round(((prevTourMap[id] ?? 0) / (prevShiftMap[id] ?? 1)) * 10) / 10,
    }));
    prevRows.sort((a, b) => b.rate - a.rate);
    const prevRankMap: Record<string, number> = {};
    prevRows.forEach((r, i) => { prevRankMap[r.fahrer_id] = i + 1; });

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const prevRang   = prevRankMap[r.fahrer_id] ?? rang;
      const rank_delta = prevRang - rang; // positive = improved (moved up)
      const ampel      = ampelFn(rang, total);
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        rate:         r.rate,
        touren:       r.touren,
        schichten:    r.schichten,
        rank_delta,
        ampel,
        alert_bottom: ampel === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_rate:    teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
