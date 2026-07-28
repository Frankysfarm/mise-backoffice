import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 94, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 2, puenktlichkeit_pct: 89, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_pct: 82, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 71, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 84,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 0,
  gesamt: 4,
};

function ampelVon(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
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
        .select('driver_id, driver_name, delivered_at, promised_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('delivered_at', 'is', null)
        .not('promised_at', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, delivered_at, promised_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('delivered_at', 'is', null)
        .not('promised_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; total: number; onTime: number }>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const entry = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, onTime: 0 };
      entry.total += 1;
      if (new Date(o.delivered_at) <= new Date(o.promised_at)) entry.onTime += 1;
      groupCur.set(o.driver_id, entry);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { total: number; onTime: number }>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const entry = groupPrev.get(o.driver_id) ?? { total: 0, onTime: 0 };
      entry.total += 1;
      if (new Date(o.delivered_at) <= new Date(o.promised_at)) entry.onTime += 1;
      groupPrev.set(o.driver_id, entry);
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:        id,
      fahrer_name:      v.name || id.slice(0, 8),
      puenktlichkeit_pct: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
    }));

    // absteigend: Rang 1 = höchste Pünktlichkeit = bester
    const sorted = [...unsorted].sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pPct = p && p.total > 0 ? Math.round((p.onTime / p.total) * 100) : f.puenktlichkeit_pct;
      return { fahrer_id: f.fahrer_id, puenktlichkeit_pct: pPct };
    }).sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:          f.fahrer_id,
        fahrer_name:        f.fahrer_name,
        rang,
        puenktlichkeit_pct: f.puenktlichkeit_pct,
        rank_delta:         prevRang - rang,
        ampel,
        alert_niedrig:      f.puenktlichkeit_pct < 80,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      sorted.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / total
    );

    return NextResponse.json({
      fahrer,
      team_avg_pct:  teamAvg,
      bester_name:   sorted[0]?.fahrer_name ?? '',
      letzter_name:  sorted[total - 1]?.fahrer_name ?? '',
      alert_count:   teamAvg < 80 ? 1 : 0,
      gesamt:        total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
