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
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_euro_tour: 24, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_euro_tour: 18, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_euro_tour: 14, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_euro_tour:  9, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_euro: 16.25,
  bester_name: 'Max M.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(val: number, p25: number, p75: number): 'gruen' | 'gelb' | 'rot' {
  if (val >= p75) return 'gruen';
  if (val >= p25) return 'gelb';
  return 'rot';
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const start30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, started_at, total_earnings')
        .eq('location_id', locationId)
        .gte('started_at', start30),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, total_earnings')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', start30),
    ]);

    const curData = (curRes.data ?? []).filter(t => t.started_at && isWeekend(t.started_at));
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sum: number; count: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, sum: 0, count: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        sum: prev.sum + (Number(t.total_earnings) || 0),
        count: prev.count + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const prevData = (prevRes.data ?? []).filter(t => t.started_at && isWeekend(t.started_at));
    const groupPrev = new Map<string, { sum: number; count: number }>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { sum: 0, count: 0 };
      groupPrev.set(t.driver_id, { sum: prev.sum + (Number(t.total_earnings) || 0), count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.avg - a.avg);
    const total = sorted.length;

    const vals = sorted.map(f => f.avg).sort((a, b) => a - b);
    const p25 = vals[Math.floor(total * 0.25)] ?? 0;
    const p75 = vals[Math.floor(total * 0.75)] ?? 0;

    const prevAvgs = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [id, v.count > 0 ? v.sum / v.count : 0])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg: prevAvgs.get(f.fahrer_id) ?? f.avg }))
      .sort((a, b) => b.avg - a.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(f.avg, p25, p75);
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

    const team_avg_euro = Math.round(
      (fahrer.reduce((s, f) => s + f.avg_euro_tour, 0) / total) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_euro,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
