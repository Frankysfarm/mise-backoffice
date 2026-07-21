import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(rate: number): Ampel {
  if (rate >= 95) return 'gruen';
  if (rate >= 85) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerAbschlussquote {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  delivered_stopps: number;
  quote_pct: number;
  quote_pct_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerAbschlussquoteResponse {
  fahrer: FahrerAbschlussquote[];
  team_avg_quote: number;
  team_avg_quote_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Julia F.', total: 42, delivered: 41 },
    { id: 'd2', name: 'Max M.',   total: 38, delivered: 37 },
    { id: 'd3', name: 'Sara K.',  total: 35, delivered: 31 },
    { id: 'd4', name: 'Tim B.',   total: 28, delivered: 23 },
  ];

  const fahrer: FahrerAbschlussquote[] = drivers.map(d => {
    const quote_pct = Math.round((d.delivered / d.total) * 1000) / 10;
    const vwDelivered = Math.max(0, d.delivered + (Math.random() > 0.5 ? 1 : -1));
    const quote_pct_vw = Math.round((vwDelivered / d.total) * 1000) / 10;
    const { trend, delta } = calcTrend(quote_pct, quote_pct_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      gesamt_stopps: d.total,
      delivered_stopps: d.delivered,
      quote_pct,
      quote_pct_vw,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(quote_pct),
      alert_niedrig: quote_pct < 85,
    };
  }).sort((a, b) => b.quote_pct - a.quote_pct);

  const team_avg = Math.round(fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length * 10) / 10;
  const team_avg_vw = Math.round(fahrer.reduce((s, f) => s + f.quote_pct_vw, 0) / fahrer.length * 10) / 10;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_quote: team_avg };
  }

  return {
    fahrer,
    team_avg_quote: team_avg,
    team_avg_quote_vw: team_avg_vw,
    alert_count: fahrer.filter(f => f.alert_niedrig).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 1);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 1);

    const { data: todayStops } = await supabase
      .from('batch_stops')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: vwStops } = await supabase
      .from('batch_stops')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    type StopRow = { driver_id: string; status: string };

    function calcQuote(stops: StopRow[] | null, dId: string): { quote: number; total: number; delivered: number } {
      const ds = (stops ?? []).filter(s => s.driver_id === dId);
      if (!ds.length) return { quote: 95, total: 0, delivered: 0 };
      const delivered = ds.filter(s => s.status === 'delivered').length;
      return { quote: Math.round((delivered / ds.length) * 1000) / 10, total: ds.length, delivered };
    }

    const fahrerList: FahrerAbschlussquote[] = drivers.map(d => {
      const { quote, total, delivered } = calcQuote(todayStops as StopRow[] | null, d.id);
      const { quote: quoteVw } = calcQuote(vwStops as StopRow[] | null, d.id);
      const { trend, delta } = calcTrend(quote, quoteVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        gesamt_stopps: total,
        delivered_stopps: delivered,
        quote_pct: quote,
        quote_pct_vw: quoteVw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(quote),
        alert_niedrig: quote < 85,
      };
    }).sort((a, b) => b.quote_pct - a.quote_pct);

    const team_avg = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.quote_pct, 0) / fahrerList.length * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.quote_pct_vw, 0) / fahrerList.length * 10) / 10
      : 0;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_quote: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_quote: team_avg,
      team_avg_quote_vw: team_avg_vw,
      alert_count: fahrerList.filter(f => f.alert_niedrig).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerAbschlussquoteResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
