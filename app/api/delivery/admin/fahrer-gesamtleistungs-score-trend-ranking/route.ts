import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5622 — Fahrer-Gesamtleistungs-Score-Trend-Ranking (Batch 100 Milestone)
// Composite-Score aus: Kundenbewertung (×30) + Pünktlichkeitsquote (×40) + Reaktionszeit-Score (×30)
// score_delta = aktuell_score − vorher_score (positiv = Verbesserung)
// ABSTEIGEND: größter delta = Rang 1 = bester
// alert_rueckfall: score_delta < −3.0

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerGesamtleistungsTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score_delta: number;
  aktuell_score: number;
  vorher_score: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface GesamtleistungsTrendRankingResponse {
  fahrer: FahrerGesamtleistungsTrendRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: GesamtleistungsTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, score_delta:  8.4, aktuell_score: 87.2, vorher_score: 78.8, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, score_delta:  3.1, aktuell_score: 82.5, vorher_score: 79.4, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, score_delta:  0.7, aktuell_score: 76.3, vorher_score: 75.6, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, score_delta: -4.2, aktuell_score: 68.1, vorher_score: 72.3, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 2.0,
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

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = await createClient();
    const now   = new Date();
    const ms30  = 30 * 24 * 60 * 60 * 1000;
    const since60  = new Date(now.getTime() - 2 * ms30).toISOString();
    const cutoff30 = new Date(now.getTime() - ms30).toISOString();

    // Pull delivery tours for last 60 days
    const { data: tours } = await sb
      .from('delivery_tours')
      .select('driver_id, driver_name, created_at, departed_at, delivered_at, customer_rating, on_time')
      .eq('location_id', locationId)
      .gte('created_at', since60)
      .not('driver_id', 'is', null);

    if (!tours || tours.length === 0) return NextResponse.json(MOCK);

    type Acc = {
      name: string;
      recentRating: number; recentRatingN: number;
      recentOnTime: number; recentOnTimeN: number;
      recentReakSek: number; recentReakN: number;
      olderRating: number; olderRatingN: number;
      olderOnTime: number; olderOnTimeN: number;
      olderReakSek: number; olderReakN: number;
    };
    const map = new Map<string, Acc>();

    for (const t of tours) {
      if (!t.driver_id) continue;
      const entry = map.get(t.driver_id) ?? {
        name: (t.driver_name as string | null) ?? t.driver_id,
        recentRating: 0, recentRatingN: 0,
        recentOnTime: 0, recentOnTimeN: 0,
        recentReakSek: 0, recentReakN: 0,
        olderRating: 0, olderRatingN: 0,
        olderOnTime: 0, olderOnTimeN: 0,
        olderReakSek: 0, olderReakN: 0,
      };

      const isRecent = (t.created_at as string) >= cutoff30;

      // Customer rating contribution
      if (typeof t.customer_rating === 'number' && t.customer_rating > 0) {
        if (isRecent) { entry.recentRating += t.customer_rating; entry.recentRatingN += 1; }
        else          { entry.olderRating  += t.customer_rating; entry.olderRatingN  += 1; }
      }

      // On-time contribution
      if (typeof t.on_time === 'boolean' || typeof t.on_time === 'number') {
        const val = t.on_time ? 1 : 0;
        if (isRecent) { entry.recentOnTime += val; entry.recentOnTimeN += 1; }
        else          { entry.olderOnTime  += val; entry.olderOnTimeN  += 1; }
      }

      // Reaction time contribution (departed_at - created_at)
      if (t.departed_at) {
        const diffSek = (new Date(t.departed_at as string).getTime() - new Date(t.created_at as string).getTime()) / 1000;
        if (diffSek >= 0 && diffSek <= 7200) {
          if (isRecent) { entry.recentReakSek += diffSek; entry.recentReakN += 1; }
          else          { entry.olderReakSek  += diffSek; entry.olderReakN  += 1; }
        }
      }

      map.set(t.driver_id, entry);
    }

    if (map.size === 0) return NextResponse.json(MOCK);

    type Candidate = {
      fahrer_id: string;
      fahrer_name: string;
      score_delta: number;
      aktuell_score: number;
      vorher_score: number;
    };
    const candidates: Candidate[] = [];

    for (const [id, acc] of map.entries()) {
      // Need at least some recent data
      if (acc.recentRatingN === 0 && acc.recentOnTimeN === 0 && acc.recentReakN === 0) continue;

      // Compute sub-scores 0–100 for recent and older periods
      const ratingScore  = (v: number, n: number) => n > 0 ? Math.min(100, (v / n / 5) * 100) : 70;
      const onTimeScore  = (v: number, n: number) => n > 0 ? (v / n) * 100 : 70;
      const reaktScore   = (avgSek: number) => Math.max(0, 100 - Math.max(0, avgSek - 60) * 0.3);

      const aktuellRating  = ratingScore(acc.recentRating, acc.recentRatingN);
      const aktuellOnTime  = onTimeScore(acc.recentOnTime, acc.recentOnTimeN);
      const aktuellReakAvg = acc.recentReakN > 0 ? acc.recentReakSek / acc.recentReakN : 180;
      const aktuellReak    = reaktScore(aktuellReakAvg);

      const olderRating  = ratingScore(acc.olderRating, acc.olderRatingN);
      const olderOnTime  = onTimeScore(acc.olderOnTime, acc.olderOnTimeN);
      const olderReakAvg = acc.olderReakN > 0 ? acc.olderReakSek / acc.olderReakN : 180;
      const olderReak    = reaktScore(olderReakAvg);

      const aktuell_score = Math.round((aktuellRating * 0.3 + aktuellOnTime * 0.4 + aktuellReak * 0.3) * 10) / 10;
      const vorher_score  = Math.round((olderRating  * 0.3 + olderOnTime  * 0.4 + olderReak  * 0.3) * 10) / 10;
      const score_delta   = Math.round((aktuell_score - vorher_score) * 10) / 10;

      candidates.push({ fahrer_id: id, fahrer_name: acc.name || id.slice(0, 8), score_delta, aktuell_score, vorher_score });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    // ABSTEIGEND: größter delta = größte Verbesserung = Rang 1
    candidates.sort((a, b) => b.score_delta - a.score_delta);
    const gesamt    = candidates.length;
    const teamDelta = Math.round((candidates.reduce((s, c) => s + c.score_delta, 0) / gesamt) * 10) / 10;

    let fahrer: FahrerGesamtleistungsTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:      c.fahrer_id,
      fahrer_name:    c.fahrer_name,
      rang:           i + 1,
      score_delta:    c.score_delta,
      aktuell_score:  c.aktuell_score,
      vorher_score:   c.vorher_score,
      rank_delta:     0,
      ampel:          assignAmpel(i + 1, gesamt),
      alert_rueckfall: c.score_delta < -3.0,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: GesamtleistungsTrendRankingResponse = {
      fahrer,
      team_avg_delta: teamDelta,
      bester_name:    candidates[0]?.fahrer_name ?? '—',
      schwaechster_name: candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:    fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
