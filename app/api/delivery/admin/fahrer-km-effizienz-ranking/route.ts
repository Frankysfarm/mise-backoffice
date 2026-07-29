import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_eur_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_eur_pro_km: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_eur_pro_km: 12.40, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_eur_pro_km:  9.80, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_eur_pro_km:  7.20, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_eur_pro_km:  4.10, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_eur_pro_km: 8.38,
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

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, total_amount, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('distance_km', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, total_amount, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('distance_km', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; totalEur: number; totalKm: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id || !o.distance_km || Number(o.distance_km) <= 0) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, totalEur: 0, totalKm: 0 };
      groupCur.set(o.driver_id, {
        name:     prev.name,
        totalEur: prev.totalEur + (Number(o.total_amount) || 0),
        totalKm:  prev.totalKm  + Number(o.distance_km),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { totalEur: number; totalKm: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id || !o.distance_km || Number(o.distance_km) <= 0) continue;
      const prev = groupPrev.get(o.driver_id) ?? { totalEur: 0, totalKm: 0 };
      groupPrev.set(o.driver_id, {
        totalEur: prev.totalEur + (Number(o.total_amount) || 0),
        totalKm:  prev.totalKm  + Number(o.distance_km),
      });
    }

    const avgEurProKm = (acc: { totalEur: number; totalKm: number }) =>
      acc.totalKm > 0 ? Math.round((acc.totalEur / acc.totalKm) * 100) / 100 : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:      id,
      fahrer_name:    v.name || id.slice(0, 8),
      avg_eur_pro_km: avgEurProKm(v),
    }));

    // absteigend — höchster €/km = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.avg_eur_pro_km - a.avg_eur_pro_km);
    const gesamt = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p    = groupPrev.get(f.fahrer_id);
      const pVal = p ? avgEurProKm(p) : f.avg_eur_pro_km;
      return { fahrer_id: f.fahrer_id, avg_eur_pro_km: pVal };
    }).sort((a, b) => b.avg_eur_pro_km - a.avg_eur_pro_km);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:      f.fahrer_id,
        fahrer_name:    f.fahrer_name,
        rang,
        avg_eur_pro_km: f.avg_eur_pro_km,
        rank_delta:     prevRang - rang,
        ampel:          ampelVon(rang, gesamt),
        alert_niedrig:  f.avg_eur_pro_km < 5,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.avg_eur_pro_km, 0) / gesamt) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_eur_pro_km: teamAvg,
      beste_name:          sorted[0]?.fahrer_name ?? '',
      niedrigste_name:     sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:         fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
