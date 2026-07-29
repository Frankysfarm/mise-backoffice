import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_euro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_euro: number;
  bester_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_euro_tour: 24, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_euro_tour: 18, rank_delta:  0, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_euro_tour: 14, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_euro_tour:  9, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_euro: 16.25,
  bester_name: 'Max M.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(euro: number, q1: number, q3: number): 'gruen' | 'gelb' | 'rot' {
  if (euro >= q3) return 'gruen';
  if (euro >= q1) return 'gelb';
  return 'rot';
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getUTCDay();
  return day === 0 || day === 6; // Sunday=0, Saturday=6
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, total_revenue, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_revenue, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = (curRes.data ?? []).filter(t => t.started_at && isWeekend(t.started_at));
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sumEuro: number; count: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, sumEuro: 0, count: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        sumEuro: prev.sumEuro + (t.total_revenue ?? 0),
        count: prev.count + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevData = (prevRes.data ?? []).filter(t => t.started_at && isWeekend(t.started_at));
    const groupPrev = new Map<string, { sumEuro: number; count: number }>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { sumEuro: 0, count: 0 };
      groupPrev.set(t.driver_id, {
        sumEuro: prev.sumEuro + (t.total_revenue ?? 0),
        count: prev.count + 1,
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg: v.count > 0 ? Math.round((v.sumEuro / v.count) * 100) / 100 : 0,
    }));

    // descending: Rang 1 = höchster Wochenend-Wert = bester
    const sorted = [...unsorted].sort((a, b) => b.avg - a.avg);
    const total = sorted.length;

    // Quartil-Ampel
    const q1Idx = Math.floor(total * 0.25);
    const q3Idx = Math.floor(total * 0.75);
    const q1 = sorted[Math.max(0, total - q1Idx - 1)]?.avg ?? 0;
    const q3 = sorted[q3Idx]?.avg ?? sorted[0]?.avg ?? 0;

    const prevAvgs = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.count > 0 ? Math.round((v.sumEuro / v.count) * 100) / 100 : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg: prevAvgs.get(f.fahrer_id) ?? f.avg }))
      .sort((a, b) => b.avg - a.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(f.avg, q1, q3);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_euro_tour: f.avg,
        rank_delta: prevRang - rang,
        ampel,
        alert_niedrig: f.avg < 12,
      };
    });

    const team_avg_euro =
      Math.round((fahrer.reduce((s, f) => s + f.avg_euro_tour, 0) / total) * 100) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_euro,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
