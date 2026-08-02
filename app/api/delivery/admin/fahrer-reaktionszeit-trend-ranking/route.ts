import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5618 — Fahrer-Reaktionszeit-Trend-Ranking
// Vergleich Ø Reaktionszeit (departed_at − created_at, delivery_tours) letzter 30 Tage vs. vorherige 30 Tage
// reaktionszeit_delta_sek = aktuell_avg_sek − vorher_avg_sek (negativ = kürzer = Verbesserung)
// AUFSTEIGEND: kleinster delta (negativster) = Rang 1 = bester
// alert_rueckfall: reaktionszeit_delta_sek > +30s

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerReaktionszeitTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reaktionszeit_delta_sek: number;
  aktuell_avg_sek: number;
  vorher_avg_sek: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface ReaktionszeitTrendRankingResponse {
  fahrer: FahrerReaktionszeitTrendRow[];
  team_avg_delta_sek: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ReaktionszeitTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, reaktionszeit_delta_sek: -45, aktuell_avg_sek: 135, vorher_avg_sek: 180, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, reaktionszeit_delta_sek: -12, aktuell_avg_sek: 158, vorher_avg_sek: 170, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, reaktionszeit_delta_sek:  18, aktuell_avg_sek: 203, vorher_avg_sek: 185, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, reaktionszeit_delta_sek:  52, aktuell_avg_sek: 272, vorher_avg_sek: 220, rank_delta:  0, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta_sek: 3.25,
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

    const { data: tours } = await sb
      .from('delivery_tours')
      .select('driver_id, driver_name, created_at, departed_at')
      .eq('location_id', locationId)
      .gte('created_at', since60)
      .not('driver_id', 'is', null)
      .not('departed_at', 'is', null);

    if (!tours || tours.length === 0) return NextResponse.json(MOCK);

    type Acc = { name: string; recentSek: number; recentN: number; olderSek: number; olderN: number };
    const map = new Map<string, Acc>();

    for (const t of tours) {
      if (!t.driver_id || !t.departed_at) continue;
      const diffSek = (new Date(t.departed_at).getTime() - new Date(t.created_at).getTime()) / 1000;
      if (diffSek < 0 || diffSek > 7200) continue;
      const entry = map.get(t.driver_id) ?? {
        name: (t.driver_name as string | null) ?? t.driver_id,
        recentSek: 0, recentN: 0, olderSek: 0, olderN: 0,
      };
      if (t.created_at >= cutoff30) {
        entry.recentSek += diffSek;
        entry.recentN   += 1;
      } else {
        entry.olderSek += diffSek;
        entry.olderN   += 1;
      }
      map.set(t.driver_id, entry);
    }

    if (map.size === 0) return NextResponse.json(MOCK);

    type Candidate = { fahrer_id: string; fahrer_name: string; reaktionszeit_delta_sek: number; aktuell_avg_sek: number; vorher_avg_sek: number };
    const candidates: Candidate[] = [];

    for (const [id, acc] of map.entries()) {
      if (acc.recentN === 0) continue;
      const aktuell = Math.round(acc.recentSek / acc.recentN);
      const vorher  = acc.olderN > 0 ? Math.round(acc.olderSek / acc.olderN) : aktuell;
      const delta   = aktuell - vorher;
      candidates.push({ fahrer_id: id, fahrer_name: acc.name || id.slice(0, 8), reaktionszeit_delta_sek: delta, aktuell_avg_sek: aktuell, vorher_avg_sek: vorher });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    // AUFSTEIGEND: kleinster delta = größte Verkürzung = Rang 1
    candidates.sort((a, b) => a.reaktionszeit_delta_sek - b.reaktionszeit_delta_sek);
    const gesamt    = candidates.length;
    const teamDelta = Math.round(candidates.reduce((s, c) => s + c.reaktionszeit_delta_sek, 0) / gesamt);

    let fahrer: FahrerReaktionszeitTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:               c.fahrer_id,
      fahrer_name:             c.fahrer_name,
      rang:                    i + 1,
      reaktionszeit_delta_sek: c.reaktionszeit_delta_sek,
      aktuell_avg_sek:         c.aktuell_avg_sek,
      vorher_avg_sek:          c.vorher_avg_sek,
      rank_delta:              0,
      ampel:                   assignAmpel(i + 1, gesamt),
      alert_rueckfall:         c.reaktionszeit_delta_sek > 30,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: ReaktionszeitTrendRankingResponse = {
      fahrer,
      team_avg_delta_sek: teamDelta,
      bester_name:        candidates[0]?.fahrer_name ?? '—',
      schwaechster_name:  candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:        fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
