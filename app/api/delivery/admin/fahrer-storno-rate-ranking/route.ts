import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rate_pct: number;
  cancelled_orders: number;
  assigned_orders: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  beste_name: string;
  hoechste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 1,  cancelled_orders: 1,  assigned_orders: 65, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, rate_pct: 4,  cancelled_orders: 2,  assigned_orders: 55, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, rate_pct: 8,  cancelled_orders: 3,  assigned_orders: 40, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 17, cancelled_orders: 7,  assigned_orders: 42, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_rate: 8,
  beste_name: 'Julia F.',
  hoechste_name: 'Tim B.',
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

    type Acc = { assigned: number; cancelled: number };
    const groupCur = new Map<string, Acc>();
    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { assigned: 0, cancelled: 0 };
      groupCur.set(id, {
        assigned:  prev.assigned + 1,
        cancelled: prev.cancelled + (t.status === 'cancelled' ? 1 : 0),
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const t of prevToursRes.data ?? []) {
      const id = t.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { assigned: 0, cancelled: 0 };
      groupPrev.set(id, {
        assigned:  prev.assigned + 1,
        cancelled: prev.cancelled + (t.status === 'cancelled' ? 1 : 0),
      });
    }

    const calcRate = (acc: Acc) =>
      acc.assigned > 0 ? Math.round((acc.cancelled / acc.assigned) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:        id,
      fahrer_name:      id.slice(0, 8),
      rate_pct:         calcRate(acc),
      cancelled_orders: acc.cancelled,
      assigned_orders:  acc.assigned,
    }));

    // AUFSTEIGEND: Rang 1 = niedrigste Storno-Rate = bester
    const sorted = [...unsorted].sort((a, b) => a.rate_pct - b.rate_pct);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, rate_pct: p ? calcRate(p) : calcRate(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => a.rate_pct - b.rate_pct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgRate = Math.round(sorted.reduce((s, f) => s + f.rate_pct, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:        f.fahrer_id,
        fahrer_name:      f.fahrer_name,
        rang,
        rate_pct:         f.rate_pct,
        cancelled_orders: f.cancelled_orders,
        assigned_orders:  f.assigned_orders,
        rank_delta:       prevRang - rang,
        ampel:            ampelVon(rang, gesamt),
        alert_hoch:       f.rate_pct > 10,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_rate: teamAvgRate,
      beste_name:    sorted[0]?.fahrer_name ?? '',
      hoechste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:   fahrer.filter(f => f.alert_hoch).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
