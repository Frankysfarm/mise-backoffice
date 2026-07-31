import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  completed_tours: number;
  assigned_tours: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 97, completed_tours: 97,  assigned_tours: 100, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, quote_pct: 91, completed_tours: 82,  assigned_tours: 90,  rank_delta: 1,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 84, completed_tours: 63,  assigned_tours: 75,  rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 71, completed_tours: 50,  assigned_tours: 70,  rank_delta: 0,  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 86,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
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

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [toursRes, prevToursRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, status')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const tours = toursRes.data ?? [];
    if (!tours.length) return NextResponse.json(MOCK_DATA);

    type Acc = { assigned: number; completed: number };
    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { assigned: 0, completed: 0 };
      groupCur.set(id, {
        assigned:  prev.assigned + 1,
        completed: prev.completed + (t.status === 'completed' ? 1 : 0),
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { assigned: 0, completed: 0 };
      groupPrev.set(id, {
        assigned:  prev.assigned + 1,
        completed: prev.completed + (t.status === 'completed' ? 1 : 0),
      });
    }

    const calcQuote = (acc: Acc) =>
      acc.assigned > 0 ? Math.round((acc.completed / acc.assigned) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:       id,
      fahrer_name:     id.slice(0, 8),
      quote_pct:       calcQuote(acc),
      completed_tours: acc.completed,
      assigned_tours:  acc.assigned,
    }));

    const sorted  = [...unsorted].sort((a, b) => b.quote_pct - a.quote_pct);
    const gesamt  = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, quote_pct: p ? calcQuote(p) : calcQuote(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.quote_pct - a.quote_pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgQuote = Math.round(sorted.reduce((s, f) => s + f.quote_pct, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        quote_pct:       f.quote_pct,
        completed_tours: f.completed_tours,
        assigned_tours:  f.assigned_tours,
        rank_delta:      prevRang - rang,
        ampel:           ampelVon(rang, gesamt),
        alert_niedrig:   f.quote_pct < 80,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_quote:  teamAvgQuote,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
