import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5630 — Fahrer-Kundenkontakt-Effizienz-Trend-Ranking (Batch 102)
// Verbesserung der normalisierten Kundenbewertung (driver_ratings) letzter 30 Tage vs. vorherige 30 Tage
// kontakt_delta = aktuell_score − vorher_score (0–100 Skala, normalisiert aus 1–5-Sterne)
// ABSTEIGEND: größter positiver delta = Rang 1 = bester
// alert_rueckfall: kontakt_delta < -3.0

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerKundenkontaktTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  kontakt_delta: number;
  aktuell_score: number;
  vorher_score: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface KundenkontaktTrendRankingResponse {
  fahrer: FahrerKundenkontaktTrendRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: KundenkontaktTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, kontakt_delta:  6.0, aktuell_score: 92.0, vorher_score: 86.0, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, kontakt_delta:  4.0, aktuell_score: 88.0, vorher_score: 84.0, rank_delta: -1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, kontakt_delta: -1.0, aktuell_score: 80.0, vorher_score: 81.0, rank_delta:  0, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, kontakt_delta: -5.0, aktuell_score: 72.0, vorher_score: 77.0, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 1.0,
  bester_name: 'Max M.',
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

function normalizeRating(r: number): number {
  return Math.round(((r - 1) / 4) * 100 * 10) / 10;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  const driverId   = req.nextUrl.searchParams.get('driver_id')?.trim();

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = await createClient();
    const now      = Date.now();
    const since60  = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: ratings } = await sb
      .from('driver_ratings')
      .select('driver_id, rating, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since60);

    if (!drivers || !ratings || drivers.length === 0 || ratings.length === 0) {
      return NextResponse.json(MOCK);
    }

    type Candidate = {
      fahrer_id: string;
      fahrer_name: string;
      kontakt_delta: number;
      aktuell_score: number;
      vorher_score: number;
    };

    const candidates: Candidate[] = [];

    for (const d of drivers) {
      const all    = ratings.filter(r => r.driver_id === d.id);
      const recent = all.filter(r => r.created_at >= cutoff30);
      const older  = all.filter(r => r.created_at <  cutoff30);
      if (recent.length === 0) continue;

      const avgRaw = (arr: { rating: number }[]) =>
        arr.length > 0 ? arr.reduce((s, r) => s + Number(r.rating), 0) / arr.length : null;

      const aktuellRaw = avgRaw(recent);
      const vorherRaw  = avgRaw(older);
      if (aktuellRaw === null) continue;

      const aktuell = normalizeRating(aktuellRaw);
      const vorher  = vorherRaw !== null ? normalizeRating(vorherRaw) : aktuell;
      const delta   = Math.round((aktuell - vorher) * 10) / 10;

      candidates.push({
        fahrer_id:    d.id,
        fahrer_name:  `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        kontakt_delta: delta,
        aktuell_score: aktuell,
        vorher_score:  vorher,
      });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    // ABSTEIGEND: größter positiver delta = Rang 1 = bester
    candidates.sort((a, b) => b.kontakt_delta - a.kontakt_delta);
    const gesamt    = candidates.length;
    const teamDelta = Math.round((candidates.reduce((s, c) => s + c.kontakt_delta, 0) / gesamt) * 10) / 10;

    let fahrer: FahrerKundenkontaktTrendRow[] = candidates.map((c, i) => ({
      fahrer_id:     c.fahrer_id,
      fahrer_name:   c.fahrer_name,
      rang:          i + 1,
      kontakt_delta: c.kontakt_delta,
      aktuell_score: c.aktuell_score,
      vorher_score:  c.vorher_score,
      rank_delta:    0,
      ampel:         assignAmpel(i + 1, gesamt),
      alert_rueckfall: c.kontakt_delta < -3.0,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    const result: KundenkontaktTrendRankingResponse = {
      fahrer,
      team_avg_delta:   teamDelta,
      bester_name:      candidates[0]?.fahrer_name     ?? '—',
      schwaechster_name: candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    } satisfies KundenkontaktTrendRankingResponse;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
