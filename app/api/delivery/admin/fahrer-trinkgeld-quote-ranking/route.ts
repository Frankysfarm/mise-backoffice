import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trinkgeld_quote: number; // avg tip in € per stop
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, trinkgeld_quote: 1.85, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, trinkgeld_quote: 1.42, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, trinkgeld_quote: 0.98, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trinkgeld_quote: 0.43, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 1.17,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = createClient();
    const today     = todayStr();
    const yesterday = yesterdayStr();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('fahrer_einnahmen_snapshots')
        .select('fahrer_id, trinkgeld_cents, stopps_count, drivers(name)')
        .eq('location_id', location_id)
        .eq('snapshot_date', today),
      supabase
        .from('fahrer_einnahmen_snapshots')
        .select('fahrer_id, trinkgeld_cents, stopps_count')
        .eq('location_id', location_id)
        .eq('snapshot_date', yesterday),
    ]);

    if (curRes.error || !curRes.data?.length) {
      return NextResponse.json(MOCK_DATA);
    }

    type SnapRow = {
      fahrer_id: string;
      trinkgeld_cents: number;
      stopps_count: number;
      drivers?: { name: string } | { name: string }[] | null;
    };

    const getName = (row: SnapRow): string => {
      if (!row.drivers) return row.fahrer_id;
      if (Array.isArray(row.drivers)) return row.drivers[0]?.name ?? row.fahrer_id;
      return (row.drivers as { name: string }).name ?? row.fahrer_id;
    };

    const todayRows = curRes.data as SnapRow[];

    const sorted = todayRows
      .filter(r => r.stopps_count > 0)
      .map(r => ({
        fahrer_id: r.fahrer_id,
        fahrer_name: getName(r),
        quote: r.stopps_count > 0 ? (r.trinkgeld_cents / 100) / r.stopps_count : 0,
      }))
      .sort((a, b) => b.quote - a.quote);

    if (!sorted.length) return NextResponse.json(MOCK_DATA);

    const n = sorted.length;

    const prevRows = (prevRes.data ?? []) as Pick<SnapRow, 'fahrer_id' | 'trinkgeld_cents' | 'stopps_count'>[];
    const prevSorted = prevRows
      .filter(r => r.stopps_count > 0)
      .map(r => ({ id: r.fahrer_id, quote: (r.trinkgeld_cents / 100) / r.stopps_count }))
      .sort((a, b) => b.quote - a.quote);
    const prevRank = new Map(prevSorted.map((r, i) => [r.id, i + 1]));

    const team_avg = sorted.reduce((s, f) => s + f.quote, 0) / n;

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prev = prevRank.get(f.fahrer_id) ?? null;
      return {
        fahrer_id:    f.fahrer_id,
        fahrer_name:  f.fahrer_name,
        rang,
        trinkgeld_quote: Math.round(f.quote * 100) / 100,
        rank_delta:   prev !== null ? prev - rang : 0,
        ampel:        ampelVon(rang, n),
        alert_bottom: rang > Math.floor(n * 0.75),
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id);
      if (!me) return NextResponse.json(MOCK_DATA);
    }

    return NextResponse.json({
      fahrer,
      team_avg:     Math.round(team_avg * 100) / 100,
      bester_name:  fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[n - 1]?.fahrer_name ?? '',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       n,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
