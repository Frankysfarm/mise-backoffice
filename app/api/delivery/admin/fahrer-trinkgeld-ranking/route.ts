import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_tip_eur: 3.20, tip_count: 25, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_tip_eur: 2.50, tip_count: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_tip_eur: 1.80, tip_count: 18, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_tip_eur: 0.90, tip_count: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_eur: 2.10,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now   = new Date();
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

  if (!location_id) return NextResponse.json(MOCK);

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [todayRes, yestRes] = await Promise.all([
      sb.from('delivery_batch_stops')
        .select('driver_id, driver_name, tip_amount')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end)
        .not('driver_id', 'is', null),
      sb.from('delivery_batch_stops')
        .select('driver_id, tip_amount')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end)
        .not('driver_id', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as {
      driver_id: string;
      driver_name?: string;
      tip_amount?: number | null;
    }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    // Aggregate tip per driver
    const driverMap = new Map<string, { name: string; total_tip: number; count: number }>();
    for (const t of todayRows) {
      const did = t.driver_id;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, total_tip: 0, count: 0 });
      const entry = driverMap.get(did)!;
      entry.count += 1;
      entry.total_tip += typeof t.tip_amount === 'number' && t.tip_amount > 0 ? t.tip_amount : 0;
    }

    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:    fid,
        fahrer_name:  d.name,
        avg_tip_eur:  d.count > 0 ? Math.round((d.total_tip / d.count) * 100) / 100 : 0,
        tip_count:    d.count,
      }))
      .sort((a, b) => b.avg_tip_eur - a.avg_tip_eur);

    const total   = entries.length;
    const teamAvg = total > 0
      ? Math.round(entries.reduce((s, e) => s + e.avg_tip_eur, 0) / total * 100) / 100
      : 0;

    // Yesterday ranks for delta
    const yestRows = (yestRes.data ?? []) as { driver_id: string; tip_amount?: number | null }[];
    const yMap = new Map<string, { total_tip: number; count: number }>();
    for (const t of yestRows) {
      const did = t.driver_id;
      if (!yMap.has(did)) yMap.set(did, { total_tip: 0, count: 0 });
      const entry = yMap.get(did)!;
      entry.count += 1;
      entry.total_tip += typeof t.tip_amount === 'number' && t.tip_amount > 0 ? t.tip_amount : 0;
    }
    const yEntries = [...yMap.entries()]
      .map(([id, d]) => ({ id, avg: d.count > 0 ? d.total_tip / d.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
    const yRankMap = new Map(yEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yRang      = yRankMap.get(e.fahrer_id);
      const rank_delta = yRang != null ? rang - yRang : 0;
      return { ...e, rang, rank_delta, ampel: amp, alert_bottom: amp === 'rot' };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_eur: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_eur:     teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK);
  }
}
