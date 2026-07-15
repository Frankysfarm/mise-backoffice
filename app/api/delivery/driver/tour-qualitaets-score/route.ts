/**
 * GET /api/delivery/driver/tour-qualitaets-score?driver_id=<uuid>
 *
 * Phase 1646 — Tour-Qualitäts-Score-API
 * Letzte 5 Touren je Fahrer: Pünktlichkeit + Kundenbewertung + Effizienz-Score.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TourScore {
  tour_id: string;
  datum: string;
  stopps_gesamt: number;
  stopps_puenktlich: number;
  puenktlichkeit_pct: number;
  kundenbewertung: number | null;
  effizienz_score: number;
  gesamt_score: number;
  badge: 'gold' | 'silber' | 'bronze' | 'keine';
}

interface TourQualitaetsScoreResponse {
  driver_id: string;
  touren: TourScore[];
  durchschnitt_gesamt: number;
  durchschnitt_puenktlichkeit_pct: number;
  durchschnitt_bewertung: number | null;
  generiert_am: string;
}

function calcBadge(score: number): TourScore['badge'] {
  if (score >= 85) return 'gold';
  if (score >= 70) return 'silber';
  if (score >= 50) return 'bronze';
  return 'keine';
}

function buildMock(driverId: string): TourQualitaetsScoreResponse {
  const now = Date.now();
  const touren: TourScore[] = [
    { tour_id: 'tour-1', datum: new Date(now - 0 * 86_400_000).toISOString(), stopps_gesamt: 5, stopps_puenktlich: 5, puenktlichkeit_pct: 100, kundenbewertung: 4.8, effizienz_score: 92, gesamt_score: 94, badge: 'gold' },
    { tour_id: 'tour-2', datum: new Date(now - 1 * 86_400_000).toISOString(), stopps_gesamt: 4, stopps_puenktlich: 3, puenktlichkeit_pct: 75,  kundenbewertung: 4.2, effizienz_score: 78, gesamt_score: 76, badge: 'silber' },
    { tour_id: 'tour-3', datum: new Date(now - 2 * 86_400_000).toISOString(), stopps_gesamt: 6, stopps_puenktlich: 4, puenktlichkeit_pct: 67,  kundenbewertung: 3.9, effizienz_score: 70, gesamt_score: 68, badge: 'bronze' },
    { tour_id: 'tour-4', datum: new Date(now - 3 * 86_400_000).toISOString(), stopps_gesamt: 3, stopps_puenktlich: 3, puenktlichkeit_pct: 100, kundenbewertung: 5.0, effizienz_score: 95, gesamt_score: 97, badge: 'gold' },
    { tour_id: 'tour-5', datum: new Date(now - 4 * 86_400_000).toISOString(), stopps_gesamt: 5, stopps_puenktlich: 2, puenktlichkeit_pct: 40,  kundenbewertung: 3.5, effizienz_score: 55, gesamt_score: 48, badge: 'keine' },
  ];

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    driver_id: driverId,
    touren,
    durchschnitt_gesamt: Math.round(avg(touren.map(t => t.gesamt_score))),
    durchschnitt_puenktlichkeit_pct: Math.round(avg(touren.map(t => t.puenktlichkeit_pct))),
    durchschnitt_bewertung: Math.round(avg(touren.map(t => t.kundenbewertung ?? 0)) * 10) / 10,
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

    // Letzte 5 Batches/Touren dieses Fahrers
    const { data: batches, error: bErr } = await (sb as any)
      .from('delivery_batches')
      .select('id, gestartet_am, abgeschlossen_am, delivery_stops(id, geliefert_am, estimated_delivery_at, delivery_reviews(rating))')
      .eq('driver_id', driverId)
      .not('abgeschlossen_am', 'is', null)
      .order('abgeschlossen_am', { ascending: false })
      .limit(5);

    if (bErr || !batches || batches.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const touren: TourScore[] = batches.map((b: any) => {
      const stops: any[] = b.delivery_stops ?? [];
      const gesamt = stops.length;
      const pünktlich = stops.filter((s: any) => {
        if (!s.geliefert_am || !s.estimated_delivery_at) return true;
        return new Date(s.geliefert_am) <= new Date(s.estimated_delivery_at);
      }).length;

      const puenktlichkeit_pct = gesamt > 0 ? Math.round((pünktlich / gesamt) * 100) : 0;

      const ratings = stops
        .flatMap((s: any) => s.delivery_reviews ?? [])
        .map((r: any) => r.rating as number)
        .filter((r) => typeof r === 'number' && r > 0);

      const kundenbewertung = ratings.length > 0
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      // Effizienz: Basis 100 - Abzüge für verspätete Stops
      const verspaetet = gesamt - pünktlich;
      const effizienz_score = Math.max(0, Math.round(100 - (verspaetet / Math.max(1, gesamt)) * 50));

      // Gesamt-Score: 50% Pünktlichkeit + 30% Bewertung (skaliert) + 20% Effizienz
      const bewertungsScore = kundenbewertung !== null ? ((kundenbewertung - 1) / 4) * 100 : 70;
      const gesamt_score = Math.round(puenktlichkeit_pct * 0.5 + bewertungsScore * 0.3 + effizienz_score * 0.2);

      return {
        tour_id: b.id as string,
        datum: b.abgeschlossen_am as string,
        stopps_gesamt: gesamt,
        stopps_puenktlich: pünktlich,
        puenktlichkeit_pct,
        kundenbewertung,
        effizienz_score,
        gesamt_score,
        badge: calcBadge(gesamt_score),
      } satisfies TourScore;
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const bew = touren.map(t => t.kundenbewertung).filter((x): x is number => x !== null);

    return NextResponse.json({
      driver_id: driverId,
      touren,
      durchschnitt_gesamt: Math.round(avg(touren.map(t => t.gesamt_score))),
      durchschnitt_puenktlichkeit_pct: Math.round(avg(touren.map(t => t.puenktlichkeit_pct))),
      durchschnitt_bewertung: bew.length > 0 ? Math.round(avg(bew) * 10) / 10 : null,
      generiert_am: new Date().toISOString(),
    } satisfies TourQualitaetsScoreResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
