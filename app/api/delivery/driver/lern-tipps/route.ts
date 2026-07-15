/**
 * GET /api/delivery/driver/lern-tipps?driver_id=<id>
 *
 * Phase 1660 (Backend) — Personalisierte Lern-Tipps für Fahrer
 * Vergleich Fahrer-Leistung heute vs. Vorwoche → generiert Optimierungstipps.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kategorie = 'zeit' | 'zone' | 'rating' | 'route' | 'pause';
type Prioritaet = 'hoch' | 'mittel' | 'niedrig';

interface Tipp {
  id: string;
  titel: string;
  beschreibung: string;
  kategorie: Kategorie;
  prioritaet: Prioritaet;
}

interface LernTippsResponse {
  driver_id: string;
  tipps: Tipp[];
  generiert_am: string;
}

function buildMock(driverId: string): LernTippsResponse {
  const seed = driverId.charCodeAt(0) || 65;
  const tipps: Tipp[] = [];

  if (seed % 3 === 0) {
    tipps.push({
      id: 'zone-b',
      titel: 'Zone B schneller erkunden',
      beschreibung: `Deine Zone-B-Stopps dauern Ø ${3 + (seed % 4)} Min länger als letzte Woche. Alternativroute könnte helfen.`,
      kategorie: 'zone',
      prioritaet: 'hoch',
    });
  }

  tipps.push({
    id: 'pause-timing',
    titel: 'Pausen-Timing optimieren',
    beschreibung: 'Eine kurze Pause zwischen 13:00–14:00 Uhr verbessert deinen Komfort-Score um ~12 Punkte.',
    kategorie: 'pause',
    prioritaet: 'mittel',
  });

  tipps.push({
    id: 'rating-boost',
    titel: 'Bewertungs-Boost möglich',
    beschreibung: `Freundliche Begrüßung beim Übergeben steigert die Kundenbewertung. Ziel: 4,6 ★`,
    kategorie: 'rating',
    prioritaet: seed % 2 === 0 ? 'mittel' : 'niedrig',
  });

  if (seed % 2 === 1) {
    tipps.push({
      id: 'route-opt',
      titel: 'Route bündeln',
      beschreibung: 'Nimm nah beieinanderliegende Stopps zusammen — spart Ø 4 Min je Tour.',
      kategorie: 'route',
      prioritaet: 'niedrig',
    });
  }

  return { driver_id: driverId, tipps, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const vorwocheStart = new Date(todayStart);
    vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
    const vorwocheEnd = new Date(vorwocheStart);
    vorwocheEnd.setUTCDate(vorwocheEnd.getUTCDate() + 1);

    const { data: tourenHeute } = await (sb as any)
      .from('tours')
      .select('created_at, delivered_at, bewertung, zone')
      .eq('driver_id', driverId)
      .not('delivered_at', 'is', null)
      .gte('created_at', todayStart.toISOString());

    const { data: tourenVorwoche } = await (sb as any)
      .from('tours')
      .select('created_at, delivered_at, bewertung, zone')
      .eq('driver_id', driverId)
      .not('delivered_at', 'is', null)
      .gte('created_at', vorwocheStart.toISOString())
      .lt('created_at', vorwocheEnd.toISOString());

    if (!tourenHeute?.length || !tourenVorwoche?.length) {
      return NextResponse.json(buildMock(driverId));
    }

    function avgTime(touren: Array<{ created_at: string; delivered_at: string }>) {
      const times = touren.map(t =>
        (new Date(t.delivered_at).getTime() - new Date(t.created_at).getTime()) / 60000
      );
      return times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    function avgRating(touren: Array<{ bewertung: number | null }>) {
      const ratings = touren.map(t => t.bewertung).filter((b): b is number => b != null);
      return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    }

    const avgHeute = avgTime(tourenHeute);
    const avgVorwoche = avgTime(tourenVorwoche);
    const ratingHeute = avgRating(tourenHeute);
    const ratingVorwoche = avgRating(tourenVorwoche);

    const tipps: Tipp[] = [];

    // Lieferzeit verschlechtert
    if (avgHeute > avgVorwoche + 3) {
      tipps.push({
        id: 'zeit-verschlechterung',
        titel: 'Lieferzeit verbessern',
        beschreibung: `Deine Ø Lieferzeit heute (${Math.round(avgHeute)} Min) ist ${Math.round(avgHeute - avgVorwoche)} Min länger als letzte Woche.`,
        kategorie: 'zeit',
        prioritaet: avgHeute - avgVorwoche > 8 ? 'hoch' : 'mittel',
      });
    }

    // Bewertung gesunken
    if (ratingHeute != null && ratingVorwoche != null && ratingHeute < ratingVorwoche - 0.2) {
      tipps.push({
        id: 'rating-sunk',
        titel: 'Bewertung gesunken',
        beschreibung: `Deine Bewertung heute (${ratingHeute.toFixed(1)} ★) liegt unter Vorwoche (${ratingVorwoche.toFixed(1)} ★). Freundlicher Kontakt hilft!`,
        kategorie: 'rating',
        prioritaet: 'mittel',
      });
    }

    // Immer: Pausen-Tipp
    tipps.push({
      id: 'pause-timing',
      titel: 'Pausen einplanen',
      beschreibung: 'Regelmäßige Pausen halten deinen Komfort-Score hoch — besonders nach der 4. Tour empfohlen.',
      kategorie: 'pause',
      prioritaet: 'niedrig',
    });

    return NextResponse.json({
      driver_id: driverId,
      tipps: tipps.slice(0, 5),
      generiert_am: new Date().toISOString(),
    } satisfies LernTippsResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
