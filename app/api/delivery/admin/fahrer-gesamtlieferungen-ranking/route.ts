import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Gesamtlieferungen-Ranking: Anzahl abgeschlossener Lieferungen (letzte 30 Tage)
// ABSTEIGEND — meiste Lieferungen = aktivster Fahrer = Rang 1

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  gesamt_lieferungen: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  aktivster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, gesamt_lieferungen: 312, rank_delta:  2, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, gesamt_lieferungen: 287, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, gesamt_lieferungen: 215, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, gesamt_lieferungen:  98, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 228,
  aktivster_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): Ampel {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since60 = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, status')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', since30)
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', since60)
        .lt('created_at', since30)
        .not('driver_id', 'is', null),
    ]);

    type TourRow = { driver_id: string; driver_name?: string | null };

    const curRows: TourRow[]  = (curRes.data ?? []) as TourRow[];
    const prevRows: TourRow[] = (prevRes.data ?? []) as TourRow[];

    if (curRows.length === 0) return NextResponse.json(MOCK_DATA);

    // Aggregate current period
    const curMap = new Map<string, { name: string; count: number }>();
    for (const r of curRows) {
      const entry = curMap.get(r.driver_id) ?? { name: r.driver_name ?? r.driver_id, count: 0 };
      entry.count++;
      curMap.set(r.driver_id, entry);
    }

    // Aggregate previous period
    const prevMap = new Map<string, number>();
    for (const r of prevRows) {
      prevMap.set(r.driver_id, (prevMap.get(r.driver_id) ?? 0) + 1);
    }

    // Sort DESCENDING — most deliveries = Rang 1
    const sorted = [...curMap.entries()].sort((a, b) => b[1].count - a[1].count);
    const total  = sorted.length;
    const teamAvg = sorted.reduce((s, [, v]) => s + v.count, 0) / total;

    // Build prev ranking for delta
    const prevSorted = [...curMap.keys()].sort(
      (a, b) => (prevMap.get(b) ?? 0) - (prevMap.get(a) ?? 0),
    );
    const prevRank = new Map(prevSorted.map((id, i) => [id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map(([id, { name, count }], i) => {
      const rang  = i + 1;
      const prev  = prevRank.get(id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: id,
        fahrer_name: name,
        rang,
        gesamt_lieferungen: count,
        rank_delta: prev - rang,
        ampel,
        alert_niedrig: rang > total * 0.75,
      };
    });

    const result: ApiResponse = {
      fahrer,
      team_avg: Math.round(teamAvg),
      aktivster_name: fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({ ...result, fahrer_single: me ?? null });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
