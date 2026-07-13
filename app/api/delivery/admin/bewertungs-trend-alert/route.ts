/**
 * GET /api/delivery/admin/bewertungs-trend-alert?location_id=<uuid>
 *
 * Phase 1294 — Bewertungs-Trend-Alert-API (Backend)
 * Wenn Ø-Bewertung letzte 7 Tage < 3.5 → Alert mit betroffenen Fahrern + Empfehlung.
 * Supabase delivery_ratings + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BetroffenerFahrer {
  driver_id: string;
  fahrer_name: string;
  schnitt: number;
  anzahl_bewertungen: number;
}

export interface BewertungsTrendAlertResponse {
  alert_aktiv: boolean;
  gesamt_schnitt_7_tage: number;
  gesamt_schnitt_davor: number;
  trend: 'positiv' | 'stabil' | 'negativ';
  trend_pct: number;
  betroffene_fahrer: BetroffenerFahrer[];
  empfehlung: string;
  schwelle: number;
  total_bewertungen_7_tage: number;
  location_id: string;
  generiert_am: string;
}

const SCHWELLE = 3.5;

function buildMock(locationId: string): BewertungsTrendAlertResponse {
  return {
    alert_aktiv: true,
    gesamt_schnitt_7_tage: 3.2,
    gesamt_schnitt_davor: 4.0,
    trend: 'negativ',
    trend_pct: -20,
    betroffene_fahrer: [
      { driver_id: 'mock-1', fahrer_name: 'Max Müller', schnitt: 2.8, anzahl_bewertungen: 12 },
      { driver_id: 'mock-2', fahrer_name: 'Anna Schmidt', schnitt: 3.1, anzahl_bewertungen: 9 },
    ],
    empfehlung: 'Coaching-Gespräch mit den betroffenen Fahrern einplanen. Lieferzeiten prüfen.',
    schwelle: SCHWELLE,
    total_bewertungen_7_tage: 47,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = createClient();

    const jetzt = new Date();
    const vor7Tagen = new Date(jetzt);
    vor7Tagen.setDate(vor7Tagen.getDate() - 7);
    const vor14Tagen = new Date(jetzt);
    vor14Tagen.setDate(vor14Tagen.getDate() - 14);

    const { data: neuere, error: e1 } = await (sb as any)
      .from('delivery_ratings')
      .select('rating, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', vor7Tagen.toISOString());

    const { data: aeltere, error: e2 } = await (sb as any)
      .from('delivery_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', vor14Tagen.toISOString())
      .lt('created_at', vor7Tagen.toISOString());

    if (e1 || !neuere?.length) return NextResponse.json(buildMock(locationId));

    // Schnitt letzte 7 Tage
    const schnitt7 = +(neuere.reduce((s: number, r: any) => s + r.rating, 0) / neuere.length).toFixed(2);
    const schnittDavor = aeltere?.length
      ? +(aeltere.reduce((s: number, r: any) => s + r.rating, 0) / aeltere.length).toFixed(2)
      : schnitt7;

    const delta = schnitt7 - schnittDavor;
    const trend_pct = schnittDavor > 0 ? +((delta / schnittDavor) * 100).toFixed(1) : 0;
    const trend: 'positiv' | 'stabil' | 'negativ' =
      delta >= 0.1 ? 'positiv' : delta <= -0.1 ? 'negativ' : 'stabil';

    const alertAktiv = schnitt7 < SCHWELLE;

    // Fahrer aggregieren
    const fahrerMap: Record<string, { sum: number; count: number }> = {};
    for (const r of neuere as { rating: number; driver_id?: string }[]) {
      if (!r.driver_id) continue;
      if (!fahrerMap[r.driver_id]) fahrerMap[r.driver_id] = { sum: 0, count: 0 };
      fahrerMap[r.driver_id].sum += r.rating;
      fahrerMap[r.driver_id].count += 1;
    }

    const betroffene: BetroffenerFahrer[] = Object.entries(fahrerMap)
      .map(([id, v]) => ({
        driver_id: id,
        fahrer_name: `Fahrer ${id.slice(0, 6)}`,
        schnitt: +(v.sum / v.count).toFixed(1),
        anzahl_bewertungen: v.count,
      }))
      .filter(f => f.schnitt < SCHWELLE)
      .sort((a, b) => a.schnitt - b.schnitt)
      .slice(0, 5);

    const empfehlung = alertAktiv
      ? `Ø-Bewertung (${schnitt7}) unter Schwelle ${SCHWELLE}. Coaching-Gespräche einplanen und Lieferzeiten prüfen.`
      : `Ø-Bewertung (${schnitt7}) im grünen Bereich.`;

    const result: BewertungsTrendAlertResponse = {
      alert_aktiv: alertAktiv,
      gesamt_schnitt_7_tage: schnitt7,
      gesamt_schnitt_davor: schnittDavor,
      trend,
      trend_pct,
      betroffene_fahrer: betroffene,
      empfehlung,
      schwelle: SCHWELLE,
      total_bewertungen_7_tage: neuere.length,
      location_id: locationId,
      generiert_am: jetzt.toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
