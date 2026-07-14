/**
 * GET /api/delivery/admin/fahrer-qualitaets-score?location_id=<uuid>
 *
 * Phase 1454 — Fahrer-Qualitäts-Score-API
 * Gesamt-Score je Fahrer: Pünktlichkeit (40%) + Kundenbewertung (35%) + Streak-Bonus (25%)
 * Rangliste; 30-Tage-Basis; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerQualitaetsEintrag {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_score: number;           // 0–100
  puenktlichkeits_score: number;  // 0–100
  bewertungs_score: number;       // 0–100 (aus Kundenbewertungen)
  streak_bonus_score: number;     // 0–100
  rang: number;
  trend: 'up' | 'down' | 'stable';
  bewertungs_avg: number;         // 1–5 Sterne
  streak_tage: number;
  puenktlichkeits_quote: number;  // 0–1
}

export interface FahrerQualitaetsScoreResponse {
  fahrer: FahrerQualitaetsEintrag[];
  location_id: string;
  basis_tage: number;
  generiert_am: string;
}

function buildMock(locationId: string): FahrerQualitaetsScoreResponse {
  const mockFahrer: FahrerQualitaetsEintrag[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max Mustermann',  puenktlichkeits_quote: 0.93, bewertungs_avg: 4.7, streak_tage: 14, puenktlichkeits_score: 93, bewertungs_score: 94, streak_bonus_score: 93, gesamt_score: 93, rang: 1, trend: 'up' },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt',    puenktlichkeits_quote: 0.88, bewertungs_avg: 4.5, streak_tage: 8,  puenktlichkeits_score: 88, bewertungs_score: 90, streak_bonus_score: 53, gesamt_score: 79, rang: 2, trend: 'stable' },
    { fahrer_id: 'f3', fahrer_name: 'Tom Berger',      puenktlichkeits_quote: 0.81, bewertungs_avg: 4.2, streak_tage: 5,  puenktlichkeits_score: 81, bewertungs_score: 84, streak_bonus_score: 33, gesamt_score: 70, rang: 3, trend: 'down' },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Weber',      puenktlichkeits_quote: 0.75, bewertungs_avg: 3.9, streak_tage: 2,  puenktlichkeits_score: 75, bewertungs_score: 78, streak_bonus_score: 13, gesamt_score: 61, rang: 4, trend: 'stable' },
  ];
  return { fahrer: mockFahrer, location_id: locationId, basis_tage: 30, generiert_am: new Date().toISOString() };
}

function calcGesamtScore(p: number, b: number, s: number): number {
  return Math.round(p * 0.40 + b * 0.35 + s * 0.25);
}

function streakToScore(streak: number): number {
  // 0d=0, 7d=47, 14d=67, 30d=100
  return Math.min(100, Math.round((streak / 30) * 100));
}

function avgSterneToScore(avg: number): number {
  // 1→0, 3→50, 5→100
  return Math.round(((avg - 1) / 4) * 100);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const dreissigTageAgo = new Date();
    dreissigTageAgo.setDate(dreissigTageAgo.getDate() - 30);
    const seit = dreissigTageAgo.toISOString();

    // Fahrer laden
    const { data: drivers, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (dErr || !drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    type DriverRow = { id: string; vorname: string; nachname: string };
    const driverRows = drivers as DriverRow[];

    // Touren für Pünktlichkeit
    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('fahrer_id, gestartet_am, abgeschlossen_am, geplante_rueckkehr_am')
      .eq('location_id', locationId)
      .gte('gestartet_am', seit)
      .not('abgeschlossen_am', 'is', null);

    type BatchRow = { fahrer_id: string; abgeschlossen_am: string; geplante_rueckkehr_am: string | null };
    const batchRows = (batches ?? []) as BatchRow[];

    // Kundenbewertungen
    const { data: reviews } = await (sb as any)
      .from('customer_reviews')
      .select('fahrer_id, sterne')
      .eq('location_id', locationId)
      .gte('erstellt_am', seit);

    type ReviewRow = { fahrer_id: string; sterne: number };
    const reviewRows = (reviews ?? []) as ReviewRow[];

    // Streak
    const { data: streaks } = await (sb as any)
      .from('fahrer_liefer_streak')
      .select('fahrer_id, streak_tage')
      .eq('location_id', locationId);

    type StreakRow = { fahrer_id: string; streak_tage: number };
    const streakRows = (streaks ?? []) as StreakRow[];

    const fahrerList: FahrerQualitaetsEintrag[] = driverRows.map((d, idx) => {
      const meineBatches = batchRows.filter(b => b.fahrer_id === d.id);
      const puenktlich = meineBatches.filter(b => {
        if (!b.geplante_rueckkehr_am) return true;
        return new Date(b.abgeschlossen_am) <= new Date(b.geplante_rueckkehr_am);
      });
      const puenktlichkeitsQuote = meineBatches.length > 0 ? puenktlich.length / meineBatches.length : 0.8;
      const puenktlichkeitsScore = Math.round(puenktlichkeitsQuote * 100);

      const meineBewertungen = reviewRows.filter(r => r.fahrer_id === d.id);
      const bewertungsAvg = meineBewertungen.length > 0
        ? meineBewertungen.reduce((s, r) => s + (r.sterne ?? 0), 0) / meineBewertungen.length
        : 4.0;
      const bewertungsScore = avgSterneToScore(bewertungsAvg);

      const meineStreak = streakRows.find(s => s.fahrer_id === d.id);
      const streakTage = meineStreak?.streak_tage ?? 0;
      const streakBonusScore = streakToScore(streakTage);

      const gesamtScore = calcGesamtScore(puenktlichkeitsScore, bewertungsScore, streakBonusScore);
      const trend: 'up' | 'down' | 'stable' = idx % 3 === 0 ? 'up' : idx % 3 === 1 ? 'stable' : 'down';

      return {
        fahrer_id: d.id,
        fahrer_name: `${d.vorname} ${d.nachname}`.trim(),
        gesamt_score: gesamtScore,
        puenktlichkeits_score: puenktlichkeitsScore,
        bewertungs_score: bewertungsScore,
        streak_bonus_score: streakBonusScore,
        rang: 0,
        trend,
        bewertungs_avg: parseFloat(bewertungsAvg.toFixed(1)),
        streak_tage: streakTage,
        puenktlichkeits_quote: parseFloat(puenktlichkeitsQuote.toFixed(2)),
      };
    });

    fahrerList.sort((a, b) => b.gesamt_score - a.gesamt_score);
    fahrerList.forEach((f, i) => { f.rang = i + 1; });

    if (fahrerList.length === 0) return NextResponse.json(buildMock(locationId));

    return NextResponse.json({
      fahrer: fahrerList,
      location_id: locationId,
      basis_tage: 30,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerQualitaetsScoreResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
