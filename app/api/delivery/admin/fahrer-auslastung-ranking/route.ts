import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, auslastung_pct: 92, aktive_min: 290, gesamt_min: 315, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, auslastung_pct: 81, aktive_min: 243, gesamt_min: 300, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, auslastung_pct: 68, aktive_min: 190, gesamt_min: 280, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 41, aktive_min: 105, gesamt_min: 256, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 70,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
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
      sb.from('delivery_tours')
        .select('driver_id, driver_name, departed_at, returned_at')
        .eq('location_id', location_id)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end)
        .not('returned_at', 'is', null),
      sb.from('delivery_tours')
        .select('driver_id, departed_at, returned_at')
        .eq('location_id', location_id)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end)
        .not('returned_at', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as { driver_id: string; driver_name?: string; departed_at: string; returned_at: string }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    // Aggregate active minutes per driver
    const driverMap = new Map<string, { name: string; aktive_min: number }>();
    for (const t of todayRows) {
      const did = t.driver_id;
      const min = (new Date(t.returned_at).getTime() - new Date(t.departed_at).getTime()) / 60000;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, aktive_min: 0 });
      driverMap.get(did)!.aktive_min += min;
    }

    const schichtMin = Math.max(...[...driverMap.values()].map(d => d.aktive_min), 240) * 1.1;

    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:     fid,
        fahrer_name:   d.name,
        auslastung_pct: Math.min(Math.round((d.aktive_min / schichtMin) * 100), 100),
        aktive_min:    Math.round(d.aktive_min),
        gesamt_min:    Math.round(schichtMin),
      }))
      .sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const total   = entries.length;
    const teamAvg = total > 0 ? Math.round(entries.reduce((s, e) => s + e.auslastung_pct, 0) / total) : 0;

    // Yesterday rank for delta
    const yestRows = (yestRes.data ?? []) as { driver_id: string; departed_at: string; returned_at: string }[];
    const yMap = new Map<string, number>();
    for (const t of yestRows) {
      const did = t.driver_id;
      const min = (new Date(t.returned_at).getTime() - new Date(t.departed_at).getTime()) / 60000;
      yMap.set(did, (yMap.get(did) ?? 0) + min);
    }
    const ySchicht = Math.max(...[...yMap.values()], 240) * 1.1;
    const yEntries = [...yMap.entries()]
      .map(([id, min]) => ({ id, pct: Math.min(Math.round((min / ySchicht) * 100), 100) }))
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
      team_avg_pct: teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK);
  }
}
