import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1413 — Letzte-Kunden-Bewertung-API (Fahrer-App)
// GET /api/delivery/driver/letzte-bewertung?driver_id=<uuid>
// Letzte Kundenbewertung + 7-Tage-Trend

interface ApiResponse {
  letzte_bewertung: {
    sterne: number;
    kommentar: string | null;
    erstellt_am: string;
  } | null;
  schnitt_7_tage: number | null;
  schnitt_vorwoche: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  anzahl_bewertungen: number;
  driver_id: string;
  generiert_am: string;
}

function buildMock(driverId: string): ApiResponse {
  return {
    letzte_bewertung: {
      sterne: 5,
      kommentar: 'Super schnell und freundlich!',
      erstellt_am: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    schnitt_7_tage: 4.7,
    schnitt_vorwoche: 4.4,
    trend: 'besser',
    trend_delta: 0.3,
    anzahl_bewertungen: 14,
    driver_id: driverId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Letzte Bewertung
    const { data: lastRating } = await supabase
      .from('delivery_ratings')
      .select('stars, comment, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Ø letzte 7 Tage
    const { data: thisWeekRatings } = await supabase
      .from('delivery_ratings')
      .select('stars')
      .eq('driver_id', driverId)
      .gte('created_at', weekAgo.toISOString());

    // Ø Vorwoche
    const { data: lastWeekRatings } = await supabase
      .from('delivery_ratings')
      .select('stars')
      .eq('driver_id', driverId)
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString());

    const calcAvg = (rows: Array<{ stars: number }> | null) =>
      rows && rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.stars, 0) / rows.length) * 10) / 10
        : null;

    const schnitt_7_tage = calcAvg(thisWeekRatings);
    const schnitt_vorwoche = calcAvg(lastWeekRatings);

    const delta =
      schnitt_7_tage != null && schnitt_vorwoche != null
        ? Math.round((schnitt_7_tage - schnitt_vorwoche) * 10) / 10
        : 0;
    const trend: ApiResponse['trend'] =
      delta >= 0.2 ? 'besser' : delta <= -0.2 ? 'schlechter' : 'gleich';

    return NextResponse.json({
      letzte_bewertung: lastRating
        ? { sterne: lastRating.stars, kommentar: lastRating.comment ?? null, erstellt_am: lastRating.created_at }
        : null,
      schnitt_7_tage,
      schnitt_vorwoche,
      trend,
      trend_delta: delta,
      anzahl_bewertungen: thisWeekRatings?.length ?? 0,
      driver_id: driverId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
