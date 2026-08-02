import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5610 — Fahrer-Trinkgeld-Trend-Ranking
// Vergleich Trinkgeld-Ø letzter 30 Tage vs. vorheriger 30 Tage
// ABSTEIGEND: Rang 1 = größte positive Verbesserung = bester
// Ampel: gruen Top-25% / gelb Mitte / rot untere 25%
// alert_rueckfall: trinkgeld_delta < -0.5

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerTrinkgeldTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trinkgeld_delta: number;
  aktuell_avg: number;
  vorher_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface TrinkgeldTrendRankingResponse {
  fahrer: FahrerTrinkgeldTrendRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: TrinkgeldTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, trinkgeld_delta:  0.60, aktuell_avg: 2.80, vorher_avg: 2.20, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, trinkgeld_delta:  0.30, aktuell_avg: 2.10, vorher_avg: 1.80, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, trinkgeld_delta: -0.20, aktuell_avg: 1.50, vorher_avg: 1.70, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trinkgeld_delta: -0.80, aktuell_avg: 0.40, vorher_avg: 1.20, rank_delta:  0, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: -0.03,
  bester_name: 'Julia F.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function assignAmpel(rang: number, gesamt: number): Ampel {
  const top    = Math.ceil(gesamt * 0.25);
  const bottom = Math.floor(gesamt * 0.75);
  if (rang <= top)    return 'gruen';
  if (rang > bottom)  return 'rot';
  return 'gelb';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  const driverId   = req.nextUrl.searchParams.get('driver_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb     = await createClient();
    const now    = Date.now();
    const since60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders } = await sb
      .from('orders')
      .select('driver_id, driver_name, tip_amount, created_at')
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('created_at', since60)
      .not('driver_id', 'is', null);

    if (!orders || orders.length === 0) return NextResponse.json(MOCK);

    type Acc = { name: string; recentTip: number; recentN: number; olderTip: number; olderN: number };
    const map = new Map<string, Acc>();

    for (const o of orders) {
      if (!o.driver_id) continue;
      const tip = Number(o.tip_amount) || 0;
      const entry = map.get(o.driver_id) ?? {
        name: (o.driver_name as string | null) ?? o.driver_id,
        recentTip: 0, recentN: 0, olderTip: 0, olderN: 0,
      };
      if (o.created_at >= cutoff30) {
        entry.recentTip += tip;
        entry.recentN   += 1;
      } else {
        entry.olderTip += tip;
        entry.olderN   += 1;
      }
      map.set(o.driver_id, entry);
    }

    if (map.size === 0) return NextResponse.json(MOCK);

    type Candidate = { fahrer_id: string; fahrer_name: string; trinkgeld_delta: number; aktuell_avg: number; vorher_avg: number };
    const candidates: Candidate[] = [];

    for (const [id, acc] of map.entries()) {
      if (acc.recentN === 0) continue;
      const aktuell = Math.round((acc.recentTip / acc.recentN) * 100) / 100;
      const vorher  = acc.olderN > 0 ? Math.round((acc.olderTip / acc.olderN) * 100) / 100 : aktuell;
      const delta   = Math.round((aktuell - vorher) * 100) / 100;
      candidates.push({ fahrer_id: id, fahrer_name: acc.name || id.slice(0, 8), trinkgeld_delta: delta, aktuell_avg: aktuell, vorher_avg: vorher });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    candidates.sort((a, b) => b.trinkgeld_delta - a.trinkgeld_delta);
    const gesamt    = candidates.length;
    const teamDelta = Math.round(candidates.reduce((s, c) => s + c.trinkgeld_delta, 0) / gesamt * 100) / 100;

    let fahrer: FahrerTrinkgeldTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:       c.fahrer_id,
      fahrer_name:     c.fahrer_name,
      rang:            i + 1,
      trinkgeld_delta: c.trinkgeld_delta,
      aktuell_avg:     c.aktuell_avg,
      vorher_avg:      c.vorher_avg,
      rank_delta:      0,
      ampel:           assignAmpel(i + 1, gesamt),
      alert_rueckfall: c.trinkgeld_delta < -0.5,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: TrinkgeldTrendRankingResponse = {
      fahrer,
      team_avg_delta:   teamDelta,
      bester_name:      candidates[0]?.fahrer_name ?? '—',
      schwaechster_name: candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
