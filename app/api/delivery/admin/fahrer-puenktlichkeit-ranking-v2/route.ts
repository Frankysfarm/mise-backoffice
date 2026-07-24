import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  puenktlichster_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_rate: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_rate: 94, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlichkeit_rate: 88, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlichkeit_rate: 76, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_rate: 62, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rate: 80,
  puenktlichster_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_rate: 90,
};

interface TourRow {
  driver_id: string;
  driver_name: string;
  promised_at: string | null;
  completed_at: string | null;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

// Higher is better for punctuality
function rankAmpel(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = thirtyDaysAgo();

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('driver_id, driver_name, promised_at, completed_at')
      .eq('location_id', location_id)
      .gte('completed_at', since)
      .not('completed_at', 'is', null)
      .not('promised_at', 'is', null);

    const rows = (tours ?? []) as TourRow[];
    if (rows.length === 0) return NextResponse.json(MOCK);

    const map: Record<string, { name: string; total: number; on_time: number }> = {};
    for (const t of rows) {
      if (!t.promised_at || !t.completed_at) continue;
      if (!map[t.driver_id]) map[t.driver_id] = { name: t.driver_name, total: 0, on_time: 0 };
      map[t.driver_id].total += 1;
      if (new Date(t.completed_at) <= new Date(t.promised_at)) {
        map[t.driver_id].on_time += 1;
      }
    }

    const sorted = Object.entries(map)
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        puenktlichkeit_rate: v.total > 0 ? Math.round((v.on_time / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.puenktlichkeit_rate - a.puenktlichkeit_rate); // Descending: higher = better

    const total = sorted.length;
    const teamAvg = Math.round(sorted.reduce((s, r) => s + r.puenktlichkeit_rate, 0) / total);

    const fahrer: FahrerRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const ampel = rankAmpel(rang, total);
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        puenktlichkeit_rate: r.puenktlichkeit_rate,
        rank_delta: 0,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_rate: teamAvg,
      puenktlichster_name: fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
      ziel_rate: 90,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
