import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_schicht: 187, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, umsatz_pro_schicht: 162, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, umsatz_pro_schicht: 143, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_schicht:  98, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_umsatz: 147.5,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
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

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, total_price, created_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, total_price, created_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    // Group by driver and by day (shift ≈ day) to compute avg revenue per shift
    type DriverAcc = { name: string; dayRevenue: Map<string, number> };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const day = (o.created_at as string).slice(0, 10);
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, dayRevenue: new Map() };
      prev.dayRevenue.set(day, (prev.dayRevenue.get(day) ?? 0) + (Number(o.total_price) || 0));
      groupCur.set(o.driver_id, { name: prev.name, dayRevenue: prev.dayRevenue });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { dayRevenue: Map<string, number> };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const day = (o.created_at as string).slice(0, 10);
      const prev = groupPrev.get(o.driver_id) ?? { dayRevenue: new Map() };
      prev.dayRevenue.set(day, (prev.dayRevenue.get(day) ?? 0) + (Number(o.total_price) || 0));
      groupPrev.set(o.driver_id, prev);
    }

    const avgRevPerShift = (dayRevMap: Map<string, number>) => {
      if (!dayRevMap.size) return 0;
      const total = Array.from(dayRevMap.values()).reduce((s, v) => s + v, 0);
      return Math.round(total / dayRevMap.size);
    };

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:         id,
      fahrer_name:       v.name || id.slice(0, 8),
      umsatz_pro_schicht: avgRevPerShift(v.dayRevenue),
    }));

    // absteigend — höchster Umsatz/Schicht = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.umsatz_pro_schicht - a.umsatz_pro_schicht);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p    = groupPrev.get(f.fahrer_id);
      const pVal = p ? avgRevPerShift(p.dayRevenue) : f.umsatz_pro_schicht;
      return { fahrer_id: f.fahrer_id, umsatz_pro_schicht: pVal };
    }).sort((a, b) => b.umsatz_pro_schicht - a.umsatz_pro_schicht);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:          f.fahrer_id,
        fahrer_name:        f.fahrer_name,
        rang,
        umsatz_pro_schicht: f.umsatz_pro_schicht,
        rank_delta:         prevRang - rang,
        ampel,
        alert_niedrig:      ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      sorted.reduce((s, f) => s + f.umsatz_pro_schicht, 0) / total
    );

    return NextResponse.json({
      fahrer,
      team_avg_umsatz:  teamAvg,
      beste_name:       sorted[0]?.fahrer_name ?? '',
      niedrigste_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_niedrig).length,
      gesamt:           total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
