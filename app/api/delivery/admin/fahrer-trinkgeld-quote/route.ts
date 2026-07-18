import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(quote: number): Ampel {
  if (quote >= 10) return 'gruen';
  if (quote >= 5) return 'gelb';
  return 'rot';
}

export interface FahrerTrinkgeldQuote {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  quote_vw: number;
  trinkgeld_gesamt: number;
  bestellwert_gesamt: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerTrinkgeldQuoteResponse {
  fahrer: FahrerTrinkgeldQuote[];
  team_avg_quote: number;
  team_avg_quote_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', tip: 18.5, total: 145, tip_vw: 14.0, total_vw: 130 },
    { id: 'd2', name: 'Sara K.', tip: 7.2, total: 112, tip_vw: 9.1, total_vw: 108 },
    { id: 'd3', name: 'Tim B.', tip: 2.8, total: 98, tip_vw: 5.5, total_vw: 95 },
    { id: 'd4', name: 'Julia F.', tip: 12.3, total: 120, tip_vw: 10.8, total_vw: 115 },
  ];

  const fahrer: FahrerTrinkgeldQuote[] = drivers.map(d => {
    const quote = d.total > 0 ? Math.round((d.tip / d.total) * 1000) / 10 : 0;
    const quote_vw = d.total_vw > 0 ? Math.round((d.tip_vw / d.total_vw) * 1000) / 10 : 0;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      trinkgeld_quote: quote,
      quote_vw,
      trinkgeld_gesamt: d.tip,
      bestellwert_gesamt: d.total,
      trend: quote > quote_vw ? 'steigend' : quote < quote_vw ? 'fallend' : 'stabil',
      trend_delta: Math.round((quote - quote_vw) * 10) / 10,
      ampel: calcAmpel(quote),
      alert_niedrig: quote < 5,
    };
  }).sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);

  const team_avg_quote = Math.round((fahrer.reduce((s, f) => s + f.trinkgeld_quote, 0) / fahrer.length) * 10) / 10;
  const team_avg_quote_vw = Math.round((fahrer.reduce((s, f) => s + f.quote_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_quote };
  }

  return { fahrer, team_avg_quote, team_avg_quote_vw, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getTrinkgeldDaten(dId: string, date: string): Promise<{ tip: number; total: number }> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('tip_amount, order_total')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('order_total', 'is', null);
      const tip = data?.reduce((s, r) => s + (r.tip_amount ?? 0), 0) ?? 0;
      const total = data?.reduce((s, r) => s + (r.order_total ?? 0), 0) ?? 0;
      return { tip, total };
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [today_daten, vw_daten] = await Promise.all([
          getTrinkgeldDaten(d.id, today),
          getTrinkgeldDaten(d.id, lastWeek),
        ]);
        const quote = today_daten.total > 0
          ? Math.round((today_daten.tip / today_daten.total) * 1000) / 10
          : 0;
        const quote_vw = vw_daten.total > 0
          ? Math.round((vw_daten.tip / vw_daten.total) * 1000) / 10
          : 0;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          trinkgeld_quote: quote,
          quote_vw,
          trinkgeld_gesamt: today_daten.tip,
          bestellwert_gesamt: today_daten.total,
          trend: quote > quote_vw ? 'steigend' : quote < quote_vw ? 'fallend' : 'stabil',
          trend_delta: Math.round((quote - quote_vw) * 10) / 10,
          ampel: calcAmpel(quote),
          alert_niedrig: quote < 5 && today_daten.total > 0,
        } as FahrerTrinkgeldQuote;
      }),
    );

    const fahrer = results.sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);
    const team_avg_quote = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.trinkgeld_quote, 0) / fahrer.length) * 10) / 10
      : 0;
    const team_avg_quote_vw = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.quote_vw, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_quote });
    }

    return NextResponse.json({ fahrer, team_avg_quote, team_avg_quote_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-trinkgeld-quote error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
