import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type StundenPunkt = {
  stunde: number;
  heute: number;
  gestern: number;
  vorwoche: number;
};

type Response = {
  punkte: StundenPunkt[];
  gesamt_heute: number;
  gesamt_gestern: number;
  gesamt_vorwoche: number;
  peak_stunde: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  location_id: string | null;
  generiert_am: string;
};

function mockDaten(locationId: string | null): Response {
  const now = new Date();
  const aktuelleStunde = now.getHours();
  const punkte: StundenPunkt[] = [];
  let gesamtHeute = 0, gesamtGestern = 0, gesamtVorwoche = 0;

  for (let h = 0; h < 24; h++) {
    const basis = h >= 11 && h <= 14 ? 180 : h >= 17 && h <= 21 ? 220 : h >= 8 && h <= 10 ? 80 : 20;
    const heute = h <= aktuelleStunde ? Math.round(basis * (0.8 + Math.random() * 0.4)) : 0;
    const gestern = Math.round(basis * (0.75 + Math.random() * 0.4));
    const vorwoche = Math.round(basis * (0.7 + Math.random() * 0.45));
    punkte.push({ stunde: h, heute, gestern, vorwoche });
    gesamtHeute += heute;
    gesamtGestern += gestern;
    gesamtVorwoche += vorwoche;
  }

  const peak = punkte.reduce((a, b) => (a.heute > b.heute ? a : b));

  return {
    punkte,
    gesamt_heute: gesamtHeute,
    gesamt_gestern: gesamtGestern,
    gesamt_vorwoche: gesamtVorwoche,
    peak_stunde: peak.stunde,
    trend: gesamtHeute > gesamtGestern * 1.05 ? 'besser' : gesamtHeute < gesamtGestern * 0.95 ? 'schlechter' : 'gleich',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const jetzt = new Date();
    const tagStart = new Date(jetzt);
    tagStart.setHours(0, 0, 0, 0);
    const gesternStart = new Date(tagStart);
    gesternStart.setDate(gesternStart.getDate() - 1);
    const vorwocheStart = new Date(tagStart);
    vorwocheStart.setDate(vorwocheStart.getDate() - 7);
    const vorwocheEnde = new Date(vorwocheStart);
    vorwocheEnde.setHours(23, 59, 59, 999);

    const baseQ = supabase
      .from('customer_orders')
      .select('created_at, total_price')
      .in('status', ['geliefert', 'abgeschlossen', 'bezahlt']);

    if (locationId) {
      baseQ.eq('location_id', locationId);
    }

    const { data: alleBestellungen, error } = await baseQ
      .gte('created_at', vorwocheStart.toISOString())
      .lte('created_at', jetzt.toISOString());

    if (error || !alleBestellungen?.length) throw new Error('no data');

    const punkte: StundenPunkt[] = Array.from({ length: 24 }, (_, h) => ({
      stunde: h,
      heute: 0,
      gestern: 0,
      vorwoche: 0,
    }));

    for (const o of alleBestellungen) {
      const d = new Date(o.created_at);
      const h = d.getHours();
      const umsatz = o.total_price ?? 0;
      const tagesDiff = Math.round((tagStart.getTime() - new Date(d.toDateString()).getTime()) / 86400000);

      if (tagesDiff === 0) punkte[h].heute += umsatz;
      else if (tagesDiff === 1) punkte[h].gestern += umsatz;
      else if (tagesDiff === 7) punkte[h].vorwoche += umsatz;
    }

    punkte.forEach((p) => {
      p.heute = Math.round(p.heute * 100) / 100;
      p.gestern = Math.round(p.gestern * 100) / 100;
      p.vorwoche = Math.round(p.vorwoche * 100) / 100;
    });

    const gesamtHeute = punkte.reduce((s, p) => s + p.heute, 0);
    const gesamtGestern = punkte.reduce((s, p) => s + p.gestern, 0);
    const gesamtVorwoche = punkte.reduce((s, p) => s + p.vorwoche, 0);
    const peak = punkte.reduce((a, b) => (a.heute > b.heute ? a : b));

    return NextResponse.json({
      punkte,
      gesamt_heute: Math.round(gesamtHeute * 100) / 100,
      gesamt_gestern: Math.round(gesamtGestern * 100) / 100,
      gesamt_vorwoche: Math.round(gesamtVorwoche * 100) / 100,
      peak_stunde: peak.stunde,
      trend: gesamtHeute > gesamtGestern * 1.05 ? 'besser' : gesamtHeute < gesamtGestern * 0.95 ? 'schlechter' : 'gleich',
      location_id: locationId,
      generiert_am: jetzt.toISOString(),
    } satisfies Response);
  } catch {
    return NextResponse.json(mockDaten(locationId));
  }
}
