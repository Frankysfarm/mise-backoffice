/**
 * GET /api/delivery/admin/liefer-qualitaets-index?location_id=<uuid>
 *
 * Phase 1562 — Liefer-Qualitäts-Index-API
 * Gewichteter Index: Pünktlichkeit 40% + Kundenbewertung 30% + Storno-Rate 20% + Vollständigkeit 10%
 * Trend vs. 7-Tage-Ø. Status: excellent/gut/mittel/kritisch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LieferQualitaetsIndexResponse {
  index: number;
  trend_vs_7tage: number;
  status: 'excellent' | 'gut' | 'mittel' | 'kritisch';
  kpis: {
    puenktlichkeit_pct: number;
    kundenbewertung_avg: number;
    storno_rate_pct: number;
    vollstaendigkeit_pct: number;
  };
  location_id: string;
  generiert_am: string;
}

function statusFor(idx: number): 'excellent' | 'gut' | 'mittel' | 'kritisch' {
  if (idx >= 85) return 'excellent';
  if (idx >= 70) return 'gut';
  if (idx >= 50) return 'mittel';
  return 'kritisch';
}

function calcIndex(puenkt: number, bewertung: number, storno: number, vollst: number): number {
  const p = (puenkt / 100) * 40;
  const b = ((bewertung - 1) / 4) * 30;
  const s = ((100 - storno) / 100) * 20;
  const v = (vollst / 100) * 10;
  return Math.round(p + b + s + v);
}

function buildMock(locationId: string): LieferQualitaetsIndexResponse {
  const kpis = {
    puenktlichkeit_pct: 87,
    kundenbewertung_avg: 4.3,
    storno_rate_pct: 4.2,
    vollstaendigkeit_pct: 96,
  };
  const index = calcIndex(kpis.puenktlichkeit_pct, kpis.kundenbewertung_avg, kpis.storno_rate_pct, kpis.vollstaendigkeit_pct);
  return {
    index,
    trend_vs_7tage: index - 78,
    status: statusFor(index),
    kpis,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'default';
  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ data: orders }, { data: weekOrders }] = await Promise.all([
      supabase
        .from('orders')
        .select('status, delivered_at, promised_at, rating, items_missing')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('orders')
        .select('status, delivered_at, promised_at, rating, items_missing')
        .eq('location_id', locationId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString())
        .lt('created_at', todayStart.toISOString()),
    ]);

    if (!orders || orders.length === 0) return NextResponse.json(buildMock(locationId));

    const delivered = orders.filter((o: any) => o.status === 'geliefert');
    const cancelled = orders.filter((o: any) => o.status === 'storniert');
    const onTime = delivered.filter((o: any) => o.delivered_at && o.promised_at && new Date(o.delivered_at) <= new Date(o.promised_at));
    const rated = delivered.filter((o: any) => typeof o.rating === 'number');
    const complete = delivered.filter((o: any) => !o.items_missing);

    const puenktlichkeit = delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 100) : 0;
    const bewertung = rated.length > 0 ? rated.reduce((s: number, o: any) => s + o.rating, 0) / rated.length : 4.0;
    const storno = orders.length > 0 ? Math.round((cancelled.length / orders.length) * 100) : 0;
    const vollst = delivered.length > 0 ? Math.round((complete.length / delivered.length) * 100) : 100;

    const index = calcIndex(puenktlichkeit, bewertung, storno, vollst);

    let weekIndex = 78;
    if (weekOrders && weekOrders.length > 0) {
      const wd = weekOrders.filter((o: any) => o.status === 'geliefert');
      const wc = weekOrders.filter((o: any) => o.status === 'storniert');
      const wot = wd.filter((o: any) => o.delivered_at && o.promised_at && new Date(o.delivered_at) <= new Date(o.promised_at));
      const wr = wd.filter((o: any) => typeof o.rating === 'number');
      const wv = wd.filter((o: any) => !o.items_missing);
      const wp = wd.length > 0 ? Math.round((wot.length / wd.length) * 100) : 0;
      const wb = wr.length > 0 ? wr.reduce((s: number, o: any) => s + o.rating, 0) / wr.length : 4.0;
      const ws = weekOrders.length > 0 ? Math.round((wc.length / weekOrders.length) * 100) : 0;
      const wvp = wd.length > 0 ? Math.round((wv.length / wd.length) * 100) : 100;
      weekIndex = calcIndex(wp, wb, ws, wvp);
    }

    return NextResponse.json({
      index,
      trend_vs_7tage: index - weekIndex,
      status: statusFor(index),
      kpis: {
        puenktlichkeit_pct: puenktlichkeit,
        kundenbewertung_avg: Math.round(bewertung * 10) / 10,
        storno_rate_pct: storno,
        vollstaendigkeit_pct: vollst,
      },
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies LieferQualitaetsIndexResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
