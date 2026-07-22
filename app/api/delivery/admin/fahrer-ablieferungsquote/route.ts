import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 98.0, delivered: 22, total: 22, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, quote_pct: 95.0, delivered: 19, total: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 87.5, delivered: 14, total: 16, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 75.0, delivered:  9, total: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 88.9,
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
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end)
        .not('driver_id', 'is', null),
      sb.from('delivery_batch_stops')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end)
        .not('driver_id', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as {
      driver_id: string;
      driver_name?: string;
      status?: string | null;
    }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    // Aggregate delivered/total per driver
    const driverMap = new Map<string, { name: string; delivered: number; total: number }>();
    for (const t of todayRows) {
      const did = t.driver_id;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, delivered: 0, total: 0 });
      const entry = driverMap.get(did)!;
      entry.total += 1;
      if (t.status === 'delivered') entry.delivered += 1;
    }

    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:  fid,
        fahrer_name: d.name,
        quote_pct:  d.total > 0 ? Math.round((d.delivered / d.total) * 1000) / 10 : 0,
        delivered:  d.delivered,
        total:      d.total,
      }))
      .sort((a, b) => b.quote_pct - a.quote_pct);

    const total   = entries.length;
    const teamAvg = total > 0
      ? Math.round(entries.reduce((s, e) => s + e.quote_pct, 0) / total * 10) / 10
      : 0;

    // Yesterday ranks for delta
    const yestRows = (yestRes.data ?? []) as { driver_id: string; status?: string | null }[];
    const yMap = new Map<string, { delivered: number; total: number }>();
    for (const t of yestRows) {
      const did = t.driver_id;
      if (!yMap.has(did)) yMap.set(did, { delivered: 0, total: 0 });
      const entry = yMap.get(did)!;
      entry.total += 1;
      if (t.status === 'delivered') entry.delivered += 1;
    }
    const yEntries = [...yMap.entries()]
      .map(([id, d]) => ({ id, pct: d.total > 0 ? d.delivered / d.total : 0 }))
      .sort((a, b) => b.pct - a.pct);
    const yRankMap = new Map(yEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yRang      = yRankMap.get(e.fahrer_id);
      const rank_delta = yRang != null ? yRang - rang : 0;
      return { ...e, rang, rank_delta, ampel: amp, alert_bottom: amp === 'rot' };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_pct: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_pct:     teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK);
  }
}
