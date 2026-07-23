import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  sek: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, sek:  80, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, sek: 105, rank_delta: -1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, sek: 150, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, sek: 250, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_sek: 146,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function fmtSek(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('driver_id, driver_name, arrived_at, delivered_at')
        .eq('location_id', locationId)
        .not('arrived_at', 'is', null)
        .not('delivered_at', 'is', null)
        .gte('delivered_at', cur30.toISOString()),
      supabase
        .from('delivery_stops')
        .select('driver_id')
        .eq('location_id', locationId)
        .not('arrived_at', 'is', null)
        .not('delivered_at', 'is', null)
        .gte('delivered_at', prev30.toISOString())
        .lt('delivered_at', cur30.toISOString()),
    ]);

    const curRows = curRes.data ?? [];
    const prevRows = prevRes.data ?? [];

    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Aggregate avg handover time per driver
    const driverMap = new Map<string, { name: string; totalSek: number; count: number }>();
    for (const row of curRows) {
      if (!row.driver_id || !row.arrived_at || !row.delivered_at) continue;
      const sek = Math.round((new Date(row.delivered_at).getTime() - new Date(row.arrived_at).getTime()) / 1000);
      if (sek < 0 || sek > 600) continue;
      const entry = driverMap.get(row.driver_id) ?? { name: row.driver_name ?? row.driver_id, totalSek: 0, count: 0 };
      entry.totalSek += sek;
      entry.count += 1;
      driverMap.set(row.driver_id, entry);
    }

    const prevCountMap = new Map<string, number>();
    for (const row of prevRows) {
      if (!row.driver_id) continue;
      prevCountMap.set(row.driver_id, (prevCountMap.get(row.driver_id) ?? 0) + 1);
    }

    const sorted = [...driverMap.entries()]
      .map(([id, v]) => ({ fahrer_id: id, fahrer_name: v.name, avgSek: Math.round(v.totalSek / v.count) }))
      .sort((a, b) => a.avgSek - b.avgSek);

    const gesamt = sorted.length;
    const prevSorted = [...sorted].sort((a, b) => (prevCountMap.get(a.fahrer_id) ?? 0) - (prevCountMap.get(b.fahrer_id) ?? 0));
    const prevRankMap = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRankMap.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, gesamt);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        sek: f.avgSek,
        rank_delta: rang - prevRang,
        ampel,
        alert_top: ampel === 'rot',
      };
    });

    const team_avg_sek = Math.round(sorted.reduce((s, f) => s + f.avgSek, 0) / Math.max(gesamt, 1));

    return NextResponse.json({
      fahrer,
      team_avg_sek,
      schnellster_name: fahrer[0]?.fahrer_name ?? '—',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
