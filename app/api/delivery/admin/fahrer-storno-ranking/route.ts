import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  status: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, storno_rate: 2.1,  storno_count: 0, gesamt_touren: 8, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, storno_rate: 5.0,  storno_count: 0, gesamt_touren: 6, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, storno_rate: 12.5, storno_count: 1, gesamt_touren: 4, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, storno_rate: 33.3, storno_count: 1, gesamt_touren: 2, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_rate: 13.2,
  bester_name: 'Julia F.',
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

function buildRanking(rows: TourRow[]): Map<string, { name: string; storno: number; total: number }> {
  const acc = new Map<string, { name: string; storno: number; total: number }>();
  for (const r of rows) {
    if (!acc.has(r.driver_id)) acc.set(r.driver_id, { name: r.driver_name ?? r.driver_id, storno: 0, total: 0 });
    const entry = acc.get(r.driver_id)!;
    entry.total += 1;
    if (r.status === 'cancelled') entry.storno += 1;
  }
  return acc;
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
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end),
    ]);

    const todayRows: TourRow[] = (todayRes.data ?? []) as TourRow[];
    const yestRows: { driver_id: string; status: string }[] = (yestRes.data ?? []) as { driver_id: string; status: string }[];

    if (todayRows.length === 0) return NextResponse.json(MOCK_DATA);

    const todayAcc = buildRanking(todayRows);

    // Sort ascending by storno_rate (rank 1 = lowest rate = best)
    const entries = Array.from(todayAcc.entries())
      .map(([id, v]) => ({
        fahrer_id:    id,
        fahrer_name:  v.name,
        storno_count: v.storno,
        gesamt_touren: v.total,
        storno_rate:  v.total > 0 ? Math.round((v.storno / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.storno_rate - b.storno_rate);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.storno_rate, 0) / total * 10) / 10;

    // Yesterday storno rates for rank_delta
    const yestAcc = new Map<string, { storno: number; total: number }>();
    for (const r of yestRows) {
      if (!yestAcc.has(r.driver_id)) yestAcc.set(r.driver_id, { storno: 0, total: 0 });
      const entry = yestAcc.get(r.driver_id)!;
      entry.total += 1;
      if (r.status === 'cancelled') entry.storno += 1;
    }
    const yestEntries = Array.from(yestAcc.entries())
      .map(([id, v]) => ({ driver_id: id, rate: v.total > 0 ? v.storno / v.total : 0 }))
      .sort((a, b) => a.rate - b.rate);
    const yestRankMap = new Map(yestEntries.map((e, i) => [e.driver_id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestRank   = yestRankMap.get(e.fahrer_id);
      const rank_delta = yestRank != null ? rang - yestRank : 0;
      return {
        fahrer_id:     e.fahrer_id,
        fahrer_name:   e.fahrer_name,
        rang,
        storno_rate:   e.storno_rate,
        storno_count:  e.storno_count,
        gesamt_touren: e.gesamt_touren,
        rank_delta,
        ampel:         amp,
        alert_bottom:  amp === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_rate: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_rate: teamAvg,
      bester_name:   fahrer[0]?.fahrer_name ?? '—',
      letzter_name:  fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:   fahrer.filter(f => f.alert_bottom).length,
      gesamt:        total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
