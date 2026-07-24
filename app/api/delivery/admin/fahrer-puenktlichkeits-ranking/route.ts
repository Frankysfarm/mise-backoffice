import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRankRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rate_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRankRow[];
  team_avg_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 95, rank_delta:  2, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate_pct: 88, rank_delta:  0, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate_pct: 72, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 58, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 78,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface StopRow {
  driver_id: string;
  driver_name: string;
  delivered_at: string | null;
  estimated_at: string | null;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function rankAmpel(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const since = thirtyDaysAgo();

    const { data: stops } = await supabase
      .from('delivery_stops')
      .select('driver_id, driver_name, delivered_at, estimated_at')
      .eq('location_id', location_id)
      .gte('delivered_at', since)
      .not('delivered_at', 'is', null);

    const rows = (stops ?? []) as StopRow[];
    if (rows.length === 0) return NextResponse.json(MOCK_DATA);

    const map: Record<string, { name: string; onTime: number; total: number }> = {};
    for (const s of rows) {
      if (!s.delivered_at) continue;
      if (!map[s.driver_id]) map[s.driver_id] = { name: s.driver_name, onTime: 0, total: 0 };
      map[s.driver_id].total += 1;
      if (s.estimated_at) {
        const diffMin = (new Date(s.delivered_at).getTime() - new Date(s.estimated_at).getTime()) / 60000;
        if (diffMin <= 5) map[s.driver_id].onTime += 1;
      } else {
        map[s.driver_id].onTime += 1;
      }
    }

    const sorted = Object.entries(map)
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        rate_pct: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate_pct - a.rate_pct);

    const total = sorted.length;
    const teamAvg = Math.round(sorted.reduce((s, r) => s + r.rate_pct, 0) / total);

    const fahrer: FahrerRankRow[] = sorted.map((r, i) => {
      const rang = i + 1;
      const ampel = rankAmpel(rang, total);
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        rate_pct: r.rate_pct,
        rank_delta: 0,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_pct: teamAvg,
      bester_name: fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[total - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
