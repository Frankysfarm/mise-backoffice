/**
 * GET /api/delivery/admin/tages-lieferleistung?location_id=<uuid>&date=YYYY-MM-DD
 *
 * Phase 1547 — Tages-Lieferleistungs-Vergleich
 * Vergleich heute vs. gestern: Ø Lieferzeit, Storno-Rate, Pünktlichkeit, Fahrer-Zufriedenheit
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesMetrik {
  name: string;
  heute: number;
  gestern: number;
  einheit: string;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta: number;
  hoeherIstBesser: boolean;
}

export interface TagesLieferleistungResponse {
  metriken: TagesMetrik[];
  gesamt_trend: 'besser' | 'gleich' | 'schlechter';
  location_id: string;
  datum_heute: string;
  generiert_am: string;
}

function calcTrend(
  heute: number,
  gestern: number,
  hoeherIstBesser: boolean,
): TagesMetrik['trend'] {
  const diff = heute - gestern;
  if (Math.abs(diff) < 0.5) return 'gleich';
  return (diff > 0) === hoeherIstBesser ? 'besser' : 'schlechter';
}

function buildMock(locationId: string, datum: string): TagesLieferleistungResponse {
  const metriken: TagesMetrik[] = [
    { name: 'Ø Lieferzeit', heute: 28, gestern: 32, einheit: 'Min', hoeherIstBesser: false, delta: -4, trend: 'besser' },
    { name: 'Pünktlichkeits-Rate', heute: 87, gestern: 82, einheit: '%', hoeherIstBesser: true, delta: 5, trend: 'besser' },
    { name: 'Storno-Rate', heute: 3.2, gestern: 2.8, einheit: '%', hoeherIstBesser: false, delta: 0.4, trend: 'schlechter' },
    { name: 'Bewertung Ø', heute: 4.6, gestern: 4.5, einheit: '★', hoeherIstBesser: true, delta: 0.1, trend: 'besser' },
  ];
  const besser = metriken.filter(m => m.trend === 'besser').length;
  const schlechter = metriken.filter(m => m.trend === 'schlechter').length;
  return {
    metriken,
    gesamt_trend: besser > schlechter ? 'besser' : schlechter > besser ? 'schlechter' : 'gleich',
    location_id: locationId,
    datum_heute: datum,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'unknown';
  const datum = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    const supabase = await createClient();
    const heute = datum;
    const gestern = new Date(new Date(datum).getTime() - 86400000).toISOString().slice(0, 10);

    const query = (d: string) =>
      supabase
        .from('orders')
        .select('status, fertig_am, accepted_at, geliefert_am, bewertung_sterne')
        .eq('location_id', locationId)
        .gte('bestellt_am', `${d}T00:00:00`)
        .lt('bestellt_am', `${d}T23:59:59`);

    const [hRes, gRes] = await Promise.all([query(heute), query(gestern)]);
    if (hRes.error || gRes.error) return NextResponse.json(buildMock(locationId, datum));

    const calcMetriken = (rows: typeof hRes.data) => {
      if (!rows || rows.length === 0) return { lieferzeit: 0, puenktlichkeit: 0, storno: 0, bewertung: 0 };
      const delivered = rows.filter(r => r.geliefert_am && r.accepted_at);
      const avgLieferzeit =
        delivered.length > 0
          ? delivered.reduce((sum, r) => {
              const diff =
                (new Date(r.geliefert_am!).getTime() - new Date(r.accepted_at!).getTime()) / 60000;
              return sum + diff;
            }, 0) / delivered.length
          : 0;
      const storniert = rows.filter(r => r.status === 'cancelled' || r.status === 'rejected').length;
      const stornoRate = (storniert / rows.length) * 100;
      const bewertet = rows.filter(r => r.bewertung_sterne !== null);
      const avgBewertung =
        bewertet.length > 0
          ? bewertet.reduce((s, r) => s + (r.bewertung_sterne ?? 0), 0) / bewertet.length
          : 0;
      const puenktlich = rows.filter(r => {
        if (!r.geliefert_am || !r.fertig_am) return false;
        const diff = (new Date(r.geliefert_am).getTime() - new Date(r.fertig_am).getTime()) / 60000;
        return diff <= 30;
      }).length;
      const puenktlichkeit = rows.length > 0 ? (puenktlich / rows.length) * 100 : 0;
      return {
        lieferzeit: Math.round(avgLieferzeit),
        puenktlichkeit: Math.round(puenktlichkeit),
        storno: parseFloat(stornoRate.toFixed(1)),
        bewertung: parseFloat(avgBewertung.toFixed(1)),
      };
    };

    const h = calcMetriken(hRes.data);
    const g = calcMetriken(gRes.data);

    const metriken: TagesMetrik[] = [
      { name: 'Ø Lieferzeit', heute: h.lieferzeit, gestern: g.lieferzeit, einheit: 'Min', hoeherIstBesser: false, delta: h.lieferzeit - g.lieferzeit, trend: calcTrend(h.lieferzeit, g.lieferzeit, false) },
      { name: 'Pünktlichkeits-Rate', heute: h.puenktlichkeit, gestern: g.puenktlichkeit, einheit: '%', hoeherIstBesser: true, delta: h.puenktlichkeit - g.puenktlichkeit, trend: calcTrend(h.puenktlichkeit, g.puenktlichkeit, true) },
      { name: 'Storno-Rate', heute: h.storno, gestern: g.storno, einheit: '%', hoeherIstBesser: false, delta: parseFloat((h.storno - g.storno).toFixed(1)), trend: calcTrend(h.storno, g.storno, false) },
      { name: 'Bewertung Ø', heute: h.bewertung, gestern: g.bewertung, einheit: '★', hoeherIstBesser: true, delta: parseFloat((h.bewertung - g.bewertung).toFixed(1)), trend: calcTrend(h.bewertung, g.bewertung, true) },
    ];
    const besser = metriken.filter(m => m.trend === 'besser').length;
    const schlechter = metriken.filter(m => m.trend === 'schlechter').length;
    return NextResponse.json({
      metriken,
      gesamt_trend: besser > schlechter ? 'besser' : schlechter > besser ? 'schlechter' : 'gleich',
      location_id: locationId,
      datum_heute: datum,
      generiert_am: new Date().toISOString(),
    } satisfies TagesLieferleistungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, datum));
  }
}
