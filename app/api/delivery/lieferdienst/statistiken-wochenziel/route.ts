import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  kpis: [
    { key: 'umsatz',        label: 'Wochen-Umsatz',    wert: 8240,  ziel: 10000, einheit: '€',   ziel_einheit: '€',   pct: 82 },
    { key: 'touren',        label: 'Touren',            wert: 142,   ziel: 180,   einheit: '',    ziel_einheit: '',    pct: 79 },
    { key: 'bestellungen',  label: 'Bestellungen',      wert: 318,   ziel: 400,   einheit: '',    ziel_einheit: '',    pct: 80 },
    { key: 'puenktlichkeit',label: 'Pünktlichkeit',     wert: 83,    ziel: 90,    einheit: '%',   ziel_einheit: '%',   pct: 92 },
    { key: 'bewertung',     label: 'Ø Bewertung',       wert: 4.4,   ziel: 4.5,   einheit: '★',   ziel_einheit: '★',   pct: 98 },
    { key: 'trinkgeld',     label: 'Trinkgeld-Quote',   wert: 7.8,   ziel: 10,    einheit: '%',   ziel_einheit: '%',   pct: 78 },
  ],
  gesamt_pct: 85,
  woche_start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
  woche_ende:  new Date().toISOString().slice(0, 10),
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [toursRes, stopsRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('id, revenue')
        .eq('location_id', location_id)
        .gte('started_at', start.toISOString())
        .lt('started_at', end.toISOString()),
      supabase
        .from('batch_stops')
        .select('id, departed_at, delivered_at')
        .eq('location_id', location_id)
        .gte('departed_at', start.toISOString())
        .lt('departed_at', end.toISOString()),
    ]);

    const tours = toursRes.data ?? [];
    const stops = stopsRes.data ?? [];

    if (tours.length === 0) return NextResponse.json(MOCK_DATA);

    const umsatz = tours.reduce((s: number, t: { revenue: number | null }) => s + (t.revenue ?? 0), 0);
    const touren = tours.length;
    const bestellungen = stops.length;

    const puenktliche = stops.filter((s: { departed_at: string; delivered_at: string }) => {
      if (!s.departed_at || !s.delivered_at) return false;
      const mins = (new Date(s.delivered_at).getTime() - new Date(s.departed_at).getTime()) / 60000;
      return mins <= 30;
    }).length;
    const puenktlichkeit = stops.length > 0 ? Math.round((puenktliche / stops.length) * 100) : 0;

    const zielUmsatz = 10000;
    const zielTouren = 180;
    const zielBestellungen = 400;
    const zielPuenktlichkeit = 90;
    const zielBewertung = 4.5;
    const zielTrinkgeld = 10;

    const kpis = [
      { key: 'umsatz',        label: 'Wochen-Umsatz',   wert: Math.round(umsatz),  ziel: zielUmsatz,        einheit: '€',  ziel_einheit: '€',  pct: Math.min(100, Math.round(umsatz / zielUmsatz * 100)) },
      { key: 'touren',        label: 'Touren',           wert: touren,              ziel: zielTouren,        einheit: '',   ziel_einheit: '',   pct: Math.min(100, Math.round(touren / zielTouren * 100)) },
      { key: 'bestellungen',  label: 'Bestellungen',     wert: bestellungen,        ziel: zielBestellungen,  einheit: '',   ziel_einheit: '',   pct: Math.min(100, Math.round(bestellungen / zielBestellungen * 100)) },
      { key: 'puenktlichkeit',label: 'Pünktlichkeit',    wert: puenktlichkeit,      ziel: zielPuenktlichkeit, einheit: '%', ziel_einheit: '%',  pct: Math.min(100, Math.round(puenktlichkeit / zielPuenktlichkeit * 100)) },
      { key: 'bewertung',     label: 'Ø Bewertung',      wert: MOCK_DATA.kpis[4].wert, ziel: zielBewertung, einheit: '★',  ziel_einheit: '★',  pct: Math.min(100, Math.round(MOCK_DATA.kpis[4].wert / zielBewertung * 100)) },
      { key: 'trinkgeld',     label: 'Trinkgeld-Quote',  wert: MOCK_DATA.kpis[5].wert, ziel: zielTrinkgeld, einheit: '%',  ziel_einheit: '%',  pct: Math.min(100, Math.round(MOCK_DATA.kpis[5].wert / zielTrinkgeld * 100)) },
    ];

    const gesamt_pct = Math.round(kpis.reduce((s, k) => s + k.pct, 0) / kpis.length);

    return NextResponse.json({
      kpis,
      gesamt_pct,
      woche_start: start.toISOString().slice(0, 10),
      woche_ende:  now.toISOString().slice(0, 10),
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
