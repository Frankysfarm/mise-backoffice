/**
 * GET /api/delivery/admin/schicht-qualitaets-score?location_id=<uuid>&date=YYYY-MM-DD
 *
 * Phase 1486 — Schicht-Qualitäts-Score-API
 * Gewichteter Score: Pünktlichkeit 40% + Kundenbewertung 30% + Storno-Rate 20% + Fahrer-Verfügbarkeit 10%
 * Heute + Vorwoche-Vergleich. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface QualitaetsKomponente {
  name: string;
  wert: number;
  gewicht: number;
  beitrag: number;
  status: 'gut' | 'mittel' | 'schlecht';
}

export interface SchichtQualitaetsScoreResponse {
  gesamt_score: number;
  vorwoche_score: number;
  delta: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'gut' | 'mittel' | 'schlecht';
  komponenten: QualitaetsKomponente[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

function scoreStatus(score: number): 'gut' | 'mittel' | 'schlecht' {
  if (score >= 75) return 'gut';
  if (score >= 55) return 'mittel';
  return 'schlecht';
}

function buildMock(locationId: string, datum: string): SchichtQualitaetsScoreResponse {
  const puenktlichkeit = 82;
  const bewertung = 78;
  const stornoRate = 90;
  const verfuegbarkeit = 85;

  const komponenten: QualitaetsKomponente[] = [
    { name: 'Pünktlichkeit', wert: puenktlichkeit, gewicht: 40, beitrag: puenktlichkeit * 0.4, status: scoreStatus(puenktlichkeit) },
    { name: 'Kundenbewertung', wert: bewertung, gewicht: 30, beitrag: bewertung * 0.3, status: scoreStatus(bewertung) },
    { name: 'Storno-Quote (inv.)', wert: stornoRate, gewicht: 20, beitrag: stornoRate * 0.2, status: scoreStatus(stornoRate) },
    { name: 'Fahrer-Verfügbarkeit', wert: verfuegbarkeit, gewicht: 10, beitrag: verfuegbarkeit * 0.1, status: scoreStatus(verfuegbarkeit) },
  ];
  const gesamt = parseFloat(komponenten.reduce((s, k) => s + k.beitrag, 0).toFixed(1));
  const vorwoche = 79.5;
  const delta = parseFloat((gesamt - vorwoche).toFixed(1));
  return {
    gesamt_score: gesamt,
    vorwoche_score: vorwoche,
    delta,
    trend: delta > 1 ? 'besser' : delta < -1 ? 'schlechter' : 'gleich',
    status: scoreStatus(gesamt),
    komponenten,
    location_id: locationId,
    datum,
    generiert_am: new Date().toISOString(),
  };
}

interface RawOrder {
  status: string;
  created_at: string;
  delivered_at?: string | null;
}

interface RawRating {
  rating: number;
}

interface RawDriver {
  status: string;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }
  const dateParam = req.nextUrl.searchParams.get('date');
  const datum = dateParam ?? new Date().toISOString().slice(0, 10);

  try {
    const sb = await createClient();
    const dayStart = new Date(`${datum}T00:00:00Z`);
    const dayEnd = new Date(`${datum}T23:59:59Z`);
    const weekAgoStart = new Date(dayStart.getTime() - 7 * 86_400_000);
    const weekAgoEnd = new Date(dayEnd.getTime() - 7 * 86_400_000);

    // Fetch orders for today
    const { data: todayOrders } = await (sb as any)
      .from('mise_orders')
      .select('status, created_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());

    // Fetch orders for last week same day
    const { data: weekOrders } = await (sb as any)
      .from('mise_orders')
      .select('status, created_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', weekAgoStart.toISOString())
      .lte('created_at', weekAgoEnd.toISOString());

    // Fetch ratings today
    const { data: ratings } = await (sb as any)
      .from('delivery_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());

    // Fetch active drivers
    const { data: drivers } = await (sb as any)
      .from('mise_drivers')
      .select('status')
      .eq('location_id', locationId);

    if (!todayOrders) throw new Error('no data');

    function calcScore(orders: RawOrder[], ratingList: RawRating[], driverList: RawDriver[]) {
      const total = orders.length;
      if (total === 0) return buildMock(locationId ?? '', datum).gesamt_score;

      const delivered = orders.filter((o) => o.status === 'delivered' || o.status === 'geliefert');
      const cancelled = orders.filter((o) => o.status === 'cancelled' || o.status === 'storniert');

      // Pünktlichkeit: delivered within 30 min from created
      const puenktlich = delivered.filter((o) => {
        if (!o.delivered_at) return false;
        const diff = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
        return diff <= 30;
      });
      const puenktlichkeit = delivered.length > 0 ? (puenktlich.length / delivered.length) * 100 : 70;

      // Kundenbewertung
      const ratingArr = (ratingList ?? []) as RawRating[];
      const avgRating = ratingArr.length > 0
        ? ratingArr.reduce((s: number, r: RawRating) => s + r.rating, 0) / ratingArr.length
        : 3.8;
      const bewertung = Math.min(100, (avgRating / 5) * 100);

      // Storno-Rate (inverted: lower storno = higher score)
      const stornoRate = 100 - Math.min(100, (cancelled.length / total) * 100 * 5);

      // Fahrer-Verfügbarkeit
      const driverArr = (driverList ?? []) as RawDriver[];
      const onlineDrivers = driverArr.filter((d) => d.status === 'online' || d.status === 'on_duty');
      const verfuegbarkeit = driverArr.length > 0
        ? Math.min(100, (onlineDrivers.length / Math.max(driverArr.length, 1)) * 100 * 1.5)
        : 80;

      const komp: QualitaetsKomponente[] = [
        { name: 'Pünktlichkeit', wert: parseFloat(puenktlichkeit.toFixed(1)), gewicht: 40, beitrag: puenktlichkeit * 0.4, status: scoreStatus(puenktlichkeit) },
        { name: 'Kundenbewertung', wert: parseFloat(bewertung.toFixed(1)), gewicht: 30, beitrag: bewertung * 0.3, status: scoreStatus(bewertung) },
        { name: 'Storno-Quote (inv.)', wert: parseFloat(stornoRate.toFixed(1)), gewicht: 20, beitrag: stornoRate * 0.2, status: scoreStatus(stornoRate) },
        { name: 'Fahrer-Verfügbarkeit', wert: parseFloat(verfuegbarkeit.toFixed(1)), gewicht: 10, beitrag: verfuegbarkeit * 0.1, status: scoreStatus(verfuegbarkeit) },
      ];
      return { score: parseFloat(komp.reduce((s, k) => s + k.beitrag, 0).toFixed(1)), komp };
    }

    const todayResult = calcScore(todayOrders as RawOrder[], ratings as RawRating[], drivers as RawDriver[]);
    const weekResult = calcScore((weekOrders ?? []) as RawOrder[], [], drivers as RawDriver[]);

    const gesamtScore = typeof todayResult === 'number' ? todayResult : todayResult.score;
    const vorwocheScore = typeof weekResult === 'number' ? weekResult : weekResult.score;
    const komponenten = typeof todayResult === 'object' && 'komp' in todayResult ? todayResult.komp : buildMock(locationId, datum).komponenten;
    const delta = parseFloat((gesamtScore - vorwocheScore).toFixed(1));

    const response: SchichtQualitaetsScoreResponse = {
      gesamt_score: gesamtScore,
      vorwoche_score: vorwocheScore,
      delta,
      trend: delta > 1 ? 'besser' : delta < -1 ? 'schlechter' : 'gleich',
      status: scoreStatus(gesamtScore),
      komponenten,
      location_id: locationId,
      datum,
      generiert_am: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId, datum));
  }
}
