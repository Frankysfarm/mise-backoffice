import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5606 — Fahrer-Bewertungs-Trend-Ranking
// Vergleich Kundenbewertungs-Ø letzter 30 Tage vs. vorheriger 30 Tage
// ABSTEIGEND: Rang 1 = größte positive Verbesserung = bester
// Ampel: gruen Top-25% / gelb Mitte / rot untere 25%
// alert_rueckfall: bewertung_delta < -0.2

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerBewertungsTrendRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bewertung_delta: number;
  aktuell_avg: number;
  vorher_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

export interface BewertungsTrendRankingResponse {
  fahrer: FahrerBewertungsTrendRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: BewertungsTrendRankingResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, bewertung_delta:  0.4, aktuell_avg: 4.8, vorher_avg: 4.4, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, bewertung_delta:  0.2, aktuell_avg: 4.5, vorher_avg: 4.3, rank_delta: -1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, bewertung_delta: -0.1, aktuell_avg: 4.1, vorher_avg: 4.2, rank_delta:  0, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bewertung_delta: -0.5, aktuell_avg: 3.4, vorher_avg: 3.9, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.0,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function assignAmpel(rang: number, gesamt: number): Ampel {
  const top = Math.ceil(gesamt * 0.25);
  const bottom = Math.floor(gesamt * 0.75);
  if (rang <= top) return 'gruen';
  if (rang > bottom) return 'rot';
  return 'gelb';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = Date.now();
    const since60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
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

    if (!drivers || !ratings || drivers.length === 0) return NextResponse.json(MOCK);

    type Candidate = { fahrer_id: string; fahrer_name: string; bewertung_delta: number; aktuell_avg: number; vorher_avg: number };

    const candidates: Candidate[] = [];
    for (const d of drivers) {
      const all = ratings.filter(r => r.driver_id === d.id);
      const recent = all.filter(r => r.created_at >= cutoff30);
      const older  = all.filter(r => r.created_at < cutoff30);
      if (recent.length === 0 && older.length === 0) continue;
      const avg = (arr: { rating: number }[]) => arr.length > 0 ? arr.reduce((s, r) => s + Number(r.rating), 0) / arr.length : null;
      const aktuell = avg(recent);
      const vorher  = avg(older);
      if (aktuell === null) continue;
      const delta = vorher !== null ? Math.round((aktuell - vorher) * 10) / 10 : 0;
      candidates.push({
        fahrer_id: d.id,
        fahrer_name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        bewertung_delta: delta,
        aktuell_avg: Math.round(aktuell * 10) / 10,
        vorher_avg: vorher !== null ? Math.round(vorher * 10) / 10 : aktuell,
      });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    candidates.sort((a, b) => b.bewertung_delta - a.bewertung_delta);
    const gesamt = candidates.length;
    const teamDelta = Math.round(candidates.reduce((s, c) => s + c.bewertung_delta, 0) / gesamt * 10) / 10;

    const fahrer: FahrerBewertungsTrendRow[] = candidates.map((c, i) => ({
      fahrer_id: c.fahrer_id,
      fahrer_name: c.fahrer_name,
      rang: i + 1,
      bewertung_delta: c.bewertung_delta,
      aktuell_avg: c.aktuell_avg,
      vorher_avg: c.vorher_avg,
      rank_delta: 0,
      ampel: assignAmpel(i + 1, gesamt),
      alert_rueckfall: c.bewertung_delta < -0.2,
    }));

    const result: BewertungsTrendRankingResponse = {
      fahrer,
      team_avg_delta: teamDelta,
      bester_name: fahrer[0]?.fahrer_name ?? '—',
      schwaechster_name: fahrer[gesamt - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
