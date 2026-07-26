import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourRow { driver_id: string; driver_name: string; assigned_at: string; picked_up_at: string | null; departed_at: string | null; }

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 4,  rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 6,  rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 9,  rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 14, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 8,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_min: 5,
};

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_min: number;
}

function ampelColor(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK);

  const supabase = await createClient();

  try {
    const since30 = thirtyDaysAgo();
    const sinceYest = yesterday();

    const [res30, resYest] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, assigned_at, picked_up_at, departed_at')
        .eq('location_id', location_id)
        .gte('created_at', since30),
      supabase
        .from('delivery_tours')
        .select('driver_id, assigned_at, picked_up_at, departed_at')
        .eq('location_id', location_id)
        .gte('created_at', sinceYest),
    ]);

    const tours: TourRow[] = res30.data ?? [];
    if (tours.length === 0) return NextResponse.json(MOCK);

    // Compute yesterday avg per driver for rank_delta
    const yestMap: Record<string, number> = {};
    const yestAcc: Record<string, { sum: number; count: number }> = {};
    for (const t of (resYest.data ?? []) as TourRow[]) {
      const endAt = t.picked_up_at ?? t.departed_at;
      if (!endAt || !t.assigned_at) continue;
      const min = (new Date(endAt).getTime() - new Date(t.assigned_at).getTime()) / 60000;
      if (min < 0 || min > 120) continue;
      if (!yestAcc[t.driver_id]) yestAcc[t.driver_id] = { sum: 0, count: 0 };
      yestAcc[t.driver_id].sum += min;
      yestAcc[t.driver_id].count += 1;
    }
    for (const [id, v] of Object.entries(yestAcc)) {
      yestMap[id] = v.sum / v.count;
    }

    // Compute 30-day avg per driver
    const driverAcc: Record<string, { name: string; sum: number; count: number }> = {};
    for (const t of tours) {
      const endAt = t.picked_up_at ?? t.departed_at;
      if (!endAt || !t.assigned_at) continue;
      const min = (new Date(endAt).getTime() - new Date(t.assigned_at).getTime()) / 60000;
      if (min < 0 || min > 120) continue;
      if (!driverAcc[t.driver_id]) driverAcc[t.driver_id] = { name: t.driver_name, sum: 0, count: 0 };
      driverAcc[t.driver_id].sum += min;
      driverAcc[t.driver_id].count += 1;
    }

    const rows = Object.entries(driverAcc).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name,
      avg_min_raw: v.sum / v.count,
    }));

    if (rows.length === 0) return NextResponse.json(MOCK);

    // Rank ascending: lower time = better
    rows.sort((a, b) => a.avg_min_raw - b.avg_min_raw);
    const total = rows.length;
    const teamAvgMin = Math.round(rows.reduce((s, r) => s + r.avg_min_raw, 0) / total);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang = i + 1;
      const amp = ampelColor(rang, total);
      const yest = yestMap[r.fahrer_id];
      const rank_delta = yest != null ? Math.round(r.avg_min_raw - yest) : 0;
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        avg_min: Math.round(r.avg_min_raw),
        rank_delta,
        ampel: amp,
        alert_hoch: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_min: teamAvgMin,
      schnellster_name: fahrer[0]?.fahrer_name ?? '—',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
      ziel_min: 5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
