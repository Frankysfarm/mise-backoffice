import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5626 — Fahrer-Tourdauer-Trend-Ranking (Batch 101)
// avg Tourdauer (departed_at → delivered_at in Minuten), letzter 30 Tage vs. vorherige 30 Tage
// tourdauer_delta_min = aktuell_avg_min − vorher_avg_min (negativ = schneller = Verbesserung)
// AUFSTEIGEND: kleinster delta (größte Verkürzung) = Rang 1 = bester
// alert_rueckfall: tourdauer_delta_min > +5.0 min

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerTourdauerTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  tourdauer_delta_min: number;
  aktuell_avg_min: number;
  vorher_avg_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface TourdauerTrendRankingResponse {
  fahrer: FahrerTourdauerTrendRow[];
  team_avg_delta_min: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: TourdauerTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, tourdauer_delta_min: -4.2, aktuell_avg_min: 22.1, vorher_avg_min: 26.3, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, tourdauer_delta_min: -1.8, aktuell_avg_min: 24.5, vorher_avg_min: 26.3, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, tourdauer_delta_min:  0.5, aktuell_avg_min: 27.8, vorher_avg_min: 27.3, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, tourdauer_delta_min:  6.3, aktuell_avg_min: 35.1, vorher_avg_min: 28.8, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta_min: 0.2,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
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

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = await createClient();
    const now    = new Date();
    const ms30   = 30 * 24 * 60 * 60 * 1000;
    const since60  = new Date(now.getTime() - 2 * ms30).toISOString();
    const cutoff30 = new Date(now.getTime() - ms30).toISOString();

    const { data: tours } = await sb
      .from('delivery_tours')
      .select('driver_id, driver_name, created_at, departed_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', since60)
      .not('driver_id', 'is', null)
      .not('departed_at', 'is', null)
      .not('delivered_at', 'is', null);

    if (!tours || tours.length === 0) return NextResponse.json(MOCK);

    type Acc = {
      name: string;
      recentSum: number; recentN: number;
      olderSum: number;  olderN: number;
    };
    const map = new Map<string, Acc>();

    for (const t of tours) {
      if (!t.driver_id || !t.departed_at || !t.delivered_at) continue;
      const durationMin = (new Date(t.delivered_at as string).getTime() - new Date(t.departed_at as string).getTime()) / 60_000;
      if (durationMin < 0 || durationMin > 240) continue;

      const entry = map.get(t.driver_id) ?? {
        name: (t.driver_name as string | null) ?? t.driver_id,
        recentSum: 0, recentN: 0,
        olderSum: 0,  olderN: 0,
      };

      if ((t.created_at as string) >= cutoff30) {
        entry.recentSum += durationMin;
        entry.recentN   += 1;
      } else {
        entry.olderSum += durationMin;
        entry.olderN   += 1;
      }

      map.set(t.driver_id, entry);
    }

    if (map.size === 0) return NextResponse.json(MOCK);

    type Candidate = {
      fahrer_id: string;
      fahrer_name: string;
      tourdauer_delta_min: number;
      aktuell_avg_min: number;
      vorher_avg_min: number;
    };
    const candidates: Candidate[] = [];

    for (const [id, acc] of map.entries()) {
      if (acc.recentN === 0) continue;
      const aktuell = Math.round((acc.recentSum / acc.recentN) * 10) / 10;
      const vorher  = acc.olderN > 0 ? Math.round((acc.olderSum / acc.olderN) * 10) / 10 : aktuell;
      const delta   = Math.round((aktuell - vorher) * 10) / 10;
      candidates.push({ fahrer_id: id, fahrer_name: acc.name || id.slice(0, 8), tourdauer_delta_min: delta, aktuell_avg_min: aktuell, vorher_avg_min: vorher });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    // AUFSTEIGEND: kleinster delta (größte Verkürzung) = Rang 1
    candidates.sort((a, b) => a.tourdauer_delta_min - b.tourdauer_delta_min);
    const gesamt    = candidates.length;
    const teamDelta = Math.round((candidates.reduce((s, c) => s + c.tourdauer_delta_min, 0) / gesamt) * 10) / 10;

    let fahrer: FahrerTourdauerTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:          c.fahrer_id,
      fahrer_name:        c.fahrer_name,
      rang:               i + 1,
      tourdauer_delta_min: c.tourdauer_delta_min,
      aktuell_avg_min:    c.aktuell_avg_min,
      vorher_avg_min:     c.vorher_avg_min,
      rank_delta:         0,
      ampel:              assignAmpel(i + 1, gesamt),
      alert_rueckfall:    c.tourdauer_delta_min > 5.0,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: TourdauerTrendRankingResponse = {
      fahrer,
      team_avg_delta_min: teamDelta,
      schnellste_name:   candidates[0]?.fahrer_name ?? '—',
      langsamste_name:   candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:       fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    } satisfies TourdauerTrendRankingResponse;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
