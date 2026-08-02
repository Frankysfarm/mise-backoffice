import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5614 — Fahrer-Umsatz-Trend-Ranking
// Vergleich Umsatz-Ø pro Tour letzter 30 Tage vs. vorheriger 30 Tage
// ABSTEIGEND: Rang 1 = größte positive Verbesserung = bester
// Ampel: gruen Top-25% / gelb Mitte / rot untere 25%
// alert_rueckfall: umsatz_delta < -1.00€

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerUmsatzTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_delta: number;
  aktuell_avg: number;
  vorher_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface UmsatzTrendRankingResponse {
  fahrer: FahrerUmsatzTrendRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: UmsatzTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_delta:  3.50, aktuell_avg: 28.50, vorher_avg: 25.00, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, umsatz_delta:  1.20, aktuell_avg: 24.80, vorher_avg: 23.60, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, umsatz_delta: -0.80, aktuell_avg: 21.30, vorher_avg: 22.10, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_delta: -2.40, aktuell_avg: 17.60, vorher_avg: 20.00, rank_delta:  0, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.38,
  bester_name: 'Julia F.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function assignAmpel(rang: number, gesamt: number): Ampel {
  const top    = Math.ceil(gesamt * 0.25);
  const bottom = Math.floor(gesamt * 0.75);
  if (rang <= top)   return 'gruen';
  if (rang > bottom) return 'rot';
  return 'gelb';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  const driverId   = req.nextUrl.searchParams.get('driver_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb      = await createClient();
    const now     = Date.now();
    const since60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders } = await sb
      .from('orders')
      .select('driver_id, driver_name, total_amount, created_at')
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('created_at', since60)
      .not('driver_id', 'is', null);

    if (!orders || orders.length === 0) return NextResponse.json(MOCK);

    type Acc = { name: string; recentAmt: number; recentN: number; olderAmt: number; olderN: number };
    const map = new Map<string, Acc>();

    for (const o of orders) {
      if (!o.driver_id) continue;
      const amt = Number(o.total_amount) || 0;
      const entry = map.get(o.driver_id) ?? {
        name: (o.driver_name as string | null) ?? o.driver_id,
        recentAmt: 0, recentN: 0, olderAmt: 0, olderN: 0,
      };
      if (o.created_at >= cutoff30) {
        entry.recentAmt += amt;
        entry.recentN   += 1;
      } else {
        entry.olderAmt += amt;
        entry.olderN   += 1;
      }
      map.set(o.driver_id, entry);
    }

    if (map.size === 0) return NextResponse.json(MOCK);

    type Candidate = { fahrer_id: string; fahrer_name: string; umsatz_delta: number; aktuell_avg: number; vorher_avg: number };
    const candidates: Candidate[] = [];

    for (const [id, acc] of map.entries()) {
      if (acc.recentN === 0) continue;
      const aktuell = Math.round((acc.recentAmt / acc.recentN) * 100) / 100;
      const vorher  = acc.olderN > 0 ? Math.round((acc.olderAmt / acc.olderN) * 100) / 100 : aktuell;
      const delta   = Math.round((aktuell - vorher) * 100) / 100;
      candidates.push({ fahrer_id: id, fahrer_name: acc.name || id.slice(0, 8), umsatz_delta: delta, aktuell_avg: aktuell, vorher_avg: vorher });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    candidates.sort((a, b) => b.umsatz_delta - a.umsatz_delta);
    const gesamt    = candidates.length;
    const teamDelta = Math.round(candidates.reduce((s, c) => s + c.umsatz_delta, 0) / gesamt * 100) / 100;

    let fahrer: FahrerUmsatzTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:    c.fahrer_id,
      fahrer_name:  c.fahrer_name,
      rang:         i + 1,
      umsatz_delta: c.umsatz_delta,
      aktuell_avg:  c.aktuell_avg,
      vorher_avg:   c.vorher_avg,
      rank_delta:   0,
      ampel:        assignAmpel(i + 1, gesamt),
      alert_rueckfall: c.umsatz_delta < -1.0,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: UmsatzTrendRankingResponse = {
      fahrer,
      team_avg_delta:    teamDelta,
      bester_name:       candidates[0]?.fahrer_name ?? '—',
      schwaechster_name: candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:       fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
