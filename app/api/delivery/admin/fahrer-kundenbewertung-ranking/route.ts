import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bewertung_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, bewertung_avg: 4.9, rank_delta:  0, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, bewertung_avg: 4.6, rank_delta:  1, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, bewertung_avg: 4.1, rank_delta: -1, ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bewertung_avg: 3.2, rank_delta:  0, ampel: 'rot',   alert_low: true  },
  ],
  team_avg: 4.2,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(avg: number): 'gruen' | 'gelb' | 'rot' {
  if (avg >= 4.5) return 'gruen';
  if (avg >= 3.5) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('order_ratings')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('order_ratings')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, number[]>();
    for (const r of curData) {
      if (!r.driver_id || r.rating == null) continue;
      if (!groupCur.has(r.driver_id)) groupCur.set(r.driver_id, []);
      groupCur.get(r.driver_id)!.push(r.rating);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const r of prevData) {
      if (!r.driver_id || r.rating == null) continue;
      const arr = groupPrev.get(r.driver_id) !== undefined
        ? [groupPrev.get(r.driver_id)!]
        : [];
      arr.push(r.rating);
      groupPrev.set(r.driver_id, arr.reduce((a, b) => a + b, 0) / arr.length);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, ratings]) => {
      const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      return { fahrer_id: id, fahrer_name: id, bewertung_avg: avg };
    });

    const sorted = [...unsorted].sort((a, b) => b.bewertung_avg - a.bewertung_avg);

    const prevAvgs = new Map<string, number>();
    for (const [id, avg] of groupPrev.entries()) prevAvgs.set(id, avg);

    const prevSorted = [...unsorted].map(f => ({ ...f, bewertung_avg: prevAvgs.get(f.fahrer_id) ?? f.bewertung_avg }))
      .sort((a, b) => b.bewertung_avg - a.bewertung_avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        bewertung_avg: f.bewertung_avg,
        rank_delta: prevRang - rang,
        ampel: ampelVon(f.bewertung_avg),
        alert_low: f.bewertung_avg < 3.5,
      };
    });

    const team_avg = Math.round(
      (fahrer.reduce((s, f) => s + f.bewertung_avg, 0) / fahrer.length) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_low).length,
      gesamt: fahrer.length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
