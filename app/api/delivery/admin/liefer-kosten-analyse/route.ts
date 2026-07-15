/**
 * GET /api/delivery/admin/liefer-kosten-analyse?location_id=<uuid>
 *
 * Phase 1702 — Liefer-Kosten-Analyse-API
 * Kosten je Lieferung (Fahrer-km-Anteil + Zeitaufwand);
 * durchschnittliche Lieferkosten + Trend vs. Vorwoche.
 * Supabase + Mock-Fallback. Multi-Tenant: location_id je Query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cost model constants
const COST_PER_KM = 0.35; // EUR per km
const COST_PER_MIN = 0.12; // EUR per minute of driver time
const BASE_COST = 0.50;   // EUR fixed base cost per delivery

interface LieferKostenAnalyseResponse {
  kosten_heute_avg: number;
  kosten_vorwoche_avg: number;
  delta_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  anzahl_lieferungen_heute: number;
  anzahl_lieferungen_vorwoche: number;
  kosten_gesamt_heute: number;
  kosten_gesamt_vorwoche: number;
  status: 'guenstig' | 'mittel' | 'teuer';
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function buildStatus(avg: number): 'guenstig' | 'mittel' | 'teuer' {
  if (avg <= 2.5) return 'guenstig';
  if (avg <= 4.5) return 'mittel';
  return 'teuer';
}

function buildEmpfehlung(status: 'guenstig' | 'mittel' | 'teuer', trend: 'steigend' | 'stabil' | 'fallend'): string {
  if (status === 'guenstig') return 'Lieferkosten im optimalen Bereich – weiter so!';
  if (status === 'teuer' && trend === 'steigend') return 'Kosten steigen kritisch – Routen und Zonen optimieren.';
  if (status === 'teuer') return 'Lieferkosten zu hoch – Bündelung der Touren prüfen.';
  if (trend === 'steigend') return 'Kosten steigen – Auslastung der Fahrer verbessern.';
  return 'Lieferkosten im mittleren Bereich – Optimierungspotenzial vorhanden.';
}

function buildMock(locationId: string): LieferKostenAnalyseResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const rnd = (base: number, range: number, s: number) =>
    Math.round((base + ((seed * s) % range) - range / 2) * 100) / 100;

  const heuteAvg = rnd(3.2, 3.0, 7);
  const vorwocheAvg = rnd(3.0, 3.0, 11);
  const deltaPct = vorwocheAvg > 0
    ? Math.round(((heuteAvg - vorwocheAvg) / vorwocheAvg) * 1000) / 10
    : 0;
  const trend: 'steigend' | 'stabil' | 'fallend' =
    deltaPct > 3 ? 'steigend' : deltaPct < -3 ? 'fallend' : 'stabil';
  const anzahl = 24 + ((seed * 3) % 20);
  const anzahlVW = 22 + ((seed * 5) % 18);
  const status = buildStatus(heuteAvg);

  return {
    kosten_heute_avg: heuteAvg,
    kosten_vorwoche_avg: vorwocheAvg,
    delta_pct: deltaPct,
    trend,
    anzahl_lieferungen_heute: anzahl,
    anzahl_lieferungen_vorwoche: anzahlVW,
    kosten_gesamt_heute: Math.round(heuteAvg * anzahl * 100) / 100,
    kosten_gesamt_vorwoche: Math.round(vorwocheAvg * anzahlVW * 100) / 100,
    status,
    empfehlung: buildEmpfehlung(status, trend),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const vorwocheStart = new Date(todayStart);
    vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
    const vorwocheEnd = new Date(vorwocheStart);
    vorwocheEnd.setUTCDate(vorwocheEnd.getUTCDate() + 1);

    async function loadStops(from: Date, to: Date) {
      let q = (sb as any)
        .from('mise_delivery_stops')
        .select('delivered_at, picked_up_at, created_at, distance_km')
        .not('delivered_at', 'is', null)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());
      if (locationId !== 'all') {
        q = q.eq('location_id', locationId);
      }
      const { data, error } = await q;
      if (error || !data) return [];
      return data as Array<{ delivered_at: string; picked_up_at: string | null; created_at: string; distance_km: number | null }>;
    }

    const [stopsHeute, stopsVorwoche] = await Promise.all([
      loadStops(todayStart, now),
      loadStops(vorwocheStart, vorwocheEnd),
    ]);

    if (!stopsHeute.length && !stopsVorwoche.length) {
      return NextResponse.json(buildMock(locationId));
    }

    function calcCosts(stops: typeof stopsHeute): number[] {
      return stops.map(s => {
        const km = s.distance_km ?? 3.5;
        const deliveredMs = new Date(s.delivered_at).getTime();
        const startMs = s.picked_up_at
          ? new Date(s.picked_up_at).getTime()
          : new Date(s.created_at).getTime();
        const dmin = Math.max(0, (deliveredMs - startMs) / 60000);
        return BASE_COST + km * COST_PER_KM + dmin * COST_PER_MIN;
      });
    }

    const costsHeute = calcCosts(stopsHeute);
    const costsVorwoche = calcCosts(stopsVorwoche);
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

    const heuteAvg = avg(costsHeute);
    const vorwocheAvg = avg(costsVorwoche);
    const deltaPct = vorwocheAvg > 0
      ? Math.round(((heuteAvg - vorwocheAvg) / vorwocheAvg) * 1000) / 10
      : 0;
    const trend: 'steigend' | 'stabil' | 'fallend' =
      deltaPct > 3 ? 'steigend' : deltaPct < -3 ? 'fallend' : 'stabil';
    const status = buildStatus(heuteAvg);

    const response: LieferKostenAnalyseResponse = {
      kosten_heute_avg: heuteAvg,
      kosten_vorwoche_avg: vorwocheAvg,
      delta_pct: deltaPct,
      trend,
      anzahl_lieferungen_heute: stopsHeute.length,
      anzahl_lieferungen_vorwoche: stopsVorwoche.length,
      kosten_gesamt_heute: Math.round(heuteAvg * stopsHeute.length * 100) / 100,
      kosten_gesamt_vorwoche: Math.round(vorwocheAvg * stopsVorwoche.length * 100) / 100,
      status,
      empfehlung: buildEmpfehlung(status, trend),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
