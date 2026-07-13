import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const startOfLastWeekDay = new Date(Date.now() - 7 * 86400000);
    startOfLastWeekDay.setHours(0, 0, 0, 0);
    const lastWeekStart = startOfLastWeekDay.toISOString();
    const lastWeekEnd = new Date(startOfLastWeekDay.getTime() + 86400000).toISOString();

    let qToday = supabase
      .from('customer_orders')
      .select('total_price, status, created_at, delivered_at, eta_minutes, driver_rating')
      .gte('created_at', startOfDay);
    if (locationId) qToday = qToday.eq('location_id', locationId);

    let qLW = supabase
      .from('customer_orders')
      .select('total_price, status, created_at, delivered_at, eta_minutes, driver_rating')
      .gte('created_at', lastWeekStart)
      .lt('created_at', lastWeekEnd);
    if (locationId) qLW = qLW.eq('location_id', locationId);

    const [todayRes, lwRes] = await Promise.all([qToday, qLW]);
    const td = todayRes.data ?? [];
    const lw = lwRes.data ?? [];

    const umsatzHeute = td.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    const umsatzVW = lw.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    const bestellungenHeute = td.length;
    const bestellungenVW = lw.length;

    const delivered = td.filter(o => o.status === 'delivered' || o.status === 'geliefert');
    const deliveredLW = lw.filter(o => o.status === 'delivered' || o.status === 'geliefert');

    const stornoHeute = td.filter(o => o.status === 'cancelled' || o.status === 'storniert').length;
    const stornoVW = lw.filter(o => o.status === 'cancelled' || o.status === 'storniert').length;
    const stornoRateHeute = bestellungenHeute > 0 ? (stornoHeute / bestellungenHeute) * 100 : 0;
    const stornoRateVW = bestellungenVW > 0 ? (stornoVW / bestellungenVW) * 100 : 0;

    const withEta = delivered.filter(o => o.eta_minutes && o.delivered_at && o.created_at);
    const puenktlich = withEta.filter(o => {
      const actualMin = (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60000;
      return actualMin <= (o.eta_minutes ?? 30);
    }).length;
    const puenktlichkeitPct = withEta.length > 0 ? Math.round((puenktlich / withEta.length) * 100) : 0;
    const withEtaLW = deliveredLW.filter(o => o.eta_minutes && o.delivered_at);
    const puenktlichLW = withEtaLW.filter(o => {
      const actualMin = (new Date(o.delivered_at!).getTime() - new Date(o.created_at!).getTime()) / 60000;
      return actualMin <= (o.eta_minutes ?? 30);
    }).length;
    const puenktlichkeitVW = withEtaLW.length > 0 ? Math.round((puenktlichLW / withEtaLW.length) * 100) : 0;

    const withTime = delivered.filter(o => o.delivered_at && o.created_at);
    const avgMinHeute = withTime.length > 0
      ? Math.round(withTime.reduce((s, o) => s + (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60000, 0) / withTime.length)
      : 0;
    const withTimeLW = deliveredLW.filter(o => o.delivered_at);
    const avgMinVW = withTimeLW.length > 0
      ? Math.round(withTimeLW.reduce((s, o) => s + (new Date(o.delivered_at!).getTime() - new Date(o.created_at!).getTime()) / 60000, 0) / withTimeLW.length)
      : 0;

    const withRating = delivered.filter(o => o.driver_rating);
    const avgBewertung = withRating.length > 0
      ? Math.round((withRating.reduce((s, o) => s + (Number(o.driver_rating) || 0), 0) / withRating.length) * 10) / 10
      : 0;
    const withRatingLW = deliveredLW.filter(o => o.driver_rating);
    const avgBewertungVW = withRatingLW.length > 0
      ? Math.round((withRatingLW.reduce((s, o) => s + (Number(o.driver_rating) || 0), 0) / withRatingLW.length) * 10) / 10
      : 0;

    const kpis = [
      {
        label: 'Umsatz',
        wert: umsatzHeute.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €',
        trend: umsatzHeute >= umsatzVW ? 'up' : 'down' as 'up' | 'down' | 'flat',
        delta: umsatzVW > 0 ? `${umsatzHeute >= umsatzVW ? '+' : ''}${Math.round(((umsatzHeute - umsatzVW) / umsatzVW) * 100)}% vs. VW` : '',
        color: umsatzHeute >= umsatzVW ? 'gruen' : 'gelb' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
      {
        label: 'Bestellungen',
        wert: bestellungenHeute.toString(),
        trend: bestellungenHeute >= bestellungenVW ? 'up' : 'down' as 'up' | 'down' | 'flat',
        delta: bestellungenVW > 0 ? `${bestellungenHeute >= bestellungenVW ? '+' : ''}${bestellungenHeute - bestellungenVW} vs. VW` : '',
        color: bestellungenHeute >= bestellungenVW ? 'gruen' : 'gelb' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
      {
        label: 'Pünktlichkeit',
        wert: `${puenktlichkeitPct}%`,
        trend: (puenktlichkeitPct > puenktlichkeitVW ? 'up' : puenktlichkeitPct < puenktlichkeitVW ? 'down' : 'flat') as 'up' | 'down' | 'flat',
        delta: `${puenktlichkeitPct >= puenktlichkeitVW ? '+' : ''}${puenktlichkeitPct - puenktlichkeitVW}% vs. VW`,
        color: puenktlichkeitPct >= 85 ? 'gruen' : puenktlichkeitPct >= 70 ? 'gelb' : 'rot' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
      {
        label: 'Lieferzeit Ø',
        wert: `${avgMinHeute} Min`,
        trend: (avgMinHeute <= avgMinVW ? 'up' : 'down') as 'up' | 'down' | 'flat',
        delta: avgMinVW > 0 ? `${avgMinHeute <= avgMinVW ? '-' : '+'}${Math.abs(avgMinHeute - avgMinVW)} Min` : '',
        color: avgMinHeute <= 25 ? 'gruen' : avgMinHeute <= 35 ? 'gelb' : 'rot' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
      {
        label: 'Stornorate',
        wert: `${stornoRateHeute.toFixed(1)}%`,
        trend: (stornoRateHeute <= stornoRateVW ? 'up' : 'down') as 'up' | 'down' | 'flat',
        delta: `${stornoRateHeute <= stornoRateVW ? '-' : '+'}${Math.abs(stornoRateHeute - stornoRateVW).toFixed(1)}% vs. VW`,
        color: stornoRateHeute <= 3 ? 'gruen' : stornoRateHeute <= 7 ? 'gelb' : 'rot' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
      {
        label: 'Bewertung',
        wert: `${avgBewertung.toFixed(1)} ★`,
        trend: (avgBewertung >= avgBewertungVW ? 'flat' : 'down') as 'up' | 'down' | 'flat',
        delta: avgBewertungVW > 0 ? `${avgBewertung >= avgBewertungVW ? '+' : ''}${(avgBewertung - avgBewertungVW).toFixed(1)} vs. VW` : '',
        color: avgBewertung >= 4.5 ? 'gruen' : avgBewertung >= 4.0 ? 'gelb' : 'rot' as 'gruen' | 'gelb' | 'rot' | 'neutral',
      },
    ];

    return NextResponse.json({ kpis, schicht_label: 'Heute' });
  } catch {
    return NextResponse.json({
      schicht_label: 'Heute',
      kpis: [
        { label: 'Umsatz', wert: '—', trend: 'flat', color: 'neutral' },
        { label: 'Bestellungen', wert: '—', trend: 'flat', color: 'neutral' },
        { label: 'Pünktlichkeit', wert: '—', trend: 'flat', color: 'neutral' },
        { label: 'Lieferzeit Ø', wert: '—', trend: 'flat', color: 'neutral' },
        { label: 'Stornorate', wert: '—', trend: 'flat', color: 'neutral' },
        { label: 'Bewertung', wert: '—', trend: 'flat', color: 'neutral' },
      ],
    });
  }
}
