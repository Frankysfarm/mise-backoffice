import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface StopRow {
  employee_id: string;
  employee_name: string;
  arrived_at: string;
  departed_at: string;
}

interface YestRow {
  employee_id: string;
  arrived_at: string;
  departed_at: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sec:  45, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sec:  72, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sec: 120, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sec: 195, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sec: 108,
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
        .select('employee_id, employee_name, arrived_at, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('arrived_at', 'is', null)
        .not('departed_at', 'is', null),
      supabase
        .from('delivery_batch_stops')
        .select('employee_id, arrived_at, departed_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('arrived_at', 'is', null)
        .not('departed_at', 'is', null),
    ]);

    const todayRows: StopRow[] = (todayRes.data as StopRow[]) ?? [];
    const yestRows: YestRow[]  = (yestRes.data as YestRow[])  ?? [];

    if (todayRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Ø Stoppdauer je Fahrer (heute): departed_at – arrived_at in Sekunden
    const todayMap = new Map<string, { name: string; durations: number[] }>();
    for (const r of todayRows) {
      const dur = (new Date(r.departed_at).getTime() - new Date(r.arrived_at).getTime()) / 1000;
      if (dur < 0 || dur > 7200) continue; // sanity: max 2h
      if (!todayMap.has(r.employee_id)) todayMap.set(r.employee_id, { name: r.employee_name ?? r.employee_id, durations: [] });
      todayMap.get(r.employee_id)!.durations.push(dur);
    }

    // Ø Stoppdauer je Fahrer (gestern)
    const yestMap = new Map<string, number[]>();
    for (const r of yestRows) {
      const dur = (new Date(r.departed_at).getTime() - new Date(r.arrived_at).getTime()) / 1000;
      if (dur < 0 || dur > 7200) continue;
      if (!yestMap.has(r.employee_id)) yestMap.set(r.employee_id, []);
      yestMap.get(r.employee_id)!.push(dur);
    }

    // Sort ascending: rank 1 = shortest stop = best
    const entries = Array.from(todayMap.entries())
      .map(([id, v]) => ({
        fahrer_id:   id,
        fahrer_name: v.name,
        avg_sec:     Math.round(v.durations.reduce((s, d) => s + d, 0) / v.durations.length),
      }))
      .sort((a, b) => a.avg_sec - b.avg_sec);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.avg_sec, 0) / total);

    const yestAvgMap = new Map<string, number>();
    for (const [id, durs] of yestMap.entries()) {
      yestAvgMap.set(id, Math.round(durs.reduce((s, d) => s + d, 0) / durs.length));
    }
    const yestEntries = Array.from(yestAvgMap.entries())
      .map(([id, avg]) => ({ id, avg }))
      .sort((a, b) => a.avg - b.avg);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0;
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        avg_sec:      e.avg_sec,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_sec: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_sec:  teamAvg,
      bester_name:   fahrer[0]?.fahrer_name ?? '—',
      letzter_name:  fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:   fahrer.filter(f => f.alert_bottom).length,
      gesamt:        total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
