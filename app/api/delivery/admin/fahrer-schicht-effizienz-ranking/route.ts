import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_effizienz: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, effizienz_pro_stunde: 38, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, effizienz_pro_stunde: 31, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, effizienz_pro_stunde: 24, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, effizienz_pro_stunde: 17, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_effizienz: 27.5,
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
    const since30  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30   = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, total_price, shift_hours')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', since30)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, total_price, shift_hours')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30)
        .lt('created_at', since30)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; umsatz: number; stunden: number };
    const groupCur = new Map<string, Acc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, umsatz: 0, stunden: 0 };
      groupCur.set(o.driver_id, {
        name:    prev.name,
        umsatz:  prev.umsatz + (Number(o.total_price) || 0),
        stunden: prev.stunden + (Number(o.shift_hours) || 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { umsatz: number; stunden: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { umsatz: 0, stunden: 0 };
      groupPrev.set(o.driver_id, {
        umsatz:  prev.umsatz + (Number(o.total_price) || 0),
        stunden: prev.stunden + (Number(o.shift_hours) || 0),
      });
    }

    const effVon = (umsatz: number, stunden: number) =>
      stunden > 0 ? Math.round((umsatz / stunden) * 100) / 100 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name || id.slice(0, 8),
      effizienz:   effVon(v.umsatz, v.stunden),
    }));

    const sorted  = [...unsorted].sort((a, b) => b.effizienz - a.effizienz);
    const gesamt  = sorted.length;

    const prevSorted = unsorted
      .map(f => {
        const p = groupPrev.get(f.fahrer_id);
        return { fahrer_id: f.fahrer_id, eff: p ? effVon(p.umsatz, p.stunden) : f.effizienz };
      })
      .sort((a, b) => b.eff - a.eff);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:            f.fahrer_id,
        fahrer_name:          f.fahrer_name,
        rang,
        effizienz_pro_stunde: f.effizienz,
        rank_delta:           prevRang - rang,
        ampel:                ampelVon(rang, gesamt),
        alert_niedrig:        f.effizienz < 20,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.effizienz, 0) / gesamt) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_effizienz: teamAvg,
      beste_name:         sorted[0]?.fahrer_name ?? '',
      niedrigste_name:    sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:        fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
