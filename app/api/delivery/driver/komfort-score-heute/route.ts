/**
 * GET /api/delivery/driver/komfort-score-heute?driver_id=<uuid>
 *
 * Phase 1651 — Fahrer-Komfort-Score-API
 * Pausen-Minuten + km-Summe + Tour-Anzahl + Score heute.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KomfortScoreResponse {
  driver_id: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number; // 0–100
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
  generiert_am: string;
}

function calcKomfortScore(pausen_min: number, km: number, touren: number): number {
  // Score steigt mit Pausen, fällt mit km und Touren-Last
  const pausenScore = Math.min(100, pausen_min * 2);           // 50 Min Pause → 100
  const kmPenalty  = Math.min(60, km * 0.4);                   // 150 km → -60
  const tourPenalty = Math.min(30, touren * 3);                // 10 Touren → -30
  return Math.max(0, Math.round(pausenScore - kmPenalty - tourPenalty));
}

function calcEmpfehlung(score: number, km: number): KomfortScoreResponse['empfehlung'] {
  if (score < 30 || km > 200) return 'schicht_ende';
  if (score < 55) return 'pause';
  return 'weiter';
}

function buildMock(driverId: string): KomfortScoreResponse {
  const pausen_minuten = 25;
  const km_gesamt = 68;
  const tour_anzahl = 7;
  const komfort_score = calcKomfortScore(pausen_minuten, km_gesamt, tour_anzahl);
  return {
    driver_id: driverId,
    pausen_minuten,
    km_gesamt,
    tour_anzahl,
    komfort_score,
    empfehlung: calcEmpfehlung(komfort_score, km_gesamt),
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    // Start of today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Abgeschlossene Touren heute
    const { data: batches, error: bErr } = await (sb as any)
      .from('delivery_batches')
      .select('id, gestartet_am, abgeschlossen_am, route_km')
      .eq('driver_id', driverId)
      .not('abgeschlossen_am', 'is', null)
      .gte('gestartet_am', todayStart.toISOString());

    if (bErr || !batches) return NextResponse.json(buildMock(driverId));

    const tour_anzahl = batches.length;
    const km_gesamt = Math.round(
      batches.reduce((acc: number, b: any) => acc + (b.route_km ?? 0), 0)
    );

    // Pausen: Lücken zwischen abgeschlossen_am[i] und gestartet_am[i+1]
    const sorted = [...batches].sort((a: any, b: any) =>
      new Date(a.gestartet_am).getTime() - new Date(b.gestartet_am).getTime()
    );
    let pausen_minuten = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].gestartet_am).getTime() - new Date(sorted[i - 1].abgeschlossen_am).getTime();
      const gapMin = gap / 60_000;
      // Lücken zwischen 5 und 90 Minuten zählen als Pause
      if (gapMin >= 5 && gapMin <= 90) pausen_minuten += Math.round(gapMin);
    }

    const komfort_score = calcKomfortScore(pausen_minuten, km_gesamt, tour_anzahl);
    return NextResponse.json({
      driver_id: driverId,
      pausen_minuten,
      km_gesamt,
      tour_anzahl,
      komfort_score,
      empfehlung: calcEmpfehlung(komfort_score, km_gesamt),
      generiert_am: new Date().toISOString(),
    } satisfies KomfortScoreResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
