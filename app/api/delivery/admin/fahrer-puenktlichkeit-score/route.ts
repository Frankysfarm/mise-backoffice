import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 96, on_time: 48, gesamt: 50, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, puenktlichkeit_pct: 88, on_time: 37, gesamt: 42, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_pct: 74, on_time: 29, gesamt: 39, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 51, on_time: 18, gesamt: 35, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 77,
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
        .select('driver_id, driver_name, actual_delivered_at, estimated_delivered_at')
        .eq('location_id', location_id)
        .gte('actual_delivered_at', today.start)
        .lt('actual_delivered_at', today.end)
        .not('actual_delivered_at', 'is', null),
      sb.from('delivery_batch_stops')
        .select('driver_id, actual_delivered_at, estimated_delivered_at')
        .eq('location_id', location_id)
        .gte('actual_delivered_at', yesterday.start)
        .lt('actual_delivered_at', yesterday.end)
        .not('actual_delivered_at', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as {
      driver_id: string;
      driver_name?: string;
      actual_delivered_at: string;
      estimated_delivered_at?: string;
    }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    // Aggregate on-time counts per driver
    const driverMap = new Map<string, { name: string; on_time: number; gesamt: number }>();
    for (const t of todayRows) {
      const did = t.driver_id;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, on_time: 0, gesamt: 0 });
      const entry = driverMap.get(did)!;
      entry.gesamt += 1;
      if (t.estimated_delivered_at) {
        const onTime = new Date(t.actual_delivered_at) <= new Date(t.estimated_delivered_at);
        if (onTime) entry.on_time += 1;
      } else {
        entry.on_time += 1; // no ETA = assume on-time
      }
    }

    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:         fid,
        fahrer_name:       d.name,
        puenktlichkeit_pct: d.gesamt > 0 ? Math.round((d.on_time / d.gesamt) * 100) : 0,
        on_time:           d.on_time,
        gesamt:            d.gesamt,
      }))
      .sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);

    const total   = entries.length;
    const teamAvg = total > 0 ? Math.round(entries.reduce((s, e) => s + e.puenktlichkeit_pct, 0) / total) : 0;

    // Yesterday ranks for delta
    const yestRows = (yestRes.data ?? []) as {
      driver_id: string;
      actual_delivered_at: string;
      estimated_delivered_at?: string;
    }[];
    const yMap = new Map<string, { on_time: number; gesamt: number }>();
    for (const t of yestRows) {
      const did = t.driver_id;
      if (!yMap.has(did)) yMap.set(did, { on_time: 0, gesamt: 0 });
      const entry = yMap.get(did)!;
      entry.gesamt += 1;
      if (t.estimated_delivered_at) {
        if (new Date(t.actual_delivered_at) <= new Date(t.estimated_delivered_at)) entry.on_time += 1;
      } else {
        entry.on_time += 1;
      }
    }
    const yEntries = [...yMap.entries()]
      .map(([id, d]) => ({ id, pct: d.gesamt > 0 ? Math.round((d.on_time / d.gesamt) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
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
