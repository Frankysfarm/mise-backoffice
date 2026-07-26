import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_bewertung: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_bewertung: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_bewertung: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_bewertung: 4.9, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_bewertung: 4.7, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_bewertung: 4.3, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_bewertung: 3.8, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_bewertung: 4.43,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_bewertung: 4.5,
};

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
        .from('delivery_tours')
        .select('driver_id, driver_name, customer_rating')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('customer_rating', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, customer_rating')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('customer_rating', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sum: number; count: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, sum: 0, count: 0 };
      groupCur.set(t.driver_id, { name: prev.name, sum: prev.sum + (t.customer_rating ?? 0), count: prev.count + 1 });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { sum: number; count: number }>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { sum: 0, count: 0 };
      groupPrev.set(t.driver_id, { sum: prev.sum + (t.customer_rating ?? 0), count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    }));

    // descending: Rang 1 = highest rating = best
    const sorted = [...unsorted].sort((a, b) => b.avg - a.avg);
    const total = sorted.length;

    const prevAvgs = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg: prevAvgs.get(f.fahrer_id) ?? f.avg }))
      .sort((a, b) => b.avg - a.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        avg_bewertung: f.avg,
        rank_delta: prevRang - rang,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    const team_avg_bewertung =
      Math.round((fahrer.reduce((s, f) => s + f.avg_bewertung, 0) / total) * 10) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_bewertung,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
      ziel_bewertung: 4.5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
