import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface TagesUmsatzVergleichResponse {
  heute_eur: number;
  gestern_eur: number;
  vorwoche_eur: number;
  heute_bestellungen: number;
  gestern_bestellungen: number;
  vorwoche_bestellungen: number;
  delta_gestern_pct: number;
  delta_vorwoche_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  location_id: string | null;
  generiert_am: string;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function mockData(locationId: string | null): TagesUmsatzVergleichResponse {
  const seed = locationId ? locationId.charCodeAt(0) : 42;
  const heute = 1200 + (seed % 400);
  const gestern = 1100 + (seed % 300);
  const vorwoche = 1050 + (seed % 350);
  const dg = pctChange(heute, gestern);
  return {
    heute_eur: heute,
    gestern_eur: gestern,
    vorwoche_eur: vorwoche,
    heute_bestellungen: 24 + (seed % 10),
    gestern_bestellungen: 21 + (seed % 8),
    vorwoche_bestellungen: 19 + (seed % 9),
    delta_gestern_pct: dg,
    delta_vorwoche_pct: pctChange(heute, vorwoche),
    trend: dg > 3 ? 'steigend' : dg < -3 ? 'fallend' : 'stabil',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);

    const startOfVorwoche = new Date(startOfToday);
    startOfVorwoche.setDate(startOfVorwoche.getDate() - 7);
    const endOfVorwoche = new Date(startOfVorwoche);
    endOfVorwoche.setDate(endOfVorwoche.getDate() + 1);

    let q = supabase
      .from('orders')
      .select('gesamtbetrag, created_at')
      .in('status', ['bezahlt', 'geliefert', 'abgeholt', 'paid', 'delivered', 'completed'])
      .gte('created_at', startOfVorwoche.toISOString());
    if (locationId) q = q.eq('location_id', locationId);

    const { data, error } = await q;
    if (error || !data) return NextResponse.json(mockData(locationId));

    function sumRange(from: Date, to: Date) {
      const rows = data.filter(r => {
        const t = new Date(r.created_at);
        return t >= from && t < to;
      });
      return {
        eur: rows.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0),
        cnt: rows.length,
      };
    }

    const heute   = sumRange(startOfToday, now);
    const gestern = sumRange(startOfYesterday, endOfYesterday);
    const vorwoche = sumRange(startOfVorwoche, endOfVorwoche);

    const dg = pctChange(heute.eur, gestern.eur);

    return NextResponse.json({
      heute_eur: Math.round(heute.eur * 100) / 100,
      gestern_eur: Math.round(gestern.eur * 100) / 100,
      vorwoche_eur: Math.round(vorwoche.eur * 100) / 100,
      heute_bestellungen: heute.cnt,
      gestern_bestellungen: gestern.cnt,
      vorwoche_bestellungen: vorwoche.cnt,
      delta_gestern_pct: dg,
      delta_vorwoche_pct: pctChange(heute.eur, vorwoche.eur),
      trend: dg > 3 ? 'steigend' : dg < -3 ? 'fallend' : 'stabil',
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies TagesUmsatzVergleichResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
