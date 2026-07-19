/**
 * GET /api/delivery/admin/fahrer-trinkgeld-quote-v2?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2549 — Fahrer-Trinkgeld-Quote v2
 * Trinkgeld-Summe (€) und Trinkgeld-Rate (% Bestellungen mit Trinkgeld) je Fahrer heute;
 * Ampel grün(≥20%)/gelb(10–19%)/rot(<10%); Alert <10%; Trend vs. VW;
 * driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_PCT = 10;
const GRUEN_PCT = 20;

export type TrendTQ = 'steigend' | 'fallend' | 'stabil';
export type AmpelTQ = 'gruen' | 'gelb' | 'rot';

export interface FahrerTrinkgeldQuoteV2Entry {
  fahrer_id: string;
  fahrer_name: string;
  tip_rate_pct: number;
  tip_rate_pct_vw: number | null;
  tip_sum_eur: number;
  bestellungen_count: number;
  mit_trinkgeld_count: number;
  trend: TrendTQ;
  trend_delta: number;
  ampel: AmpelTQ;
  alert: boolean;
}

export interface FahrerTrinkgeldQuoteV2Antwort {
  location_id: string;
  fahrer: FahrerTrinkgeldQuoteV2Entry[];
  fahrer_single?: FahrerTrinkgeldQuoteV2Entry;
  team_avg_rate_pct: number;
  team_avg_sum_eur: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelTQ {
  if (pct >= GRUEN_PCT) return 'gruen';
  if (pct >= ALERT_PCT) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vw: number | null): { trend: TrendTQ; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerTrinkgeldQuoteV2Entry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     tip_rate_pct: 25.0, tip_rate_pct_vw: 22.0, tip_sum_eur: 18.50, bestellungen_count: 32, mit_trinkgeld_count: 8,  trend: 'steigend', trend_delta:  3.0, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    tip_rate_pct:  7.4, tip_rate_pct_vw: 11.0, tip_sum_eur:  3.20, bestellungen_count: 27, mit_trinkgeld_count: 2,  trend: 'fallend',  trend_delta: -3.6, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', tip_rate_pct: 14.3, tip_rate_pct_vw: 13.0, tip_sum_eur:  9.80, bestellungen_count: 21, mit_trinkgeld_count: 3,  trend: 'steigend', trend_delta:  1.3, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     tip_rate_pct: 22.9, tip_rate_pct_vw: 20.0, tip_sum_eur: 14.00, bestellungen_count: 35, mit_trinkgeld_count: 8,  trend: 'steigend', trend_delta:  2.9, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   tip_rate_pct:  5.9, tip_rate_pct_vw:  8.5, tip_sum_eur:  2.50, bestellungen_count: 17, mit_trinkgeld_count: 1,  trend: 'fallend',  trend_delta: -2.6, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerTrinkgeldQuoteV2Antwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvgRate = Math.round((fahrer.reduce((s, f) => s + f.tip_rate_pct, 0) / fahrer.length) * 10) / 10;
  const teamAvgSum  = Math.round((fahrer.reduce((s, f) => s + f.tip_sum_eur,  0) / fahrer.length) * 100) / 100;
  const base: FahrerTrinkgeldQuoteV2Antwort = {
    location_id: locationId,
    fahrer,
    team_avg_rate_pct: teamAvgRate,
    team_avg_sum_eur: teamAvgSum,
    alert_count: alertCount,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    base.fahrer_single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
  }
  return base;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const today = new Date();
    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd   = new Date(todayEnd);   vwEnd.setDate(vwEnd.getDate() - 7);

    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'fahrer');

    const employees = (employeesRaw ?? []) as { id: string; vorname: string; nachname: string }[];
    if (!employees.length) return NextResponse.json(mockAntwort(locationId, driverId));

    const ids = employees.map(e => e.id);

    const { data: toursHeuteRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, tip_amount')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: toursVwRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, tip_amount')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    const toursHeute = (toursHeuteRaw ?? []) as { driver_id: string; tip_amount: number | null }[];
    const toursVw    = (toursVwRaw    ?? []) as { driver_id: string; tip_amount: number | null }[];

    const fahrer: FahrerTrinkgeldQuoteV2Entry[] = employees.map(emp => {
      const mineH = toursHeute.filter(t => t.driver_id === emp.id);
      const mineV = toursVw.filter(t => t.driver_id === emp.id);

      const bestellungen    = mineH.length;
      const mitTrinkgeld    = mineH.filter(t => (t.tip_amount ?? 0) > 0).length;
      const tipSumEur       = Math.round(mineH.reduce((s, t) => s + (t.tip_amount ?? 0), 0) * 100) / 100;
      const tipRatePct      = bestellungen > 0 ? Math.round((mitTrinkgeld / bestellungen) * 1000) / 10 : 0;

      const bestellungenVw  = mineV.length;
      const mitTrinkgeldVw  = mineV.filter(t => (t.tip_amount ?? 0) > 0).length;
      const tipRatePctVw    = bestellungenVw > 0 ? Math.round((mitTrinkgeldVw / bestellungenVw) * 1000) / 10 : null;

      const { trend, delta } = trendVon(tipRatePct, tipRatePctVw);
      const ampel = ampelVon(tipRatePct);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        tip_rate_pct: tipRatePct,
        tip_rate_pct_vw: tipRatePctVw,
        tip_sum_eur: tipSumEur,
        bestellungen_count: bestellungen,
        mit_trinkgeld_count: mitTrinkgeld,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount  = fahrer.filter(f => f.alert).length;
    const teamAvgRate = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.tip_rate_pct, 0) / fahrer.length) * 10) / 10
      : 0;
    const teamAvgSum  = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.tip_sum_eur, 0) / fahrer.length) * 100) / 100
      : 0;

    const antwort: FahrerTrinkgeldQuoteV2Antwort = {
      location_id: locationId,
      fahrer,
      team_avg_rate_pct: teamAvgRate,
      team_avg_sum_eur: teamAvgSum,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    };
    if (driverId) {
      antwort.fahrer_single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
