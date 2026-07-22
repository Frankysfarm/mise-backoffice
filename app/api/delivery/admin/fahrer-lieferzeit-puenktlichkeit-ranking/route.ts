import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface TourRow {
  driver_id: string;
  driver_name: string;
  delivered_at: string;
  estimated_delivery_at: string;
}

interface YestRow {
  driver_id: string;
  delivered_at: string;
  estimated_delivery_at: string;
}

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, pct: 95, rank_delta:  3, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, pct: 87, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, pct: 72, rank_delta: -4, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, pct: 55, rank_delta: -8, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 77,
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

function isPuenktlich(deliveredAt: string, etaAt: string): boolean {
  const diff = Math.abs(new Date(deliveredAt).getTime() - new Date(etaAt).getTime());
  return diff <= 5 * 60000;
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
        .select('driver_id, driver_name, delivered_at, estimated_delivery_at')
        .eq('location_id', location_id)
        .eq('status', 'delivered')
        .gte('delivered_at', today.start)
        .lt('delivered_at', today.end)
        .not('estimated_delivery_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, delivered_at, estimated_delivery_at')
        .eq('location_id', location_id)
        .eq('status', 'delivered')
        .gte('delivered_at', yesterday.start)
        .lt('delivered_at', yesterday.end)
        .not('estimated_delivery_at', 'is', null),
    ]);

    const todayTours: TourRow[] = (todayRes.data ?? []) as TourRow[];
    const yestTours: YestRow[]  = (yestRes.data  ?? []) as YestRow[];

    const yestAcc: Record<string, { puenktlich: number; total: number }> = {};
    for (const t of yestTours) {
      if (!yestAcc[t.driver_id]) yestAcc[t.driver_id] = { puenktlich: 0, total: 0 };
      yestAcc[t.driver_id].total++;
      if (isPuenktlich(t.delivered_at, t.estimated_delivery_at)) yestAcc[t.driver_id].puenktlich++;
    }
    const yestMap: Record<string, number> = {};
    for (const [id, v] of Object.entries(yestAcc)) {
      yestMap[id] = Math.round((v.puenktlich / v.total) * 100);
    }

    const driverMap: Record<string, { name: string; puenktlich: number; total: number }> = {};
    for (const t of todayTours) {
      if (!driverMap[t.driver_id]) driverMap[t.driver_id] = { name: t.driver_name, puenktlich: 0, total: 0 };
      driverMap[t.driver_id].total++;
      if (isPuenktlich(t.delivered_at, t.estimated_delivery_at)) driverMap[t.driver_id].puenktlich++;
    }

    let rows = Object.entries(driverMap).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name,
      pct:         Math.round((v.puenktlich / v.total) * 100),
    }));

    if (driver_id) rows = rows.filter(r => r.fahrer_id === driver_id);
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    rows.sort((a, b) => b.pct - a.pct);
    const total      = rows.length;
    const teamAvgPct = Math.round(rows.reduce((s, r) => s + r.pct, 0) / total);

    const fahrer = rows.map((r, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yestPct    = yestMap[r.fahrer_id];
      const rank_delta = yestPct != null ? Math.round(r.pct - yestPct) : 0;
      return {
        fahrer_id:    r.fahrer_id,
        fahrer_name:  r.fahrer_name,
        rang,
        pct:          r.pct,
        rank_delta,
        ampel:        amp,
        alert_bottom: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_pct:  teamAvgPct,
      bester_name:   fahrer[0]?.fahrer_name ?? '—',
      letzter_name:  fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:   fahrer.filter(f => f.alert_bottom).length,
      gesamt:        total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
