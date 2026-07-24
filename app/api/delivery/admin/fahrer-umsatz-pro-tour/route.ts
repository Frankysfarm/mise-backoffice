import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_avg: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_avg: 38.00, rank_delta:  0, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, umsatz_avg: 32.00, rank_delta:  1, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, umsatz_avg: 27.00, rank_delta: -1, ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_avg: 21.00, rank_delta:  0, ampel: 'rot',   alert_low: true  },
  ],
  team_avg: 29.50,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(umsatz: number, q25: number, q75: number): 'gruen' | 'gelb' | 'rot' {
  if (umsatz >= q75) return 'gruen';
  if (umsatz >= q25) return 'gelb';
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
        .from('delivery_tours')
        .select('driver_id, total_value')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_value')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, number[]>();
    for (const r of curData) {
      if (!r.driver_id || r.total_value == null) continue;
      if (!groupCur.has(r.driver_id)) groupCur.set(r.driver_id, []);
      groupCur.get(r.driver_id)!.push(r.total_value);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrevAvg = new Map<string, number>();
    const prevByDriver = new Map<string, number[]>();
    for (const r of prevData) {
      if (!r.driver_id || r.total_value == null) continue;
      if (!prevByDriver.has(r.driver_id)) prevByDriver.set(r.driver_id, []);
      prevByDriver.get(r.driver_id)!.push(r.total_value);
    }
    for (const [id, vals] of prevByDriver.entries()) {
      groupPrevAvg.set(id, vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, vals]) => {
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      return { fahrer_id: id, fahrer_name: id, umsatz_avg: avg };
    });

    const sorted = [...unsorted].sort((a, b) => b.umsatz_avg - a.umsatz_avg);

    const values = sorted.map(f => f.umsatz_avg);
    const q75 = values[Math.floor(values.length * 0.25)] ?? values[0];
    const q25 = values[Math.floor(values.length * 0.75)] ?? values[values.length - 1];

    const prevSorted = [...unsorted]
      .map(f => ({ ...f, umsatz_avg: groupPrevAvg.get(f.fahrer_id) ?? f.umsatz_avg }))
      .sort((a, b) => b.umsatz_avg - a.umsatz_avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        umsatz_avg: f.umsatz_avg,
        rank_delta: prevRang - rang,
        ampel: ampelVon(f.umsatz_avg, q25, q75),
        alert_low: f.umsatz_avg < q25,
      };
    });

    const team_avg = Math.round(
      (fahrer.reduce((s, f) => s + f.umsatz_avg, 0) / fahrer.length) * 100
    ) / 100;

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
