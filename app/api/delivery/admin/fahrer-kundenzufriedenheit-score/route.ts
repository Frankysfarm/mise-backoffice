import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, score: 4.8, bewertungen: 24, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, score: 4.2, bewertungen: 18, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, score: 3.6, bewertungen: 15, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, score: 2.9, bewertungen: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_score: 3.9,
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
        .select('driver_id, driver_name, customer_rating')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end)
        .not('customer_rating', 'is', null),
      sb.from('delivery_batch_stops')
        .select('driver_id, customer_rating')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end)
        .not('customer_rating', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as {
      driver_id: string;
      driver_name?: string;
      customer_rating: number;
    }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    const driverMap = new Map<string, { name: string; sum: number; count: number }>();
    for (const t of todayRows) {
      const did = t.driver_id;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, sum: 0, count: 0 });
      const entry = driverMap.get(did)!;
      entry.sum   += t.customer_rating;
      entry.count += 1;
    }

    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:   fid,
        fahrer_name: d.name,
        score:       d.count > 0 ? Math.round((d.sum / d.count) * 10) / 10 : 0,
        bewertungen: d.count,
      }))
      .sort((a, b) => b.score - a.score);

    const total   = entries.length;
    const teamAvg = total > 0
      ? Math.round((entries.reduce((s, e) => s + e.score, 0) / total) * 10) / 10
      : 0;

    const yestRows = (yestRes.data ?? []) as { driver_id: string; customer_rating: number }[];
    const yMap = new Map<string, { sum: number; count: number }>();
    for (const t of yestRows) {
      const did = t.driver_id;
      if (!yMap.has(did)) yMap.set(did, { sum: 0, count: 0 });
      const entry = yMap.get(did)!;
      entry.sum   += t.customer_rating;
      entry.count += 1;
    }
    const yEntries = [...yMap.entries()]
      .map(([id, d]) => ({ id, score: d.count > 0 ? d.sum / d.count : 0 }))
      .sort((a, b) => b.score - a.score);
    const yRankMap = new Map(yEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yRang      = yRankMap.get(e.fahrer_id);
      const rank_delta = yRang != null ? yRang - rang : 0; // positiv = verbessert
      return { ...e, rang, rank_delta, ampel: amp, alert_bottom: amp === 'rot' };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_score: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_score:   teamAvg,
      bester_name:      fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_bottom).length,
      gesamt:           total,
    });
  } catch {
    return NextResponse.json(MOCK);
  }
}
