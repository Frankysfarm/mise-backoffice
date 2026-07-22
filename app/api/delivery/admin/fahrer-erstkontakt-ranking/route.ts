import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_sek: 42,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_sek: 67,  rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sek: 95,  rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sek: 148, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sek: 88,
  bester_name:  'Julia F.',
  letzter_name: 'Tim B.',
  alert_count:  1,
  gesamt:       4,
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
        .select('driver_id, driver_name, first_contact_at, departed_at')
        .eq('location_id', location_id)
        .gte('created_at', today.start)
        .lt('created_at', today.end)
        .not('first_contact_at', 'is', null)
        .not('departed_at', 'is', null),
      sb.from('delivery_batch_stops')
        .select('driver_id, first_contact_at, departed_at')
        .eq('location_id', location_id)
        .gte('created_at', yesterday.start)
        .lt('created_at', yesterday.end)
        .not('first_contact_at', 'is', null)
        .not('departed_at', 'is', null),
    ]);

    const todayRows = (todayRes.data ?? []) as {
      driver_id: string;
      driver_name?: string;
      first_contact_at: string;
      departed_at: string;
    }[];
    if (!todayRows.length) return NextResponse.json(MOCK);

    const driverMap = new Map<string, { name: string; sumSek: number; count: number }>();
    for (const t of todayRows) {
      const sek = (new Date(t.first_contact_at).getTime() - new Date(t.departed_at).getTime()) / 1000;
      if (sek < 0) continue;
      const did = t.driver_id;
      if (!driverMap.has(did)) driverMap.set(did, { name: t.driver_name ?? did, sumSek: 0, count: 0 });
      const entry = driverMap.get(did)!;
      entry.sumSek += sek;
      entry.count  += 1;
    }

    // aufsteigend: Rang 1 = kürzeste Zeit = bester
    const entries = [...driverMap.entries()]
      .map(([fid, d]) => ({
        fahrer_id:   fid,
        fahrer_name: d.name,
        avg_sek:     d.count > 0 ? Math.round(d.sumSek / d.count) : 0,
      }))
      .sort((a, b) => a.avg_sek - b.avg_sek);

    const total   = entries.length;
    const teamAvg = total > 0
      ? Math.round(entries.reduce((s, e) => s + e.avg_sek, 0) / total)
      : 0;

    const yestRows = (yestRes.data ?? []) as { driver_id: string; first_contact_at: string; departed_at: string }[];
    const yMap = new Map<string, { sumSek: number; count: number }>();
    for (const t of yestRows) {
      const sek = (new Date(t.first_contact_at).getTime() - new Date(t.departed_at).getTime()) / 1000;
      if (sek < 0) continue;
      const did = t.driver_id;
      if (!yMap.has(did)) yMap.set(did, { sumSek: 0, count: 0 });
      const entry = yMap.get(did)!;
      entry.sumSek += sek;
      entry.count  += 1;
    }
    const yEntries = [...yMap.entries()]
      .map(([id, d]) => ({ id, avg_sek: d.count > 0 ? d.sumSek / d.count : 0 }))
      .sort((a, b) => a.avg_sek - b.avg_sek);
    const yRankMap = new Map(yEntries.map((e, i) => [e.id, i + 1]));

    const fahrer = entries.map((e, i) => {
      const rang       = i + 1;
      const amp        = ampel(rang, total);
      const yRang      = yRankMap.get(e.fahrer_id);
      // negativ=verbessert: rang - yRang → wenn heute besser (kleinerer Rang), delta negativ
      const rank_delta = yRang != null ? rang - yRang : 0;
      return { ...e, rang, rank_delta, ampel: amp, alert_bottom: amp === 'rot' };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id) ?? fahrer[0];
      return NextResponse.json({ fahrer: me ? [me] : [], team_avg_sek: teamAvg, gesamt: total });
    }

    return NextResponse.json({
      fahrer,
      team_avg_sek:  teamAvg,
      bester_name:   fahrer[0]?.fahrer_name ?? '—',
      letzter_name:  fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:   fahrer.filter(f => f.alert_bottom).length,
      gesamt:        total,
    });
  } catch {
    return NextResponse.json(MOCK);
  }
}
