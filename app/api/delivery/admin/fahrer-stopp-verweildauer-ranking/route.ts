import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface StopRow {
  employee_id: string;
  employee_name: string;
  departed_at: string;
  delivered_at: string;
}

interface YestRow {
  employee_id: string;
  departed_at: string;
  delivered_at: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_min:  3, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_min:  5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_min:  9, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 18, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_min: 9,
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
        .from('delivery_batch_stops')
        .select('employee_id, employee_name, departed_at, delivered_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('departed_at', 'is', null)
        .not('delivered_at', 'is', null),
      supabase
        .from('delivery_batch_stops')
        .select('employee_id, departed_at, delivered_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('departed_at', 'is', null)
        .not('delivered_at', 'is', null),
    ]);

    const todayRows: StopRow[]  = (todayRes.data as StopRow[]) ?? [];
    const yestRows: YestRow[]   = (yestRes.data as YestRow[])  ?? [];

    if (todayRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Ø Verweildauer je Fahrer (heute): delivered_at – departed_at in Minuten
    const todayMap = new Map<string, { name: string; durations: number[] }>();
    for (const r of todayRows) {
      const dur = (new Date(r.delivered_at).getTime() - new Date(r.departed_at).getTime()) / 60000;
      if (dur < 0 || dur > 120) continue; // sanity filter
      if (!todayMap.has(r.employee_id)) todayMap.set(r.employee_id, { name: r.employee_name ?? r.employee_id, durations: [] });
      todayMap.get(r.employee_id)!.durations.push(dur);
    }

    // Ø Verweildauer je Fahrer (gestern)
    const yestMap = new Map<string, number[]>();
    for (const r of yestRows) {
      const dur = (new Date(r.delivered_at).getTime() - new Date(r.departed_at).getTime()) / 60000;
      if (dur < 0 || dur > 120) continue;
      if (!yestMap.has(r.employee_id)) yestMap.set(r.employee_id, []);
      yestMap.get(r.employee_id)!.push(dur);
    }

    // Build sorted list (rank 1 = shortest avg = best)
    const entries = Array.from(todayMap.entries())
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        avg_min: Math.round(v.durations.reduce((s, d) => s + d, 0) / v.durations.length),
      }))
      .sort((a, b) => a.avg_min - b.avg_min);

    const total = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.avg_min, 0) / total);

    // Build rank list with delta
    const yestAvgMap = new Map<string, number>();
    for (const [id, durs] of yestMap.entries()) {
      yestAvgMap.set(id, Math.round(durs.reduce((s, d) => s + d, 0) / durs.length));
    }

    // Yesterday ranks
    const yestEntries = Array.from(yestAvgMap.entries())
      .map(([id, avg]) => ({ id, avg }))
      .sort((a, b) => a.avg - b.avg);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang = i + 1;
      const yestRank = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0; // negative = improved (moved up)
      return {
        fahrer_id: e.fahrer_id,
        fahrer_name: e.fahrer_name,
        rang,
        avg_min: e.avg_min,
        rank_delta,
        ampel: ampel(rang, total),
        alert_bottom: ampel(rang, total) === 'rot',
      };
    });

    // driver_id filter: return only this driver's entry (+ team_avg)
    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_min: teamAvg, gesamt: total });
    }

    const alerts   = fahrer.filter(f => f.alert_bottom);
    const bester   = fahrer[0];
    const letzter  = fahrer[fahrer.length - 1];

    return NextResponse.json({
      fahrer,
      team_avg_min: teamAvg,
      bester_name: bester?.fahrer_name ?? '',
      letzter_name: letzter?.fahrer_name ?? '',
      alert_count: alerts.length,
      gesamt: total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
