import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1366 — Bestellqualitäts-Monitor API (Admin)
// GET: Storno-Rate, Ø-Bewertung, Fehlerquote, Top-Beschwerde-Grund heute
// Supabase + Mock-Fallback

export interface BestellQualitaetsResponse {
  storno_rate_pct: number;
  storno_anzahl: number;
  gesamt_bestellungen: number;
  avg_bewertung: number | null;
  bewertungs_anzahl: number;
  fehler_rate_pct: number;
  top_beschwerde: string | null;
  qualitaets_level: 'sehr_gut' | 'gut' | 'ok' | 'schlecht';
  location_id: string;
  generiert_am: string;
}

function qualitaetsLevel(stornoRate: number, avgBew: number | null): BestellQualitaetsResponse['qualitaets_level'] {
  if (stornoRate <= 3 && (avgBew === null || avgBew >= 4.5)) return 'sehr_gut';
  if (stornoRate <= 6 && (avgBew === null || avgBew >= 4.0)) return 'gut';
  if (stornoRate <= 10) return 'ok';
  return 'schlecht';
}

const BESCHWERDEN = ['Zu lange Wartezeit', 'Kalte Speisen', 'Fehlende Artikel', 'Falscher Artikel', 'Verpackungsschaden'];

function mockData(locationId: string): BestellQualitaetsResponse {
  const gesamt = 84;
  const storno = 4;
  const stornoPct = Math.round((storno / gesamt) * 100 * 10) / 10;
  const avg = 4.3;
  return {
    storno_rate_pct: stornoPct,
    storno_anzahl: storno,
    gesamt_bestellungen: gesamt,
    avg_bewertung: avg,
    bewertungs_anzahl: 37,
    fehler_rate_pct: 2.4,
    top_beschwerde: BESCHWERDEN[1],
    qualitaets_level: qualitaetsLevel(stornoPct, avg),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? 'default';

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    const supabase = await createClient();

    // Bestellungen heute
    let totalQ = supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    if (locationId !== 'default') totalQ = totalQ.eq('location_id', locationId);
    const { count: gesamt } = await totalQ;

    // Stornos heute
    let cancelQ = supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'storniert');
    if (locationId !== 'default') cancelQ = cancelQ.eq('location_id', locationId);
    const { count: storno } = await cancelQ;

    // Bewertungen heute
    let ratingQ = supabase
      .from('delivery_ratings')
      .select('rating')
      .gte('created_at', todayStart.toISOString());
    if (locationId !== 'default') ratingQ = ratingQ.eq('location_id', locationId);
    const { data: ratings } = await ratingQ;

    const gesamtN = gesamt ?? 0;
    const stornoN = storno ?? 0;
    const stornoPct = gesamtN > 0 ? Math.round((stornoN / gesamtN) * 100 * 10) / 10 : 0;

    const ratingsArr = (ratings ?? []).map((r: { rating: number }) => r.rating).filter((r: number) => typeof r === 'number');
    const avgBew = ratingsArr.length > 0
      ? Math.round((ratingsArr.reduce((s: number, r: number) => s + r, 0) / ratingsArr.length) * 10) / 10
      : null;

    const data: BestellQualitaetsResponse = {
      storno_rate_pct: stornoPct,
      storno_anzahl: stornoN,
      gesamt_bestellungen: gesamtN,
      avg_bewertung: avgBew,
      bewertungs_anzahl: ratingsArr.length,
      fehler_rate_pct: gesamtN > 0 ? Math.round((stornoN / gesamtN) * 100 * 10) / 10 : 0,
      top_beschwerde: null,
      qualitaets_level: qualitaetsLevel(stornoPct, avgBew),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
