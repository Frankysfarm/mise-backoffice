import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_quote: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  bester_name: string;
  hoechste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_quote: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, leerfahrten_quote:  2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, leerfahrten_quote:  5, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, leerfahrten_quote:  9, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten_quote: 15, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_quote: 7.75,
  bester_name: 'Julia F.',
  hoechste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_quote: 5,
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
        .select('driver_id, driver_name, status')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString()),
      supabase
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString()),
    ]);

    const curData = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; leer: number }>();
    for (const t of curData) {
      const isLeer = t.status === 'empty' || t.status === 'cancelled_empty' || t.status === 'no_show';
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, total: 0, leer: 0 };
      groupCur.set(t.driver_id, { name: prev.name, total: prev.total + 1, leer: prev.leer + (isLeer ? 1 : 0) });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; leer: number }>();
    for (const t of prevData) {
      const isLeer = t.status === 'empty' || t.status === 'cancelled_empty' || t.status === 'no_show';
      const prev = groupPrev.get(t.driver_id) ?? { total: 0, leer: 0 };
      groupPrev.set(t.driver_id, { total: prev.total + 1, leer: prev.leer + (isLeer ? 1 : 0) });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      quote: v.total > 0 ? Math.round((v.leer / v.total) * 100) : 0,
    }));

    // ascending: Rang 1 = lowest quote = best
    const sorted = [...unsorted].sort((a, b) => a.quote - b.quote);
    const total = sorted.length;

    const prevQuotes = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.total > 0 ? Math.round((v.leer / v.total) * 100) : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, quote: prevQuotes.get(f.fahrer_id) ?? f.quote }))
      .sort((a, b) => a.quote - b.quote);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        leerfahrten_quote: f.quote,
        rank_delta: rang - prevRang,
        ampel,
        alert_hoch: ampel === 'rot',
      };
    });

    const team_avg_quote = Math.round(
      fahrer.reduce((s, f) => s + f.leerfahrten_quote, 0) / total * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_quote,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      hoechste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
      ziel_quote: 5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
