/**
 * GET /api/delivery/driver/schicht-statistik?driver_id=<uuid>
 *
 * Phase 1302 — Schicht-Statistik-API (Fahrer-App)
 * Ø-Lieferzeit, Stopps heute, Trinkgeld-Summe, Kunden-Bewertungs-Ø für laufende Schicht.
 * Supabase delivery_tours + delivery_ratings + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtStatistik {
  avg_lieferzeit_min: number;
  stopps_heute: number;
  trinkgeld_summe_eur: number;
  bewertungs_schnitt: number | null;
  bewertungs_anzahl: number;
  schicht_beginn: string | null;
}

function buildMock(driverId: string): SchichtStatistik {
  void driverId;
  return {
    avg_lieferzeit_min: 23.5,
    stopps_heute: 8,
    trinkgeld_summe_eur: 4.50,
    bewertungs_schnitt: 4.7,
    bewertungs_anzahl: 6,
    schicht_beginn: new Date(Date.now() - 4 * 3600_000).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const heuteStart = new Date();
    heuteStart.setHours(0, 0, 0, 0);

    const { data: touren, error: tourError } = await (sb as any)
      .from('delivery_tours')
      .select('id, started_at, completed_at, tip_eur, total_stops')
      .eq('driver_id', driverId)
      .gte('started_at', heuteStart.toISOString())
      .eq('status', 'completed');

    if (tourError || !touren) return NextResponse.json(buildMock(driverId));

    const stoppsHeute = (touren as { total_stops?: number }[]).reduce((sum, t) => sum + (t.total_stops ?? 1), 0);
    const trinkgeld = (touren as { tip_eur?: number }[]).reduce((sum, t) => sum + (t.tip_eur ?? 0), 0);

    const lieferzeiten: number[] = (touren as { started_at?: string; completed_at?: string }[])
      .filter(t => t.started_at && t.completed_at)
      .map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60_000);

    const avgLieferzeit = lieferzeiten.length > 0
      ? +(lieferzeiten.reduce((a, b) => a + b, 0) / lieferzeiten.length).toFixed(1)
      : 0;

    const schichtBeginn = (touren as { started_at?: string }[]).length > 0
      ? (touren as { started_at?: string }[]).reduce((earliest, t) =>
          t.started_at && (!earliest || t.started_at < earliest) ? t.started_at : earliest
        , null as string | null)
      : null;

    const tourIds = (touren as { id: string }[]).map(t => t.id);
    let bewertungsSchnitt: number | null = null;
    let bewertungsAnzahl = 0;

    if (tourIds.length > 0) {
      const { data: ratings } = await (sb as any)
        .from('delivery_ratings')
        .select('rating')
        .eq('driver_id', driverId)
        .in('tour_id', tourIds);

      if (ratings?.length) {
        bewertungsAnzahl = ratings.length;
        bewertungsSchnitt = +((ratings as { rating: number }[]).reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1);
      }
    }

    return NextResponse.json({
      avg_lieferzeit_min: avgLieferzeit,
      stopps_heute: stoppsHeute,
      trinkgeld_summe_eur: +trinkgeld.toFixed(2),
      bewertungs_schnitt: bewertungsSchnitt,
      bewertungs_anzahl: bewertungsAnzahl,
      schicht_beginn: schichtBeginn,
    } satisfies SchichtStatistik);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
